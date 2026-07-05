-- §4.4 Auto-Generated Purchase Recommendations create purchase_orders rows
-- with no source_stock_request_id (that path is reactive, this one's
-- proactive — §4.4's own note). Without a stock request to hang off of,
-- there's no way to trace a recommendation back to its project. Add the link
-- directly and backfill the reactive-path rows that already have one.
alter table purchase_orders add column if not exists project_id uuid references projects(id);

update purchase_orders po
set project_id = p.project_id
from stock_requests sr
join subphases s on s.id = sr.subphase_id
join phases p on p.id = s.phase_id
where po.source_stock_request_id = sr.id and po.project_id is null;
