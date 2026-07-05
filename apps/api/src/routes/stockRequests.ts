import { Router } from 'express';
import { pool } from '../db';
import { requireAuth, requireRole, AuthedRequest } from '../middleware/auth';
import { asyncHandler } from '../middleware/asyncHandler';

export const stockRequestsRouter = Router();

// §6: role-scoped queue. Procurement must NEVER see a pending_pm_approval
// request — enforced here at the query level, not just hidden in the UI.
stockRequestsRouter.get('/', requireAuth, asyncHandler(async (req: AuthedRequest, res) => {
  const role = req.user!.role;
  let where = '1=1';
  const params: any[] = [];

  if (role === 'procurement') {
    where = `sr.status in ('approved','sourced','fulfilled')`;
  } else if (role === 'supervisor') {
    params.push(req.user!.id);
    where = `sr.created_by = $${params.length}`;
  }
  // pm sees everything (their queue is filtered client-side by status=pending_pm_approval)

  const r = await pool.query(
    `select sr.*, m.name as material_name, m.unit, s.name as subphase_name,
            p.name as phase_name, pr.name as project_name
     from stock_requests sr
     join materials m on m.id = sr.material_id
     join subphases s on s.id = sr.subphase_id
     join phases p on p.id = s.phase_id
     join projects pr on pr.id = p.project_id
     where ${where}
     order by sr.created_at desc`,
    params
  );
  res.json(r.rows);
}));

stockRequestsRouter.get('/:id', requireAuth, asyncHandler(async (req, res) => {
  const r = await pool.query(
    `select sr.*, m.name as material_name, m.unit, s.name as subphase_name,
            p.name as phase_name, pr.name as project_name
     from stock_requests sr
     join materials m on m.id = sr.material_id
     join subphases s on s.id = sr.subphase_id
     join phases p on p.id = s.phase_id
     join projects pr on pr.id = p.project_id
     where sr.id = $1`,
    [req.params.id]
  );
  if (r.rowCount === 0) return res.status(404).json({ error: 'Not found' });
  res.json(r.rows[0]);
}));

// §6 step 3: PM approval is the ONLY way a request becomes visible to Procurement.
// Atomic conditional UPDATE (not check-then-act) so two concurrent approve
// clicks can't both succeed — the WHERE clause itself is the concurrency guard.
stockRequestsRouter.post('/:id/approve', requireAuth, requireRole('pm'), asyncHandler(async (req: AuthedRequest, res) => {
  const r = await pool.query(
    `update stock_requests set status = 'approved', approved_by = $2, approved_at = now()
     where id = $1 and status = 'pending_pm_approval' returning id`,
    [req.params.id, req.user!.id]
  );
  if (r.rowCount === 0) {
    const exists = await pool.query(`select status from stock_requests where id = $1`, [req.params.id]);
    if (exists.rowCount === 0) return res.status(404).json({ error: 'Not found' });
    return res.status(409).json({ error: `Cannot approve a request in status '${exists.rows[0].status}'` });
  }
  res.json({ ok: true });
}));

stockRequestsRouter.post('/:id/dismiss', requireAuth, requireRole('pm'), asyncHandler(async (req, res) => {
  const r = await pool.query(
    `update stock_requests set status = 'rejected' where id = $1 and status = 'pending_pm_approval' returning id`,
    [req.params.id]
  );
  if (r.rowCount === 0) {
    const exists = await pool.query(`select status from stock_requests where id = $1`, [req.params.id]);
    if (exists.rowCount === 0) return res.status(404).json({ error: 'Not found' });
    return res.status(409).json({ error: `Cannot dismiss a request in status '${exists.rows[0].status}'` });
  }
  res.json({ ok: true });
}));
