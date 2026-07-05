-- Stock moves from being tracked independently per-subphase to one global
-- on-hand quantity per material, owned by Procurement. Every subphase's
-- material availability now reads this same number instead of its own
-- private quantity_in_stock — matches how a real site actually has one
-- shared stockpile, not per-task inventories.
alter table materials add column if not exists stock_on_hand numeric(12,2) not null default 0;
