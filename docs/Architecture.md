# Architecture

## System design

Nexus is a three-service system, deliberately split by responsibility rather than by team boundary:

1. **`apps/web`** — React/TypeScript SPA. Owns presentation and user interaction only. Never talks to Postgres directly; never talks to the ML service directly.
2. **`apps/api`** — Node/Express service. Owns every business rule and is the only service with write access to Postgres. Acts as the sole gateway to the ML service.
3. **`apps/ml-service`** — Python/FastAPI service. Owns forecasting and simulation. Reads Postgres directly (read-only, for model inputs) but never writes to it.

This split exists so the ML service can be redeployed, retrained, or replaced independently of the API and frontend, and so the API remains the single place that enforces "who can do what" — a rule that would be easy to accidentally bypass if the frontend or the ML service could write to the database directly.

## Why a global stock pool

Materials were originally modeled per-subphase (each subphase reserving its own stock). This was redesigned to a single `materials.stock_on_hand` value per material, because real procurement doesn't pre-allocate inventory to individual tasks — it manages one shared pool. The redesign also eliminated a class of reconciliation bugs where per-subphase numbers could drift out of sync with what was actually in the warehouse. Every subphase's availability check, every procurement screen, and every dashboard KPI now reads the same number, and only one endpoint (delivery logging in `purchaseOrders.ts`) ever writes to it.

## Concurrency handling

Two users can act on the same shared state at the same time — most notably, a stock request being approved. Rather than a check-then-act pattern (read status, decide, then write — which race conditions can slip through), approval/dismissal uses an atomic conditional SQL update:

```sql
UPDATE stock_requests SET status = 'approved' WHERE id = $1 AND status = 'pending_pm_approval'
```

Only one concurrent request can match the `WHERE` clause and succeed; the loser's update affects zero rows, which the route treats as "already handled."

## The stock-request pipeline

```
Supervisor tries to start/end a subphase
        ↓
Required material qty > materials.stock_on_hand?
        ↓ yes
stock_requests row created (status: pending_pm_approval)
        ↓
Notification sent to the Project Manager
        ↓
PM approves (atomic conditional UPDATE) or dismisses
        ↓ approved
Procurement sees it in their queue, compares vendors by reliability score
        ↓
Purchase order placed (purchase_orders row, promised_date from predictLeadTime)
        ↓
Delivery logged (actual_date, qty_received, complaint, price)
        ↓
vendor_deliveries row inserted → recomputeVendorScore runs
        ↓
materials.stock_on_hand incremented
        ↓
Subphase re-checked — unlocks if stock now covers it
```

## Vendor reliability scoring

Recomputed from the vendor's **entire** delivery history every time a new delivery is logged (never a stored/stale running average):

```
score = (0.5 × on_time_rate + 0.3 × (1 − complaint_rate) + 0.2 × (1 − price_variance)) × 100
```

Where `price_variance = min(1, stddev(price) / avg(price))` over all deliveries for that vendor. Because it's a lifetime average, a single delivery has a smaller effect on the score as the vendor's history grows — a known limitation, documented as a future improvement (recency weighting) rather than treated as a bug.

## Cascade / delay propagation

Phases and subphases, together with their unlock dependencies (`sequential`, `parallel`, `merge`, `independent`), are modeled as a directed graph in `apps/ml-service/app/critical_path.py` and `cascade.py` using `networkx`. A logged `delay_event` triggers a graph walk from the delayed node forward through its dependents, recomputing which subphases shift, by how many days, and what the new project-level projected completion date and critical path are. This is computed fresh on every request — nothing about cascade state is cached, so it can never go stale relative to the current schedule.

## Forecasting

- **Demand** (`apps/ml-service`, PyTorch LSTM): trained per material on `consumption_logs`, predicting near-term demand so procurement can order ahead of a shortfall rather than react to one.
- **Price** (`apps/ml-service`, statsmodels Holt-Winters): triple exponential smoothing over a material's `price_history`, projecting near-term price movement.

Both are computed on demand via the ML service's REST endpoints, proxied through `apps/api/src/routes/mlProxy.ts` — the frontend never calls the ML service's URL directly, which keeps the ML service's address and auth model entirely internal.

## Authentication

Supabase Auth issues a JWT on login. The frontend attaches it as a bearer token on every API call (`apps/web/src/lib/api.ts`). `apps/api/src/middleware/auth.ts` verifies the token against Supabase on every request and loads the caller's role from the `profiles` table — the role is never trusted from the client, only from what's stored server-side against the verified user id.
