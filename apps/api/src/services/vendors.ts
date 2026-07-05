import { PoolClient } from 'pg';

/** §4.2 Vendor Reliability Scoring — weighted formula, recomputed live off
 * real vendor_deliveries rows (never a stored/stale stat). Called every time
 * a delivery is logged (§6 step 10), which is also what feeds §4.8's risk
 * alert since it appends a reliability_score_history row. */
export async function recomputeVendorScore(client: PoolClient, vendorId: string) {
  const stats = await client.query(
    `select
       count(*)::int as total,
       count(*) filter (where actual_date <= promised_date)::int as on_time_count,
       count(*) filter (where complaint)::int as complaint_count,
       avg(price)::float as avg_price,
       stddev_pop(price)::float as stddev_price
     from vendor_deliveries where vendor_id = $1`,
    [vendorId]
  );
  const s = stats.rows[0];
  if (!s || s.total === 0) return null;

  const onTimePct = s.on_time_count / s.total;
  const complaintRate = s.complaint_count / s.total;
  const priceVariance = s.avg_price > 0 ? Math.min(1, s.stddev_price / s.avg_price) : 0;

  const score = (0.5 * onTimePct + 0.3 * (1 - complaintRate) + 0.2 * (1 - priceVariance)) * 100;
  const rounded = Math.round(score * 100) / 100;

  await client.query(`update vendors set reliability_score = $2 where id = $1`, [vendorId, rounded]);
  // feeds §4.8's vendor_risk_alert trigger automatically
  await client.query(`insert into reliability_score_history (vendor_id, score) values ($1, $2)`, [vendorId, rounded]);

  return { score: rounded, onTimePct, complaintRate, priceVariance };
}

/** §4.7 Lead Time Prediction, with the exact fallback chain from the spec:
 * 1) mean historical lead time for this vendor-material pair
 * 2) that vendor's average lead time across all materials
 * 3) flat 4-day default for a brand-new vendor with zero history
 * Also used at order time (§7) to auto-set promised_date. */
export async function predictLeadTime(client: PoolClient, vendorId: string, materialId: string) {
  const pairRes = await client.query(
    `select avg(actual_date - order_date)::float as avg_days, count(*)::int as n
     from vendor_deliveries where vendor_id = $1 and material_id = $2`,
    [vendorId, materialId]
  );
  if (pairRes.rows[0].n > 0) {
    return { days: Math.round(pairRes.rows[0].avg_days), isFallback: false };
  }

  const vendorRes = await client.query(
    `select avg(actual_date - order_date)::float as avg_days, count(*)::int as n
     from vendor_deliveries where vendor_id = $1`,
    [vendorId]
  );
  if (vendorRes.rows[0].n > 0) {
    return { days: Math.round(vendorRes.rows[0].avg_days), isFallback: true };
  }

  return { days: 4, isFallback: true };
}
