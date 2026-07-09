# API Reference

Base URL: `http://localhost:4000` (dev) — every route below is prefixed with this.

All routes except `/health` require `Authorization: Bearer <supabase-jwt>`. Routes marked **[role]** additionally require the caller's profile role to match.

---

## Auth

| Method | Path | Description |
|---|---|---|
| GET | `/health` | Liveness check, no auth |
| GET | `/api/me` | Returns the caller's resolved profile (id, role, full_name) |

---

## Projects — `apps/api/src/routes/projects.ts`

| Method | Path | Description |
|---|---|---|
| GET | `/api/projects` | List projects. Supervisors see only projects with a subphase assigned to them; PM/Procurement see all. |
| GET | `/api/projects/:id` | Single project detail |
| GET | `/api/projects/:id/phases` | All 10 phases for a project |
| POST | `/api/projects` **[pm]** | Create a project — auto-generates the full 10-phase / 97-subphase template with proportionally distributed planned dates |

## Phases — `phases.ts`

| Method | Path | Description |
|---|---|---|
| GET | `/api/phases/:id/subphases` | Subphases within a phase |
| GET | `/api/phases/:id/subphases-with-materials` | Same, with each subphase's required materials joined in |

## Subphases — `subphases.ts`

| Method | Path | Description |
|---|---|---|
| GET | `/api/subphases/:id` | Subphase detail, including live stock availability |
| GET | `/api/subphases/:id/next` | The next subphase in sequence, per its unlock type |
| POST | `/api/subphases/:id/start` **[supervisor]** | Start a subphase — blocked if required stock is short |
| POST | `/api/subphases/:id/end` **[supervisor]** | End a subphase — attempts to auto-start the next eligible one if stock permits |
| POST | `/api/subphases/:id/materials` **[supervisor]** | Log material consumption against a subphase |

## Stock Requests — `stockRequests.ts`

| Method | Path | Description |
|---|---|---|
| GET | `/api/stock-requests` | List stock requests (role-scoped) |
| GET | `/api/stock-requests/:id` | Single stock request |
| POST | `/api/stock-requests/:id/approve` **[pm]** | Approve — atomic conditional update, safe under concurrent approval attempts |
| POST | `/api/stock-requests/:id/dismiss` **[pm]** | Reject a request |

## Purchase Orders — `purchaseOrders.ts`

| Method | Path | Description |
|---|---|---|
| GET | `/api/purchase-orders` | List purchase orders |
| GET | `/api/purchase-orders/:id` | Single purchase order |
| POST | `/api/purchase-orders` **[procurement]** | Place an order against an approved stock request; `promised_date` auto-set via lead-time prediction |
| POST | `/api/purchase-orders/:id/deliver` **[procurement]** | Log delivery — inserts a `vendor_deliveries` row, recomputes the vendor's reliability score, and increments the global stock pool |

## Vendors — `vendors.ts`

| Method | Path | Description |
|---|---|---|
| GET | `/api/vendors` | List vendors with current reliability scores |
| GET | `/api/vendors/:id` | Vendor detail, including delivery history |
| GET | `/api/vendors/compare/:materialId` | Side-by-side comparison of vendors who supply a given material |

## Materials — `materials.ts`

| Method | Path | Description |
|---|---|---|
| GET | `/api/materials` | List materials with current global stock |
| GET | `/api/materials/:id/reorder-point` | Computed reorder point for a material |
| POST | `/api/materials/:id/check-price` | Checks current price against forecast/history |
| GET | `/api/materials/:id/substitutes` | Substitute materials, when the preferred one is scarce |

## Material Requirements — `materialRequirements.ts`

| Method | Path | Description |
|---|---|---|
| GET | `/api/material-requirements` | Aggregated material demand across all active projects |

## Demand Forecasts — `demandForecasts.ts`

| Method | Path | Description |
|---|---|---|
| GET | `/api/demand-forecasts` | LSTM-predicted demand per project/material |
| POST | `/api/demand-forecasts/consumption` **[supervisor]** | Log daily consumption (also the LSTM's training signal) |

## Dashboard — `dashboard.ts`

| Method | Path | Description |
|---|---|---|
| GET | `/api/dashboard/risk-summary` | PM dashboard KPIs — delayed phase count, avg vendor reliability, at-risk materials, delay cost |
| GET | `/api/dashboard/delay-patterns` | Historical delay pattern analysis |
| GET | `/api/dashboard/buffer-recommendation/:phaseName` | Suggested schedule buffer for a phase, from historical delay frequency |
| GET | `/api/dashboard/resource-conflicts` | Overlapping resource assignments across projects |

## Notifications — `notifications.ts`

| Method | Path | Description |
|---|---|---|
| GET | `/api/notifications` | Caller's notification feed |
| POST | `/api/notifications/:id/read` | Mark a notification read |

## Sites — `sites.ts`

| Method | Path | Description |
|---|---|---|
| GET | `/api/sites` | List construction sites |

## ML Proxy — `mlProxy.ts` (forwards to `apps/ml-service`)

| Method | Path | Description |
|---|---|---|
| GET | `/api/ml/critical-path/:projectId` | Proxies to ML service's `/critical-path/{project_id}` |
| POST | `/api/ml/purchase-recommendations/generate` **[pm, procurement]** | Proxies to ML service's `/purchase-recommendations/generate` |

---

## ML Service — `apps/ml-service` (internal, called only by `apps/api`)

Base URL: `http://localhost:8000`. Not exposed to the frontend directly.

| Method | Path | Description |
|---|---|---|
| GET | `/health` | Liveness check |
| POST | `/cascade/recalculate` | Body: `{ project_id }`. Recomputes delay propagation for a project. |
| GET | `/price/forecast/{material_id}` | Holt-Winters price forecast for a material |
| GET | `/critical-path/{project_id}` | networkx critical-path computation for a project |
| POST | `/purchase-recommendations/generate` | Generates purchase recommendations from current demand forecasts |

---

## Auth model

Every `apps/api` route (except `/health`) runs `requireAuth`: it reads the `Authorization: Bearer <token>` header, verifies it against Supabase (`supabaseAdmin.auth.getUser`), then loads the caller's role from the `profiles` table by the verified user id. Routes marked **[role]** additionally run `requireRole(...role)`, returning `403` if the caller's role isn't in the allowed list. The role is never read from the request body or client-supplied headers — only from the database record tied to the verified Supabase user id.
