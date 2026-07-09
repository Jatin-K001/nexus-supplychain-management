# Setup

## Prerequisites

- Node.js 20+
- Python 3.11+ (3.14 used in development)
- A Supabase project (Postgres database + Auth enabled)

## 1. Install JavaScript dependencies

From the repo root — this installs all three npm workspaces (`apps/web`, `apps/api`, `packages/shared-types`) in one pass:

```bash
npm install
```

## 2. Install the ML service's Python dependencies

```bash
cd apps/ml-service
python -m venv venv
venv\Scripts\activate        # Windows. macOS/Linux: source venv/bin/activate
pip install -r requirements.txt
cd ../..
```

## 3. Configure environment variables

Copy the template and fill in real values from your Supabase project (Project Settings → API, and Project Settings → Database → Connection pooling):

```bash
cp .env.example .env
cp .env.example apps/web/.env
```

`apps/web/.env` only needs the three `VITE_*` keys — remove the rest. See [Environment Variables in the README](../README.md#environment-variables) for what each key is used for.

**Use the session pooler connection string, not the direct connection** — the direct host is IPv6-only and will fail to connect from most local networks.

## 4. Apply database migrations

```bash
node scripts/run-migrations.js
```

This runs every file in `db/migrations/` in numeric order against the database in your `.env`. Safe to re-run — already-applied migrations are skipped.

## 5. Seed reference data

```bash
node scripts/seed.js
```

Populates materials, vendors, historical vendor deliveries, sites, and three demo accounts (one per role — see below). Optionally, also run:

```bash
node scripts/seed-consumption.js   # synthetic daily consumption history, for LSTM training
```

## 6. Start all three services

Each runs independently, in its own terminal:

```bash
npm run dev:web     # http://localhost:5173
npm run dev:api     # http://localhost:4000
```

```bash
cd apps/ml-service
venv\Scripts\activate
uvicorn app.main:app --reload --port 8000
```

## 7. Log in

Visit `http://localhost:5173/login`. Seeded accounts (password `Nexus@2026` for all):

| Role | Email |
|---|---|
| Project Manager | `1@nexus.com` |
| Site Supervisor | `2@nexus.com` |
| Procurement | `3@nexus.com` |

## Verifying the setup

```bash
node scripts/regression-test.js   # 38 endpoint/edge-case checks
node scripts/pipeline-test.js     # 24-step end-to-end business flow, self-cleaning
```

Both scripts run against your live `.env` database and clean up any data they create.

## Production build

```bash
npm run build
```

Builds `packages/shared-types` first, then `apps/web`, then `apps/api`, in that order (each build script already sequences its own dependency on shared-types).
