-- §4.8: "dropped >10 points across two consecutive snapshots" means compare the
-- new score against the snapshot two steps back (spans two snapshot intervals),
-- not just the immediately preceding one. Matches the Vendor K seed example
-- (58→49→41→37): 49→37 is a 12-pt drop across two intervals, fires the alert;
-- the naive 41→37 (4-pt) single-step comparison would not have.
create or replace function trg_vendor_risk_alert() returns trigger as $$
declare
  v_prev numeric(5,2); v_name text;
begin
  select score into v_prev from (
    select score, recorded_at from reliability_score_history
    where vendor_id = new.vendor_id and recorded_at < new.recorded_at
    order by recorded_at desc limit 1 offset 1
  ) t;
  if v_prev is not null and (v_prev - new.score) > 10 then
    select name into v_name from vendors where id = new.vendor_id;
    perform notify_role('procurement', 'vendor_risk', 'vendors', new.vendor_id,
      format('%s''s reliability dropped to %s', v_name, new.score));
  end if;
  return new;
end;
$$ language plpgsql;
