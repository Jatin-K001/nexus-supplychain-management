-- Nexus core schema — NEXUS_BUILD_SPEC.md §11
-- Idempotent-safe DDL (CREATE ... IF NOT EXISTS / DROP TYPE guards)

create extension if not exists "pgcrypto";

-- ── ENUMS ──────────────────────────────────────────────────────────────
do $$ begin
  create type role_enum as enum ('pm','supervisor','procurement');
exception when duplicate_object then null; end $$;

do $$ begin
  create type unlock_type_enum as enum ('sequential','parallel','merge','independent');
exception when duplicate_object then null; end $$;

do $$ begin
  create type phase_status_enum as enum ('locked','available','in_progress','complete');
exception when duplicate_object then null; end $$;

do $$ begin
  create type delay_cause_enum as enum ('material','labor','weather','other');
exception when duplicate_object then null; end $$;

do $$ begin
  create type project_status_enum as enum ('not_started','on_track','at_risk','delayed','nearly_complete','complete');
exception when duplicate_object then null; end $$;

do $$ begin
  create type stock_request_status_enum as enum ('pending_pm_approval','approved','sourced','fulfilled','rejected');
exception when duplicate_object then null; end $$;

do $$ begin
  create type purchase_order_status_enum as enum ('recommended','approved','ordered','delivered');
exception when duplicate_object then null; end $$;

do $$ begin
  create type notification_type_enum as enum ('stock_request','order_status','phase_unlock','delay_logged','vendor_risk');
exception when duplicate_object then null; end $$;

do $$ begin
  create type urgency_enum as enum ('low','medium','high');
exception when duplicate_object then null; end $$;

-- ── USERS / PROFILES ───────────────────────────────────────────────────
-- profiles.id mirrors Supabase auth.users.id in production; kept as a
-- plain uuid PK here so this schema also runs standalone against Postgres.
create table if not exists profiles (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  email text not null unique,
  role role_enum not null,
  created_at timestamptz not null default now()
);

-- ── SITES / PROJECTS ───────────────────────────────────────────────────
create table if not exists sites (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  city text not null
);

create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references sites(id),
  name text not null,
  start_date date not null,
  target_end_date date not null,
  projected_end_date date not null,
  daily_cost_estimate numeric(12,2) not null default 60000,
  status project_status_enum not null default 'not_started',
  created_at timestamptz not null default now()
);

-- ── PHASES / SUBPHASES ─────────────────────────────────────────────────
create table if not exists phases (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  template_phase_no int not null,
  name text not null,
  unlock_type unlock_type_enum not null,
  sequence int not null,
  planned_start date,
  planned_end date,
  actual_start date,
  actual_end date,
  projected_end date,
  delay_days int not null default 0,
  delay_cause delay_cause_enum,
  status phase_status_enum not null default 'locked',
  unique (project_id, template_phase_no)
);

create table if not exists subphases (
  id uuid primary key default gen_random_uuid(),
  phase_id uuid not null references phases(id) on delete cascade,
  name text not null,
  sequence int not null,
  parallel_group int,
  unlock_type unlock_type_enum not null default 'sequential',
  planned_start date,
  planned_end date,
  actual_start date,
  actual_end date,
  projected_end date,
  delay_days int not null default 0,
  delay_cause delay_cause_enum,
  status phase_status_enum not null default 'locked',
  assigned_supervisor_id uuid references profiles(id),
  unique (phase_id, sequence)
);

create table if not exists phase_dependencies (
  id uuid primary key default gen_random_uuid(),
  predecessor_subphase_id uuid not null references subphases(id) on delete cascade,
  successor_subphase_id uuid not null references subphases(id) on delete cascade,
  lag_days int not null default 0
);

-- ── MATERIALS ──────────────────────────────────────────────────────────
create table if not exists materials (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  category text not null,
  unit text not null
);

create table if not exists subphase_materials (
  id uuid primary key default gen_random_uuid(),
  subphase_id uuid not null references subphases(id) on delete cascade,
  material_id uuid not null references materials(id),
  quantity_required numeric(12,2) not null,
  quantity_in_stock numeric(12,2) not null default 0,
  required_by_date date,
  unique (subphase_id, material_id)
);

