import { Router } from 'express';
import { pool } from '../db';
import { startSubphase, endSubphase, previewNextUnlocks, HttpError } from '../services/lifecycle';
import { requireAuth, requireRole, AuthedRequest } from '../middleware/auth';
import { asyncHandler } from '../middleware/asyncHandler';

export const subphasesRouter = Router();

// GET /api/subphases/:id — detail incl. materials, for SUP·04/PM·05 style screens
subphasesRouter.get('/:id', requireAuth, asyncHandler(async (req, res) => {
  const sub = await pool.query(
    `select s.*, p.name as phase_name, p.project_id
     from subphases s join phases p on p.id = s.phase_id where s.id = $1`,
    [req.params.id]
  );
  if (sub.rowCount === 0) return res.status(404).json({ error: 'Not found' });
  // quantity_in_stock is the global, Procurement-owned pool (materials.stock_on_hand)
  // — every subphase reads the same number, not a private per-subphase figure.
  const materials = await pool.query(
    `select m.id as material_id, m.name, m.unit, sm.quantity_required, m.stock_on_hand as quantity_in_stock, sm.required_by_date
     from subphase_materials sm join materials m on m.id = sm.material_id where sm.subphase_id = $1`,
    [req.params.id]
  );
  res.json({ ...sub.rows[0], materials: materials.rows });
}));

// GET /api/subphases/:id/next — preview of what unlocks next, so the
// Activate form can say "this sets the start date for X" before it happens.
subphasesRouter.get('/:id/next', requireAuth, asyncHandler(async (req, res) => {
  const cur = await pool.query(`select phase_id from subphases where id = $1`, [req.params.id]);
  if (cur.rowCount === 0) return res.status(404).json({ error: 'Not found' });
  const subs = await pool.query(
    `select id, phase_id, name, sequence, parallel_group, unlock_type, planned_start, planned_end, status
     from subphases where phase_id = $1 order by sequence asc`,
    [cur.rows[0].phase_id]
  );
  const nextIds = previewNextUnlocks(subs.rows as any, req.params.id);
  res.json(subs.rows.filter((s) => nextIds.includes(s.id)).map((s) => ({ id: s.id, name: s.name, planned_start: s.planned_start })));
}));

// POST /api/subphases/:id/start — §3.1, Site Supervisor only.
// body: { next_start_date? } — pre-sets the start date for whatever unlocks
// once this subphase ends, so the supervisor doesn't need a separate step later.
subphasesRouter.post('/:id/start', requireAuth, requireRole('supervisor'), async (req, res) => {
  try {
    const result = await startSubphase(req.params.id, req.body?.next_start_date);
    res.json(result);
  } catch (err) {
    handleError(err, res);
  }
});

// POST /api/subphases/:id/end — §3.2, body: { actual_end, delay_cause?, next_start_date? }
// Ending always auto-activates whatever unlocks next — never leaves it in a
// separate "available, needs manual start" state.
subphasesRouter.post('/:id/end', requireAuth, requireRole('supervisor'), async (req: AuthedRequest, res) => {
  const { actual_end, delay_cause, next_start_date } = req.body ?? {};
  if (!actual_end) return res.status(422).json({ error: 'actual_end (YYYY-MM-DD) is required' });
  try {
    const result = await endSubphase(req.params.id, { actualEndDate: actual_end, delayCause: delay_cause, nextStartDate: next_start_date });
    res.json(result);
  } catch (err) {
    handleError(err, res);
  }
});

// POST /api/subphases/:id/materials — §3.3 "stock setup" (SUP·08→SUP·11):
// assigns how much of a material this subphase needs. The "in stock" side is
// no longer set here — that's the global pool Procurement owns (materials
// .stock_on_hand, updated on delivery) — so only quantity_required is a
// per-subphase figure now.
subphasesRouter.post('/:id/materials', requireAuth, requireRole('supervisor'), asyncHandler(async (req, res) => {
  const { material_id, quantity_required } = req.body ?? {};
  if (!material_id || quantity_required == null) {
    return res.status(422).json({ error: 'material_id, quantity_required are required' });
  }
  const r = await pool.query(
    `insert into subphase_materials (subphase_id, material_id, quantity_required, quantity_in_stock)
     values ($1,$2,$3,0)
     on conflict (subphase_id, material_id)
     do update set quantity_required = excluded.quantity_required
     returning subphase_materials.*, (select stock_on_hand from materials where id = $2) as stock_on_hand`,
    [req.params.id, material_id, quantity_required]
  );
  res.status(201).json(r.rows[0]);
}));

function handleError(err: unknown, res: any) {
  if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });
  console.error(err);
  res.status(500).json({ error: 'Internal error' });
}
