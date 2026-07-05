import { Router } from 'express';
import { pool } from '../db';
import { requireAuth } from '../middleware/auth';
import { asyncHandler } from '../middleware/asyncHandler';

export const materialsRouter = Router();

materialsRouter.get('/', requireAuth, asyncHandler(async (_req, res) => {
  const r = await pool.query(`select * from materials order by name`);
  res.json(r.rows);
}));

// §4.5 Reorder Point Automation: reorder_point = avg_daily_consumption *
// (avg_lead_time + safety_buffer), safety_buffer scales with that
// vendor-material pair's historical lead-time variance.
materialsRouter.get('/:id/reorder-point', requireAuth, asyncHandler(async (req, res) => {
  const { vendor_id, project_id } = req.query;
  if (!vendor_id) return res.status(422).json({ error: 'vendor_id query param is required' });

  const consumption = await pool.query(
    `select avg(quantity)::float as avg_daily from consumption_logs
     where material_id = $1 ${project_id ? 'and project_id = $2' : ''}`,
    project_id ? [req.params.id, project_id] : [req.params.id]
  );
  const avgDailyConsumption = consumption.rows[0].avg_daily ?? 0;

  const leadStats = await pool.query(
    `select avg(actual_date - order_date)::float as avg_lead, stddev_pop(actual_date - order_date)::float as stddev_lead
     from vendor_deliveries where vendor_id = $1 and material_id = $2`,
    [vendor_id, req.params.id]
  );
  const avgLeadTime = leadStats.rows[0].avg_lead ?? 4;
  const leadVariance = leadStats.rows[0].stddev_lead ?? 0;
  const safetyBuffer = leadVariance; // higher historical variance -> bigger buffer

  const reorderPoint = avgDailyConsumption * (avgLeadTime + safetyBuffer);
  res.json({
    material_id: req.params.id,
    vendor_id,
    avg_daily_consumption: avgDailyConsumption,
    avg_lead_time_days: avgLeadTime,
    safety_buffer_days: safetyBuffer,
    reorder_point: Math.round(reorderPoint * 100) / 100,
  });
}));

// §4.9 Price Anomaly Detection: flag a quote > 2 stddev from trailing mean.
materialsRouter.post('/:id/check-price', requireAuth, asyncHandler(async (req, res) => {
  const { price } = req.body ?? {};
  if (price == null) return res.status(422).json({ error: 'price is required' });

  const stats = await pool.query(
    `select avg(price)::float as mean, stddev_pop(price)::float as stddev
     from vendor_deliveries where material_id = $1`,
    [req.params.id]
  );
  const { mean, stddev } = stats.rows[0];
  if (mean == null || stddev == null || stddev === 0) {
    return res.json({ is_anomaly: false, reason: 'insufficient price history' });
  }
  const deviations = Math.abs(price - mean) / stddev;
  res.json({
    is_anomaly: deviations > 2,
    deviations_from_mean: Math.round(deviations * 100) / 100,
    trailing_mean: Math.round(mean * 100) / 100,
  });
}));

// §4.10 Material Substitution Suggestions
materialsRouter.get('/:id/substitutes', requireAuth, asyncHandler(async (req, res) => {
  const r = await pool.query(
    `select ms.id, m2.id as material_id, m2.name, m2.unit, ms.note
     from material_substitutes ms join materials m2 on m2.id = ms.substitute_material_id
     where ms.material_id = $1`,
    [req.params.id]
  );
  res.json(r.rows);
}));
