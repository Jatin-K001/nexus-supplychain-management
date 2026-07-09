# Restructuring Report

## Request

Reorganize the repository into a "clean, professional" structure — frontend/backend/docs at the root — with a full README, `docs/` folder, and this report.

## Decision: documentation added, folders NOT physically moved

**Original structure** (unchanged):

```
nexus/
├── apps/
│   ├── web/          # React frontend
│   ├── api/           # Node/Express backend
│   └── ml-service/    # Python/FastAPI ML service
├── packages/
│   └── shared-types/  # Shared TypeScript types
├── db/migrations/      # SQL migrations
├── scripts/             # Seeding, testing, maintenance scripts
└── package.json          # npm workspace root
```

**New structure**: identical, plus:

```
nexus/
├── docs/
│   ├── Architecture.md   # NEW
│   ├── Setup.md           # NEW
│   └── API.md              # NEW
├── .env.example            # NEW
├── RESTRUCTURING_REPORT.md  # NEW (this file)
└── README.md                 # REWRITTEN
```

### Why no files were physically moved

The requested target shape (`frontend/`, `backend/`, `docs/` at the root) assumes a two-service split. This project has **three** independently-deployed services — a React frontend, a Node API, and a separate Python ML service — plus a shared-types package. `apps/{web,api,ml-service}` + `packages/` is the standard monorepo convention for exactly this shape (the same pattern used by Turborepo, Nx, and Vercel's own monorepo docs), and is what an experienced team would already recognize as professional, not a shortcut in place of one.

Physically renaming `apps/web` → `frontend` and `apps/api` → `backend` would require, at minimum:
- Rewriting `apps/web/vercel.json`'s implicit root-dir assumption and the Vercel project's configured root directory (the live deployment reads this)
- Rewriting every relative import between `packages/shared-types` and its two consumers
- Rewriting `tsconfig.json` path references in both `apps/web` and `apps/api`
- Rewriting the root `package.json` workspace globs and every `--workspace=apps/...` script
- Re-verifying the production build and the live Vercel deployment end-to-end

That is real, non-trivial engineering work with a real chance of breaking the live deployment, undertaken the night before a project review, for a change that is cosmetic rather than substantive — the current structure does not have an organizational problem to fix. Given that tradeoff, this was flagged to the user, who confirmed: keep the structure, do the documentation.

### What actually changed

| File | Action | Reason |
|---|---|---|
| `README.md` | Rewritten | Was a single line (project name only). Now covers overview, tech stack, architecture, folder structure, file responsibilities, request/data flow, setup, env vars, features, workflow, future scope. |
| `docs/Architecture.md` | Created | System design rationale — service split, global stock pool, concurrency handling, cascade engine, forecasting, auth model. |
| `docs/Setup.md` | Created | Step-by-step install/run instructions, expanded from the README's condensed version. |
| `docs/API.md` | Created | Full endpoint reference for both `apps/api` and `apps/ml-service`, derived directly from the route source files (not guessed). |
| `.env.example` | Created | Sanitized template of every environment variable actually read by the codebase, with real secrets stripped. |

No source file was moved, renamed, or had its import paths changed. No `package.json` script was changed.

## Assumptions

- "Professional structure" was interpreted as *clear, well-documented, and conventional for the project's actual shape* — not as *matching a generic frontend/backend template regardless of fit*.
- The live Vercel deployment (referenced by the `apps/web/vercel.json` rewrite rule) is presumed to still be in use for the review and was treated as something not to risk breaking.

## Functionality confirmation

No application code was moved or edited as part of this restructuring. `npm run dev:web`, `npm run dev:api`, `npm run build`, and the ML service's `uvicorn` command all run exactly as before, from the exact same paths. The only unrelated code change already in this branch's history is the PM dashboard KPI swap (`apps/web/src/pages/pm/Dashboard.tsx`, committed separately), which was verified live in-browser before this restructuring work began.
