-- §5.6 Delay Root-Cause Attribution: when cause='material', auto-link the
-- specific stock_request/purchase_order that caused it.
alter table delay_events add column if not exists related_stock_request_id uuid references stock_requests(id);
alter table delay_events add column if not exists related_purchase_order_id uuid references purchase_orders(id);

-- §5.7 Historical Delay Pattern Analysis: aggregation feeding PM·08 Reports.
create or replace view delay_patterns as
select phase_name, cause, count(*)::int as occurrence_count, avg(delay_days)::numeric(6,2) as avg_delay_days
from delay_events
group by phase_name, cause;