create table if not exists material_substitutes (
  id uuid primary key default gen_random_uuid(),
  material_id uuid not null references materials(id),
  substitute_material_id uuid not null references materials(id),
  note text
);

-- ── VENDORS ────────────────────────────────────────────────────────────
create table if not exists vendors (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  contact_info text,
  reliability_score numeric(5,2) not null default 50
);

create table if not exists vendor_materials (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references vendors(id) on delete cascade,
  material_id uuid not null references materials(id),
  avg_price numeric(12,2),
  unique (vendor_id, material_id)
);

create table if not exists vendor_deliveries (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references vendors(id),
  material_id uuid not null references materials(id),
  order_date date not null,
  promised_date date not null,
  actual_date date not null,
  qty_ordered numeric(12,2) not null,
  qty_delivered numeric(12,2) not null,
  complaint boolean not null default false,
  price numeric(12,2) not null
);

create table if not exists reliability_score_history (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references vendors(id) on delete cascade,
  recorded_at timestamptz not null default now(),
  score numeric(5,2) not null
);

-- ── STOCK REQUESTS / PURCHASE ORDERS ───────────────────────────────────
create table if not exists stock_requests (
  id uuid primary key default gen_random_uuid(),
  subphase_id uuid not null references subphases(id),
  material_id uuid not null references materials(id),
  quantity numeric(12,2) not null,
  status stock_request_status_enum not null default 'pending_pm_approval',
  urgency urgency_enum not null default 'medium',
  approved_by uuid references profiles(id),
  approved_at timestamptz,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

create table if not exists purchase_orders (
  id uuid primary key default gen_random_uuid(),
  material_id uuid not null references materials(id),
  vendor_id uuid not null references vendors(id),
  quantity numeric(12,2) not null,
  status purchase_order_status_enum not null default 'recommended',
  source_stock_request_id uuid references stock_requests(id),
  order_date date not null default current_date,
  promised_date date,
  actual_delivery_date date,
  notes text,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

-- ── PRICE HISTORY / FORECASTS ──────────────────────────────────────────
create table if not exists price_history (
  id uuid primary key default gen_random_uuid(),
  material_id uuid not null references materials(id),
  week_index int not null,
  recorded_at date not null,
  price_index numeric(8,2) not null
);

create table if not exists demand_forecasts (
  id uuid primary key default gen_random_uuid(),
  material_id uuid not null references materials(id),
  project_id uuid not null references projects(id),
  predicted_shortfall_date date,
  confidence_pct numeric(5,2) not null,
  is_fallback boolean not null default false,
  computed_at timestamptz not null default now()
);

-- ── RESOURCE ASSIGNMENTS / DELAY PATTERNS ──────────────────────────────
create table if not exists resource_assignments (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id),
  resource_name text not null,
  phase_id uuid references phases(id),
  start_date date not null,
  end_date date not null
);

create table if not exists delay_events (
  id uuid primary key default gen_random_uuid(),
  phase_id uuid references phases(id),
  subphase_id uuid references subphases(id),
  phase_name text not null,
  cause delay_cause_enum not null,
  delay_days int not null,
  recorded_at timestamptz not null default now()
);

-- ── NOTIFICATIONS (§8.1) ────────────────────────────────────────────────
create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_user_id uuid not null references profiles(id),
  type notification_type_enum not null,
  related_table text not null,
  related_id uuid not null,
  message text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

-- ── INDEXES ─────────────────────────────────────────────────────────────
create index if not exists idx_subphases_phase on subphases(phase_id);
create index if not exists idx_phases_project on phases(project_id);
create index if not exists idx_stock_requests_status on stock_requests(status);
create index if not exists idx_purchase_orders_status on purchase_orders(status);
create index if not exists idx_notifications_recipient on notifications(recipient_user_id, read_at);
create index if not exists idx_vendor_deliveries_vendor on vendor_deliveries(vendor_id);
create index if not exists idx_price_history_material on price_history(material_id, week_index);
