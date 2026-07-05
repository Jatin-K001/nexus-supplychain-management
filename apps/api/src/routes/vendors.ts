import { Router } from 'express';
import { pool } from '../db';
import { requireAuth } from '../middleware/auth';
import { asyncHandler } from '../middleware/asyncHandler';
import { predictLeadTime } from '../services/vendors';

export const vendorsRouter = Router();

// PROC·09 Vendor Management — includes each vendor's most recent score
// change (the "▲2 SINCE LAST" / "86 → 88" badges), sourced from the same
// reliability_score_history rows the risk-alert trigger reads (§4.8).
vendorsRouter.get('/', requireAuth, asyncHandler(async (_req, res) => {
  const vendors = await pool.query(`select * from vendors order by reliability_score desc`);
  const trends = await pool.query(`
    select vendor_id, score, recorded_at,
           row_number() over (partition by vendor_id order by recorded_at desc) as rn
    from reliability_score_history
  `);
  const latestByVendor = new Map<string, number>();
  const prevByVendor = new Map<string, number>();
  for (const row of trends.rows) {
    if (row.rn === '1') latestByVendor.set(row.vendor_id, Number(row.score));
    if (row.rn === '2') prevByVendor.set(row.vendor_id, Number(row.score));
  }
  res.json(
    vendors.rows.map((v) => ({
      ...v,
      score_trend: prevByVendor.has(v.id) ? latestByVendor.get(v.id)! - prevByVendor.get(v.id)! : null,
      previous_score: prevByVendor.get(v.id) ?? null,
    }))
  );
}));

// PROC·04 Vendor Detail — composite score breakdown + delivery history timeline
vendorsRouter.get('/:id', requireAuth, asyncHandler(async (req, res) => {
  const vendor = await pool.query(`select * from vendors where id = $1`, [req.params.id]);
  if (vendor.rowCount === 0) return res.status(404).json({ error: 'Not found' });

  const materials = await pool.query(
    `select m.name, m.id from vendor_materials vm join materials m on m.id = vm.material_id where vm.vendor_id = $1`,
    [req.params.id]
  );

  const stats = await pool.query(
    `select
       count(*)::int as total,
       count(*) filter (where actual_date <= promised_date)::float / nullif(count(*), 0) as on_time_pct,
       count(*) filter (where complaint)::int as complaints,
       avg(price)::float as avg_price,
       stddev_pop(price)::float as stddev_price,
       avg(actual_date - order_date)::float as avg_lead_days,
       max(actual_date) as last_delivery
     from vendor_deliveries where vendor_id = $1`,
    [req.params.id]
  );
  const s = stats.rows[0];
  const priceStability = s.avg_price > 0 ? Math.round((1 - Math.min(1, s.stddev_price / s.avg_price)) * 100) : null;

  const history = await pool.query(
    `select vd.actual_date, vd.promised_date, vd.qty_delivered, vd.complaint, m.name as material_name, m.unit
     from vendor_deliveries vd join materials m on m.id = vd.material_id
     where vd.vendor_id = $1 order by vd.actual_date desc limit 10`,
    [req.params.id]
  );

  res.json({
    ...vendor.rows[0],
    materials_supplied: materials.rows.map((m) => m.name),
    total_orders: s.total,
    on_time_pct: s.on_time_pct != null ? Math.round(s.on_time_pct * 100) : null,
    complaints: s.complaints,
    price_stability_pct: priceStability,
    avg_lead_time_days: s.avg_lead_days != null ? Math.round(s.avg_lead_days) : null,
    last_delivery: s.last_delivery,
    delivery_history: history.rows,
  });
}));

// §4.6 Vendor Comparison Engine — every vendor supplying a material joined
// with live reliability score, latest price, and predicted lead time (§4.7).
// §4.8's trend badge ("▼6 SINCE LAST") comes along for free from the same join.
vendorsRouter.get('/compare/:materialId', requireAuth, asyncHandler(async (req, res) => {
  const vendorsRes = await pool.query(
    `select v.id, v.name, v.reliability_score, vm.avg_price
     from vendor_materials vm
     join vendors v on v.id = vm.vendor_id
     where vm.material_id = $1
     order by v.reliability_score desc`,
    [req.params.materialId]
  );

  const rows = [];
  for (const v of vendorsRes.rows) {
    const lead = await predictLeadTime(pool as any, v.id, req.params.materialId);

    const history = await pool.query(
      `select score from reliability_score_history where vendor_id = $1 order by recorded_at desc limit 2`,
      [v.id]
    );
    const trend = history.rows.length === 2 ? Number(history.rows[0].score) - Number(history.rows[1].score) : null;

    const breakdown = await pool.query(
      `select
         count(*) filter (where actual_date <= promised_date)::float / nullif(count(*), 0) as on_time_pct,
         count(*) filter (where complaint)::float / nullif(count(*), 0) as complaint_rate
       from vendor_deliveries where vendor_id = $1 and material_id = $2`,
      [v.id, req.params.materialId]
    );

    rows.push({
      vendor_id: v.id,
      vendor_name: v.name,
      reliability_score: Number(v.reliability_score),
      on_time_pct: breakdown.rows[0].on_time_pct != null ? Math.round(breakdown.rows[0].on_time_pct * 100) : null,
      complaint_rate: breakdown.rows[0].complaint_rate != null ? Math.round(breakdown.rows[0].complaint_rate * 100) : null,
      latest_price: v.avg_price,
      predicted_lead_time_days: lead.days,
      lead_time_is_fallback: lead.isFallback,
      score_trend_since_last: trend,
    });
  }

  res.json(rows);
}));
