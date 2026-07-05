-- §4.1: LSTM demand forecasting trains on daily consumption logs, which come
-- from the Site Supervisor's "Log Consumption" action (§1 role table). This
-- table didn't exist yet — §11's table list implies it via "daily consumption
-- logs (from Log Consumption)" in §4.1 but never names it explicitly.
create table if not exists consumption_logs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id),
  material_id uuid not null references materials(id),
  subphase_id uuid references subphases(id),
  log_date date not null,
  quantity numeric(12,2) not null,
  logged_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

create index if not exists idx_consumption_logs_project_material on consumption_logs(project_id, material_id, log_date);
