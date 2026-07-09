# Nexus — AI-Driven Supply Chain Intelligence Platform

Nexus replaces the spreadsheets-and-phone-calls coordination typical of construction supply chains with a single, live, role-aware system. It tracks a fixed 10-phase / 97-subphase project template, gates on-site work against a real global material stock pool, routes shortages through an approval-and-procurement pipeline, forecasts demand and price with machine learning, and simulates how a schedule delay ripples through the rest of a project.

---

## Table of Contents

- [Project Overview](#project-overview)
- [Tech Stack](#tech-stack)
- [Overall Architecture](#overall-architecture)
- [Folder Structure](#folder-structure)
- [File Responsibilities](#file-responsibilities)
- [Request Flow](#request-flow)
- [Data Flow](#data-flow)
- [Installation](#installation)
- [Running the Project](#running-the-project)
- [Environment Variables](#environment-variables)
- [Project Features](#project-features)
- [Development Workflow](#development-workflow)
- [Future Improvements](#future-improvements)
- [Contributors](#contributors)
- [License](#license)

---

## Project Overview

**Problem it solves:** construction supply chains typically run on disconnected spreadsheets and informal communication between three groups — Project Managers, Site Supervisors, and Procurement — who don't share a live source of truth. This causes four concrete failures: no real-time material visibility, reactive (not predictive) purchasing, vendor decisions made on habit instead of data, and schedule delays that stay invisible until they've already compounded.

**How Nexus solves it:** every project follows the same 10-phase / 97-subphase template, so progress and material need are always structured and comparable. A single **global stock pool per material** is the one source of truth every screen reads from. When a Site Supervisor can't start a subphase because material is short, the system automatically raises a request to the Project Manager; on approval it flows to Procurement, who compares vendors by a computed reliability score and places an order; on delivery, the global stock updates and the gate releases — instantly, everywhere. On top of this operational core, a PyTorch LSTM forecasts demand, a Holt-Winters model forecasts price trends, and a networkx-based graph engine propagates schedule delays to project a revised completion date.

**Architecture in simple language:** a React frontend talks to a Node.js/Express API, which owns all business rules and the Postgres database; a separate Python/FastAPI service handles the machine learning (forecasting, cascade simulation) and is called by the API, never directly by the frontend. Authentication is handled by Supabase.

---

## Tech Stack

**React 18 + TypeScript**
Builds the frontend user interface — all 30 screens across the three roles. Chosen for component reuse across near-identical role-specific flows (e.g. every role has a dashboard, a list screen, a detail screen) and for TypeScript's compile-time safety across a data model with many interlocking IDs (project → phase → subphase → material → vendor).

**Vite**
Development server and production bundler for the frontend. Used over Create React App for materially faster local reload during iterative UI work.

**Tailwind CSS**
Utility-first styling for the frontend, applied consistently across all screens instead of hand-rolled CSS per component.

**TanStack Query**
Server-state management on the frontend — caching, refetching, and invalidation after mutations (e.g. approving a stock request immediately refreshes the dashboard's pending count without a manual reload).

**React Router v6**
Client-side routing; also the mechanism that sends a signed-in user straight to their role's home (`/pm/...`, `/supervisor/...`, `/procurement/...`).

**Node.js + Express + TypeScript**
Runs the primary backend API (`apps/api`). Owns all business logic: the subphase lifecycle and its stock gate, the stock-request → approval → purchase-order → delivery pipeline, vendor reliability recomputation, and project/template creation. Express was chosen for a small, explicit REST surface — one router file per resource — over a heavier framework, since the domain logic (not routing complexity) is what mattered here.

**PostgreSQL, hosted on Supabase**
The single source of truth for all data — projects, phases, subphases, materials, the global stock pool, vendors, deliveries, and notifications. Chosen for real relational integrity (foreign keys across the project → phase → subphase → material graph, atomic conditional updates for the stock-approval race condition) over a document store.

**Supabase Auth**
Email/password authentication for the three seeded roles. The frontend gets a Supabase session token and sends it as a bearer token to the API; the API verifies it against Supabase on every request (`apps/api/src/middleware/auth.ts`) and loads the caller's role from the `profiles` table.

**Python + FastAPI**
Runs the ML service (`apps/ml-service`) as a separate process from the main API. FastAPI was chosen for its native Pydantic request validation and because Python is where PyTorch, statsmodels, and networkx actually live — there's no equivalent ML tooling in the Node ecosystem worth using here.

**PyTorch**
Implements the LSTM demand-forecasting model, trained on historical `consumption_logs`, to predict near-term material demand per project. Substituted for TensorFlow, which is unavailable on the Python 3.14 runtime used in development — a deliberate, documented tradeoff, not an oversight.

**statsmodels**
Implements Holt-Winters (triple exponential smoothing) price forecasting over vendor `price_history`, to project near-term material price trends.

**networkx**
Models phase/subphase dependencies as a directed graph and propagates a logged delay through it, computing the affected downstream subphases, the new critical path, and the projected project completion date.

**Turborepo-style npm workspaces**
The root `package.json` declares `apps/web`, `apps/api`, and `packages/shared-types` as workspaces, so shared TypeScript types are written once (`packages/shared-types`) and consumed by both the frontend and the API without duplication or drift.

---

## Overall Architecture

```
User (Project Manager / Site Supervisor / Procurement)
        ↓
Frontend  — React + TypeScript (apps/web), talks to Supabase Auth directly for login,
             everything else through the API
        ↓
API Layer — Node.js + Express (apps/api), verifies the Supabase bearer token on every
             request, resolves the caller's role, and is the only thing that touches Postgres
        ↓
Business Logic — inside apps/api/src/routes/*.ts: subphase lifecycle + stock gate,
                   stock-request → PM approval → purchase order → delivery pipeline,
                   vendor reliability recomputation
        ↓                                    ↘
Database — PostgreSQL on Supabase             ML Service — Python + FastAPI (apps/ml-service),
   (all persistent state)                       called by the API for demand/price forecasts
                                                 and cascade/critical-path recalculation
```

The frontend never calls the ML service directly — every ML request goes `frontend → API → ml-service → API → frontend`, so the API stays the single authority over what the frontend is allowed to see and do, and the ML service can be redeployed or replaced without the frontend knowing.

---

## Folder Structure

```
nexus/
├── apps/
│   ├── web/                 # React + TypeScript frontend (all 30 screens)
│   │   ├── src/
│   │   │   ├── pages/        # One folder per role: pm/, supervisor/, procurement/
│   │   │   ├── components/   # Shared UI primitives (Card, Button, Toast, StatCard, ...)
│   │   │   └── lib/          # API client, Supabase client
│   │   ├── vercel.json       # SPA rewrite rule for client-side routing
│   │   └── vite.config.ts
│   ├── api/                  # Node.js + Express backend
│   │   └── src/
│   │       ├── routes/        # One router per resource (projects, subphases, vendors, ...)
│   │       ├── middleware/    # requireAuth, requireRole, asyncHandler
│   │       ├── services/      # Cross-route business logic (e.g. vendor scoring)
│   │       ├── db.ts           # Postgres connection pool
│   │       ├── supabase.ts     # Supabase admin client (token verification)
│   │       └── index.ts        # Express app entrypoint — mounts every router
│   └── ml-service/            # Python + FastAPI ML service
│       └── app/
│           ├── main.py               # FastAPI app — mounts every ML endpoint
│           ├── cascade.py            # Delay propagation / cascade engine
│           ├── critical_path.py      # networkx critical-path computation
│           ├── price_forecast.py     # Holt-Winters price forecasting
│           ├── purchase_recommendations.py
│           └── db.py                 # Postgres connection for the ML service
├── packages/
│   └── shared-types/          # TypeScript types shared by apps/web and apps/api
├── db/
│   └── migrations/             # Numbered SQL migrations, applied in order
├── scripts/                    # One-off and reusable Node scripts (seeding, testing, utilities)
├── review-deliverables/        # Presentation + report generation scripts for project review
├── docs/                        # Architecture.md, Setup.md, API.md
├── package.json                 # Workspace root — dev/build scripts spanning all apps
├── .env.example                 # Template for required environment variables
└── README.md
```

### `apps/web/`
The complete client-side application. Responsible for the user interface, all API calls, routing, and role-based screen access. Talks to Supabase directly only for authentication; every other read or write goes through `apps/api`.

### `apps/api/`
The server-side application and single authority over the database. Responsible for business logic, REST APIs, auth verification, and all Postgres access. Nothing else in the system talks to Postgres directly except this and the ML service (which only reads, for forecasting inputs).

### `apps/ml-service/`
The machine learning service. Responsible for demand forecasting, price forecasting, and cascade/critical-path simulation. Called exclusively by `apps/api` (via `apps/api/src/routes/mlProxy.ts`), never by the frontend directly.

### `packages/shared-types/`
TypeScript types (e.g. `Role`) shared between the frontend and the API, so the two never drift out of sync on what a "role" or a domain object looks like.

### `db/migrations/`
Every schema change as a numbered, ordered SQL file, applied via `scripts/run-migrations.js`. This is the authoritative history of how the schema evolved — read it before changing the schema by hand.

### `scripts/`
Node scripts that operate directly on the database outside the API: seeding (`seed.js`, `seed-consumption.js`), the regression and pipeline test suites (`regression-test.js`, `pipeline-test.js`), and one-off maintenance utilities (`wipe-to-vendors-only.js`, `update-user-emails.js`).

---

## File Responsibilities

**`apps/api/src/index.ts`**
- Starts the Express server and mounts every route module under `/api/*`
- Registers global middleware (`cors`, `express.json`)
- Defines `/health` and `/api/me`
- Called by: `npm run dev` / `node dist/index.js`. Calls: every router in `src/routes/`.

**`apps/api/src/middleware/auth.ts`**
- `requireAuth`: verifies the bearer token against Supabase, loads the caller's profile/role from Postgres, attaches it to `req.user`
- `requireRole(...)`: gate for role-restricted endpoints
- Called by: every protected route. Calls: `supabaseAdmin.auth.getUser`, the `profiles` table.

**`apps/api/src/routes/projects.ts`**
- Lists projects (scoped to the caller's assigned projects if they're a supervisor)
- Creates a project, auto-generating the full 10-phase / 97-subphase template with proportionally distributed planned dates
- Called by: the PM's Projects/New Project screens. Calls: `db.ts`, `phaseTemplate.js` (via the seed/template logic).

**`apps/api/src/routes/subphases.ts`**
- Subphase lifecycle transitions (locked → available → in progress → complete), including the stock-gate check before allowing a start
- Called by: the Site Supervisor's Subphase Detail screen.

**`apps/api/src/routes/stockRequests.ts`**
- Stock-request creation, PM approval/dismissal (atomic conditional `UPDATE` to avoid the double-approval race condition)
- Called by: Supervisor (create), PM (approve/dismiss).

**`apps/api/src/routes/purchaseOrders.ts`**
- Purchase-order placement and delivery logging; on delivery, inserts into `vendor_deliveries` and calls `recomputeVendorScore`
- Called by: Procurement's Place Order and Log Delivery screens. Calls: `services/vendors.ts`.

**`apps/api/src/services/vendors.ts`**
- `recomputeVendorScore`: the weighted reliability formula (0.5 × on-time + 0.3 × (1 − complaint rate) + 0.2 × (1 − price variance)), recomputed from full delivery history every time a delivery is logged
- `predictLeadTime`: vendor/material lead-time estimate with a three-step fallback chain
- Called by: `purchaseOrders.ts`.

**`apps/api/src/routes/dashboard.ts`**
- Aggregate KPIs for the PM dashboard (delayed phase count, average vendor reliability, at-risk materials, delay-pattern history)
- Called by: `apps/web/src/pages/pm/Dashboard.tsx`.

**`apps/api/src/routes/mlProxy.ts`**
- Forwards cascade/forecast requests from the API to the ML service and returns the result
- Called by: PM's cascade/forecast screens. Calls: `apps/ml-service`.

**`apps/ml-service/app/main.py`**
- FastAPI app exposing `/cascade/recalculate`, `/price/forecast/{material_id}`, `/critical-path/{project_id}`, `/purchase-recommendations/generate`
- Called by: `apps/api/src/routes/mlProxy.ts`.

**`apps/ml-service/app/cascade.py`, `critical_path.py`**
- Build the phase/subphase dependency graph (networkx) and propagate a delay through it to compute the new projected completion date and critical path.

**`apps/ml-service/app/price_forecast.py`**
- Holt-Winters exponential smoothing over a material's `price_history`.

**`apps/web/src/lib/api.ts`**
- Thin fetch wrapper that attaches the Supabase bearer token to every request to `apps/api`
- Called by: every page component's `useQuery`/`useMutation` call.

**`apps/web/src/pages/pm/Dashboard.tsx`**
- The PM landing screen — active project count, delayed phases, average vendor reliability, pending approvals, and the full stock-request queue
- Calls: `/api/dashboard/risk-summary`, `/api/stock-requests`, `/api/projects`.

**`apps/web/src/pages/supervisor/SubphaseDetail.tsx`**
- The unified start/end screen for a subphase — shows required materials against live global stock and gates the transition
- Calls: `/api/subphases/:id`.

**`apps/web/src/pages/procurement/VendorComparison.tsx`**
- Side-by-side vendor comparison (reliability score, price, delivery history) for a material
- Calls: `/api/vendors`.

**`scripts/seed.js`**
- Populates the database with the exact §14 seed dataset (materials, vendors, historical deliveries, the 10-phase template) so the system has realistic data from a clean database.

**`db/migrations/000N_*.sql`**
- Ordered schema changes, applied by `scripts/run-migrations.js`. Read these, in order, to understand how the schema arrived at its current shape.

---

## Request Flow

Example: a Site Supervisor tries to end a subphase whose next subphase needs more cement than is currently in stock.

```
Browser (Site Supervisor clicks "End Subphase")
    ↓
Frontend Component — apps/web/src/pages/supervisor/SubphaseDetail.tsx
    ↓
API Service — apps/web/src/lib/api.ts  (attaches Supabase bearer token)
    ↓
Express Route — apps/api/src/routes/subphases.ts  (POST /api/subphases/:id/end)
    ↓
Middleware — requireAuth verifies the token, loads the caller's role
    ↓
Business Logic — checks required material qty against materials.stock_on_hand;
                   insufficient → creates a stock_requests row, triggers a
                   notification to the Project Manager
    ↓
Database — PostgreSQL (Supabase) — the write of record
    ↓
Response — JSON result (subphase not yet unlocked, request pending)
    ↓
Frontend — re-renders SubphaseDetail showing "awaiting stock", PM sees the
            request appear on their dashboard on next fetch
```

---

## Data Flow

- **Global stock pool**: `materials.stock_on_hand` is the single number read by every subphase's availability check and every procurement screen. Only Procurement's delivery-logging endpoint (`purchaseOrders.ts`) writes to it — so there is exactly one writer and many readers, which is what keeps the number consistent across the whole app.
- **Vendor reliability**: recomputed from the full `vendor_deliveries` history every time a delivery is logged, then written to `vendors.reliability_score` and appended to `reliability_score_history` (which also feeds risk alerts).
- **Forecasts**: the ML service reads `consumption_logs` and `price_history` on demand (not pre-computed/cached), so a forecast always reflects the current database state.
- **Cascade**: a `delay_event` written by the Supervisor's delay-reporting flow is the only trigger for cascade recalculation — the ML service reads the current phase/subphase dependency graph fresh on every call.

---

## Installation

Prerequisites: Node.js 20+, Python 3.11+ (3.14 used in development), a Supabase project (Postgres + Auth).

```bash
# 1. Clone and install JS dependencies (installs all three workspaces)
git clone <repo-url>
cd nexus
npm install

# 2. Install the ML service's Python dependencies
cd apps/ml-service
python -m venv venv
venv\Scripts\activate        # or: source venv/bin/activate on macOS/Linux
pip install -r requirements.txt
cd ../..

# 3. Configure environment variables
cp .env.example .env
cp .env.example apps/web/.env   # then trim to the VITE_* keys only
# fill in real Supabase + Postgres values in both files

# 4. Apply database migrations
node scripts/run-migrations.js

# 5. Seed the database with the reference dataset
node scripts/seed.js
```

---

## Running the Project

Three processes run independently — start each in its own terminal:

```bash
# Frontend (http://localhost:5173)
npm run dev:web

# API (http://localhost:4000)
npm run dev:api

# ML service (http://localhost:8000)
cd apps/ml-service
venv\Scripts\activate
uvicorn app.main:app --reload --port 8000
```

Build for production:

```bash
npm run build   # builds shared-types, then web, then api, in order
```

---

## Environment Variables

| Variable | Used by | Purpose |
|---|---|---|
| `SUPABASE_URL` | API | Supabase project URL, for admin token verification |
| `SUPABASE_ANON_KEY` | API, Web | Public Supabase key for client-side auth calls |
| `SUPABASE_SERVICE_ROLE_KEY` | API | Privileged key for server-side Supabase Auth admin calls |
| `SUPABASE_PUBLISHABLE_KEY` | Web | Publishable key used by the Supabase JS client |
| `DATABASE_URL` | API, ML service, scripts | Full Postgres connection string (Supabase session pooler) |
| `DB_HOST` / `DB_PORT` / `DB_USER` / `DB_PASSWORD` / `DB_NAME` | API, ML service, scripts | Individual Postgres connection parameters |
| `PORT` | API | Port the Express server listens on (default 4000) |
| `VITE_SUPABASE_URL` | Web | Same Supabase URL, exposed to the Vite frontend build |
| `VITE_SUPABASE_ANON_KEY` | Web | Same anon key, exposed to the frontend |
| `VITE_API_URL` | Web | Base URL the frontend uses to call `apps/api` |

The Supabase direct database host is IPv6-only and unreachable from some dev networks — `DB_HOST`/`DATABASE_URL` intentionally point at the Supabase **session pooler** endpoint instead.

---

## Project Features

- **Fixed 10-phase / 97-subphase project template**, auto-generated with proportionally distributed planned dates on project creation
- **Stock-gated subphase lifecycle** — a subphase cannot start until the global stock pool covers its required materials
- **Automated stock pipeline** — shortage → PM approval → vendor comparison → purchase order → delivery → global stock update, end to end
- **Vendor reliability scoring** — weighted, live-recomputed formula (on-time rate, complaint rate, price variance)
- **LSTM demand forecasting** (PyTorch) and **Holt-Winters price forecasting** (statsmodels)
- **Delay cascade simulation** (networkx) — projects a revised completion date and critical path from a single delay event
- **Role-based access** for Project Manager, Site Supervisor, and Procurement, each with a dedicated set of screens
- **Live notifications** across roles for shortages, approvals, and deliveries

---

## Development Workflow

1. **Schema changes** go in a new numbered file under `db/migrations/`, applied via `scripts/run-migrations.js` — never edit an existing migration once it's merged.
2. **Shared types** (roles, cross-cutting domain types) go in `packages/shared-types/src`, built before the app that consumes them (`npm run build` already sequences this).
3. **New API endpoints** get their own router file under `apps/api/src/routes/`, mounted in `apps/api/src/index.ts`. Cross-route logic (like vendor scoring) belongs in `apps/api/src/services/`, not duplicated across routes.
4. **New screens** go under `apps/web/src/pages/<role>/`, using the shared primitives in `apps/web/src/components/ui/` rather than one-off styling.
5. **Before merging**, run the regression and pipeline test scripts (`node scripts/regression-test.js`, `node scripts/pipeline-test.js`) against a live database — both are self-contained and self-cleaning.

---

## Future Improvements

- Recency-weighted vendor reliability score, so recent performance outweighs lifetime history
- Mobile app (React Native) with offline-first consumption logging
- IoT/RFID integration for automatic stock updates on delivery
- Multi-tenant support for multiple construction companies
- Computer-vision-based progress tracking from site photos
- Configurable project templates beyond the fixed 10-phase structure

---

## Contributors

- _Add your name here_
- _Add your name here_

---

## License

MIT
