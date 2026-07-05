import { Router } from 'express';
import { pool } from '../db';
import { requireAuth, requireRole, AuthedRequest } from '../middleware/auth';
import { asyncHandler } from '../middleware/asyncHandler';

export const demandForecastsRouter = Router();

// §4.1: serves the cached LSTM/fallback predictions — never computed live here.
demandForecastsRouter.get('/', requireAuth, asyncHandler(async (req, res) => {
  const { project_id } = req.query;
  const params: any[] = [];
  let where = '1=1';
  if (project_id) {
    params.push(project_id);
    where = `df.project_id = $${params.length}`;
  }
  const r = await pool.query(
    `select df.*, m.name as material_name, m.category, pr.name as project_name
     from demand_forecasts df
     join materials m on m.id = df.material_id
     join projects pr on pr.id = df.project_id
     where ${where}
     order by df.predicted_shortfall_date asc`,
    params
  );
  res.json(r.rows);
}));

// Site Supervisor's "Log Consumption" action (§1 role table). Feeds the next
// offline LSTM training run — this endpoint never retrains the model itself.
demandForecastsRouter.post('/consumption', requireAuth, requireRole('supervisor'), asyncHandler(async (req: AuthedRequest, res) => {
  const { project_id, material_id, subphase_id, log_date, quantity } = req.body ?? {};
  if (!project_id || !material_id || !log_date || quantity == null) {
    return res.status(422).json({ error: 'project_id, material_id, log_date, quantity are required' });
  }
  const r = await pool.query(
    `insert into consumption_logs (project_id, material_id, subphase_id, log_date, quantity, logged_by)
     values ($1,$2,$3,$4,$5,$6) returning *`,
    [project_id, material_id, subphase_id ?? null, log_date, quantity, req.user!.id]
  );
  res.status(201).json(r.rows[0]);
}));
