-- Notification trigger pipeline — NEXUS_BUILD_SPEC.md §8
-- Alerts are side effects of state changes, fired as DB triggers, never polled.

-- helper: insert one notification row per matching recipient
create or replace function notify_role(p_role role_enum, p_type notification_type_enum,
                                        p_related_table text, p_related_id uuid, p_message text)
returns void as $$
begin
  insert into notifications (recipient_user_id, type, related_table, related_id, message)
  select id, p_type, p_related_table, p_related_id, p_message
  from profiles where role = p_role;
end;
$$ language plpgsql;

create or replace function notify_user(p_user_id uuid, p_type notification_type_enum,
                                        p_related_table text, p_related_id uuid, p_message text)
returns void as $$
begin
  if p_user_id is not null then
    insert into notifications (recipient_user_id, type, related_table, related_id, message)
    values (p_user_id, p_type, p_related_table, p_related_id, p_message);
  end if;
end;
$$ language plpgsql;

-- resolve the supervisor who owns the subphase behind a stock_request / PO
create or replace function subphase_supervisor(p_subphase_id uuid) returns uuid as $$
  select s.assigned_supervisor_id from subphases s where s.id = p_subphase_id;
$$ language sql stable;

-- 1) stock_requests created -> PM
create or replace function trg_stock_request_created() returns trigger as $$
declare
  v_material text; v_subphase text; v_supervisor text;
begin
  select m.name into v_material from materials m where m.id = new.material_id;
  select sp.name into v_subphase from subphases sp where sp.id = new.subphase_id;
  select p.full_name into v_supervisor from profiles p where p.id = new.created_by;
  perform notify_role('pm', 'stock_request', 'stock_requests', new.id,
    format('%s raised a stock request: %s for %s', coalesce(v_supervisor,'A supervisor'), v_material, v_subphase));
  return new;
end;
$$ language plpgsql;

drop trigger if exists stock_request_created on stock_requests;
create trigger stock_request_created
  after insert on stock_requests
  for each row execute function trg_stock_request_created();

-- 2/3/4) stock_requests status transitions
create or replace function trg_stock_request_status_change() returns trigger as $$
declare
  v_material text; v_supervisor uuid; v_vendor text;
begin
  if new.status = old.status then
    return new;
  end if;
  select m.name into v_material from materials m where m.id = new.material_id;
  v_supervisor := subphase_supervisor(new.subphase_id);

  if new.status = 'approved' then
    perform notify_role('procurement', 'stock_request', 'stock_requests', new.id,
      format('New stock request approved: %s, %s', v_material, new.quantity));
    perform notify_user(v_supervisor, 'stock_request', 'stock_requests', new.id,
      format('Your stock request for %s was approved', v_material));
  elsif new.status = 'sourced' then
    select v.name into v_vendor from purchase_orders po
      join vendors v on v.id = po.vendor_id
      where po.source_stock_request_id = new.id
      order by po.created_at desc limit 1;
    perform notify_role('pm', 'stock_request', 'stock_requests', new.id,
      format('%s sourced from %s — awaiting your approval', v_material, coalesce(v_vendor,'a vendor')));
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists stock_request_status_change on stock_requests;
create trigger stock_request_status_change
  after update on stock_requests
  for each row execute function trg_stock_request_status_change();

-- 5/6) purchase_orders status transitions
create or replace function trg_purchase_order_status_change() returns trigger as $$
declare
  v_material text; v_supervisor uuid; v_subphase_id uuid; v_pm_and_sup uuid;
  v_delay int;
begin
  if new.status = old.status then
    return new;
  end if;
  select m.name into v_material from materials m where m.id = new.material_id;

  if new.source_stock_request_id is not null then
    select subphase_id into v_subphase_id from stock_requests where id = new.source_stock_request_id;
    v_supervisor := subphase_supervisor(v_subphase_id);
  end if;

  if new.status = 'approved' then
    perform notify_user(v_supervisor, 'order_status', 'purchase_orders', new.id,
      format('Order placed for %s — expected %s', v_material, to_char(new.promised_date,'DD Mon YYYY')));
  elsif new.status = 'delivered' then
    v_delay := coalesce(new.actual_delivery_date - new.promised_date, 0);
    perform notify_role('pm', 'order_status', 'purchase_orders', new.id,
      format('%s delivered — %s', v_material,
        case when v_delay <= 0 then 'on time' else format('late by %s days', v_delay) end));
    perform notify_user(v_supervisor, 'order_status', 'purchase_orders', new.id,
      format('%s delivered — %s', v_material,
        case when v_delay <= 0 then 'on time' else format('late by %s days', v_delay) end));
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists purchase_order_status_change on purchase_orders;
create trigger purchase_order_status_change
  after update on purchase_orders
  for each row execute function trg_purchase_order_status_change();

-- 7) subphase unlocked (status -> available)
create or replace function trg_subphase_unlocked() returns trigger as $$
begin
  if new.status = 'available' and old.status is distinct from 'available' then
    perform notify_user(new.assigned_supervisor_id, 'phase_unlock', 'subphases', new.id,
      format('%s is now available to start', new.name));
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists subphase_unlocked on subphases;
create trigger subphase_unlocked
  after update on subphases
  for each row execute function trg_subphase_unlocked();

-- 8) phase ends late -> PM (delay_days set > 0 on phase)
create or replace function trg_phase_delay_logged() returns trigger as $$
begin
  if new.delay_days > 0 and (old.delay_days is null or old.delay_days = 0) then
    perform notify_role('pm', 'delay_logged', 'phases', new.id,
      format('%s finished %s days late — cascade recalculated', new.name, new.delay_days));
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists phase_delay_logged on phases;
create trigger phase_delay_logged
  after update on phases
  for each row execute function trg_phase_delay_logged();

-- 9) vendor reliability score drops >10 pts across two consecutive snapshots
create or replace function trg_vendor_risk_alert() returns trigger as $$
declare
  v_prev numeric(5,2); v_name text;
begin
  select score into v_prev from reliability_score_history
    where vendor_id = new.vendor_id and recorded_at < new.recorded_at
    order by recorded_at desc limit 1;
  if v_prev is not null and (v_prev - new.score) > 10 then
    select name into v_name from vendors where id = new.vendor_id;
    perform notify_role('procurement', 'vendor_risk', 'vendors', new.vendor_id,
      format('%s''s reliability dropped to %s', v_name, new.score));
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists vendor_risk_alert on reliability_score_history;
create trigger vendor_risk_alert
  after insert on reliability_score_history
  for each row execute function trg_vendor_risk_alert();
