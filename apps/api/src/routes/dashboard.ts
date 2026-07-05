import { Router } from 'express';
import { pool } from '../db';
import { requireAuth } from '../middleware/auth';
import { asyncHandler } from '../middleware/asyncHandler';

export const dashboardRouter = Router();

// §5.3 Multi-Project Risk Dashboard — the PM·02 KPI row.
dashboardRouter.get('/risk-summary', requireAuth, asyncHandler(async (_req, res) => {
  const atRiskMaterials = await pool.query(
    `select count(distinct (df.project_id, df.material_id))::int as n
     from demand_forecasts df
     join subphase_materials sm on sm.material_id = df.material_id
     join subphases s on s.id = sm.subphase_id and s.status != 'complete'
     where sm.required_by_date is not null and df.predicted_shortfall_date <= sm.required_by_date`
  );
  const delayedPhases = await pool.query(`select count(*)::int as n from phases where delay_days > 0`);
  const avgReliability = await pool.query(`select avg(reliability_score)::float as avg from vendors`);
  const delayCost = await pool.query(
    `select coalesce(sum(greatest(0, (projected_end_date - target_end_date)) * daily_cost_estimate), 0)::float as total
     from projects where projected_end_date is not null`
  );

  res.json({
    at_risk_material_count: atRiskMaterials.rows[0].n,
    delayed_phase_count: delayedPhases.rows[0].n,
    avg_vendor_reliability: avgReliability.rows[0].avg ? Math.round(avgReliability.rows[0].avg * 100) / 100 : null,
    estimated_delay_cost: delayCost.rows[0].total,
  });
}));

// §5.7 Historical Delay Pattern Analysis — feeds PM·08 Reports.
dashboardRouter.get('/delay-patterns', requireAuth, asyncHandler(async (_req, res) => {
  const r = await pool.query(`select * from delay_patterns order by occurrence_count desc`);
  res.json(r.rows);
}));

// §5.9 Buffer/Float Recommendation — combines critical-path slack (ml-service,
// queried separately per project) with historical pattern frequency to
// suggest a schedule buffer at fragile phase transitions (PM·09 banner).
dashboardRouter.get('/buffer-recommendation/:phaseName', requireAuth, asyncHandler(async (req, res) => {
  const r = await pool.query(
    `select cause, occurrence_count, avg_delay_days from delay_patterns
     where phase_name = $1 order by occurrence_count desc limit 1`,
    [req.params.phaseName]
  );
  if (r.rowCount === 0) {
    return res.json({ phase_name: req.params.phaseName, suggested_buffer_days: 0, reason: 'no historical delay pattern for this phase' });
  }
  const { cause, occurrence_count, avg_delay_days } = r.rows[0];
  const suggestedBuffer = occurrence_count >= 2 ? Math.ceil(Number(avg_delay_days)) : 0;
  res.json({
    phase_name: req.params.phaseName,
    suggested_buffer_days: suggestedBuffer,
    reason: suggestedBuffer > 0
      ? `${req.params.phaseName} has delayed ${occurrence_count}x historically (avg cause: ${cause}, avg ${avg_delay_days} days)`
      : 'not enough historical occurrences to justify a buffer',
  });
}));

// §5.10 Resource/Labor Conflict Detection — overlapping date ranges on the
// same resource across projects, checked whenever a cascade shifts dates.
dashboardRouter.get('/resource-conflicts', requireAuth, asyncHandler(async (_req, res) => {
  const r = await pool.query(
    `select a.id as a_id, a.resource_name, a.project_id as a_project, a.start_date as a_start, a.end_date as a_end,
            b.id as b_id, b.project_id as b_project, b.start_date as b_start, b.end_date as b_end
     from resource_assignments a
     join resource_assignments b on a.resource_name = b.resource_name and a.id < b.id
     where a.start_date <= b.end_date and b.start_date <= a.end_date`
  );
  res.json(r.rows);
}));
