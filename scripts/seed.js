// Full seed data loader — NEXUS_BUILD_SPEC.md §14. Idempotent: truncates and
// reloads every app table on each run, safe to re-run before every demo.
require('dotenv').config({ path: __dirname + '/../.env' });
const { Client } = require('pg');
const { createClient } = require('@supabase/supabase-js');
const { PHASES } = require('../db/phaseTemplate');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supa = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

const pg = new Client({
  host: 'aws-1-ap-south-1.pooler.supabase.com',
  port: 5432,
  user: 'postgres.voxwhdueseuqjgqlgapb',
  password: 'Sama@Tarun1312',
  database: 'postgres',
  ssl: { rejectUnauthorized: false },
});

const TODAY = new Date('2026-07-04');
const daysAgo = (n) => { const d = new Date(TODAY); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); };
const addDays = (dateStr, n) => { const d = new Date(dateStr); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };

// ── §14.11 Users ──────────────────────────────────────────────────────
const USERS = [
  { email: '1@nexus.com', name: 'Sanjay Kumar', role: 'pm' },
  { email: '2@nexus.com', name: 'Rajesh N.', role: 'supervisor' },
  { email: '3@nexus.com', name: 'Anjali Pillai', role: 'procurement' },
];
const PASSWORD = 'Nexus@2026';

async function upsertAuthUser(email, name) {
  const { data, error } = await supa.auth.admin.createUser({
    email, password: PASSWORD, email_confirm: true, user_metadata: { full_name: name },
  });
  if (!error) return data.user.id;
  // already exists — look it up and reset password so it's always known-good
  const { data: list, error: listErr } = await supa.auth.admin.listUsers({ perPage: 200 });
  if (listErr) throw listErr;
  const existing = list.users.find((u) => u.email === email);
  if (!existing) throw error;
  await supa.auth.admin.updateUserById(existing.id, { password: PASSWORD });
  return existing.id;
}

// ── §14.4 Materials — stock_on_hand is the ONE global pool per material,
// owned by Procurement (§ global stock request). Shuttering Plates starts at
// 0 on purpose — that's what makes the Tower B flagship scenario (§14.7.3,
// SR#104) reproducible on fresh seed.
const MATERIALS = [
  ['TMT Steel Bars (12mm)', 'Steel', 'ton', 5],
  ['Cement (OPC 53)', 'Cement', 'bag', 40],
  ['Shuttering Plates (18mm ply)', 'Shuttering', 'unit', 0],
  ['Electrical Conduit', 'Electrical', 'meter', 100],
  ['Electrical Fittings', 'Electrical', 'lot', 5],
  ['Sand (River, Fine)', 'Aggregate', 'ton', 10],
  ['Aggregate (20mm)', 'Aggregate', 'ton', 10],
  ['Waterproofing Compound', 'Finishing', 'drum', 10],
  ['Paint (Exterior Emulsion)', 'Finishing', 'liter', 50],
  ['Plumbing Fittings (PVC)', 'Plumbing', 'lot', 5],
];

// ── §14.1 Vendor roster — [vendorLetter, material, score, onTimePct, complaints, price, leadTimeDays, totalOrders]
const VENDOR_ROWS = [
  ['A', 'TMT Steel Bars (12mm)', 88, 96, 0, 410, 4, 34],
  ['C', 'TMT Steel Bars (12mm)', 74, 84, 1, 398, 6, 27],
  ['E', 'TMT Steel Bars (12mm)', 92, 98, 0, 425, 3, 41],
  ['F', 'TMT Steel Bars (12mm)', 81, 90, 1, 405, 5, 23],
  ['G', 'TMT Steel Bars (12mm)', 69, 79, 2, 388, 7, 19],
  ['H', 'TMT Steel Bars (12mm)', 58, 68, 3, 375, 9, 16],
  ['I', 'TMT Steel Bars (12mm)', 51, 61, 4, 365, 10, 12],
  ['J', 'TMT Steel Bars (12mm)', 45, 54, 4, 358, 11, 14],
  ['K', 'TMT Steel Bars (12mm)', 37, 46, 6, 350, 13, 9],
  ['L', 'TMT Steel Bars (12mm)', 29, 38, 7, 340, 15, 11],

  ['A', 'Cement (OPC 53)', 88, 96, 0, 345, 4, 34],
  ['N', 'Cement (OPC 53)', 83, 92, 0, 352, 4, 22],
  ['F', 'Cement (OPC 53)', 81, 90, 1, 340, 5, 23],
  ['D', 'Cement (OPC 53)', 42, 45, 6, 330, 12, 18],
  ['P', 'Cement (OPC 53)', 65, 75, 2, 336, 8, 13],

  ['N', 'Shuttering Plates (18mm ply)', 83, 92, 0, 412, 4, 22],
  ['C', 'Shuttering Plates (18mm ply)', 74, 84, 1, 398, 6, 27],
  ['G', 'Shuttering Plates (18mm ply)', 69, 79, 2, 388, 7, 19],
  ['W', 'Shuttering Plates (18mm ply)', 55, 64, 3, 360, 9, 10],

  ['M', 'Electrical Conduit', 76, 86, 1, 172, 5, 15],
  ['B', 'Electrical Conduit', 61, 70, 3, 185, 8, 21],
  ['V', 'Electrical Conduit', 55, 63, 4, 165, 9, 8],

  ['M', 'Electrical Fittings', 76, 86, 1, 1240, 5, 15],
  ['B', 'Electrical Fittings', 61, 70, 3, 1180, 8, 21],
  ['U', 'Electrical Fittings', 77, 87, 1, 1260, 6, 17],

  ['O', 'Sand (River, Fine)', 79, 89, 1, 1850, 3, 20],
  ['P', 'Sand (River, Fine)', 65, 75, 2, 1780, 5, 13],
  ['X', 'Sand (River, Fine)', 48, 56, 4, 1700, 8, 9],

  ['O', 'Aggregate (20mm)', 79, 89, 1, 1620, 3, 20],
  ['P', 'Aggregate (20mm)', 65, 75, 2, 1560, 5, 13],
  ['X', 'Aggregate (20mm)', 48, 56, 4, 1500, 8, 9],

  ['Q', 'Waterproofing Compound', 87, 94, 0, 2400, 4, 18],
  ['R', 'Waterproofing Compound', 72, 82, 2, 2250, 6, 11],

  ['S', 'Paint (Exterior Emulsion)', 90, 95, 0, 310, 3, 25],
  ['R', 'Paint (Exterior Emulsion)', 72, 82, 2, 295, 6, 11],
  ['Y', 'Paint (Exterior Emulsion)', 60, 69, 3, 280, 8, 9],

  ['U', 'Plumbing Fittings (PVC)', 77, 87, 1, 980, 6, 17],
  ['T', 'Plumbing Fittings (PVC)', 68, 78, 2, 920, 8, 12],
];

// ── §14.3 Reliability score history (explicit examples) ────────────────
const SCORE_HISTORY = [
  ['K', '2026-04-01', 58],
  ['K', '2026-05-01', 49],
  ['K', '2026-06-01', 41],
  ['K', '2026-07-01', 37],
  ['A', '2026-05-01', 85],
  ['A', '2026-06-01', 86],
  ['A', '2026-07-04', 88],
];

// ── §14.5 Price history (explicit 6-week curves; index base 100) ───────
const PRICE_CURVES = {
  'TMT Steel Bars (12mm)': [100, 103, 107, 112, 118, 121],
  'Cement (OPC 53)': [100, 101, 99, 98, 97, 96],
  'Shuttering Plates (18mm ply)': [100, 102, 101, 103, 104, 106],
};
// remaining materials: flat/mild-noise synthetic curve, documented as bootstrap-only
const FLAT_CURVE = [100, 100, 101, 100, 101, 100];

// ── §14.6 Projects ───────────────────────────────────────────────────
const PROJECTS = [
  { name: 'Tower B — Structural', city: 'Hyderabad', start: '2026-01-15', targetEnd: '2027-04-15', projectedEnd: '2027-04-20', currentPhaseNo: 3, status: 'delayed', dailyCost: 85000 },
  { name: 'Lakeview Phase 2', city: 'Hyderabad', start: '2025-10-01', targetEnd: '2027-01-01', projectedEnd: '2027-01-01', currentPhaseNo: 6, status: 'on_track', dailyCost: 72000 },
  { name: 'Riverside Block C', city: 'Vijayawada', start: '2026-06-01', targetEnd: '2027-09-01', projectedEnd: '2027-09-15', currentPhaseNo: 1, status: 'at_risk', dailyCost: 68000 },
  { name: 'Greenfield Villas — A', city: 'Hyderabad', start: '2026-09-01', targetEnd: '2027-12-01', projectedEnd: '2027-12-01', currentPhaseNo: 0, status: 'not_started', dailyCost: 60000 },
  { name: 'Sunrise Enclave — B', city: 'Hyderabad', start: '2025-02-01', targetEnd: '2026-06-01', projectedEnd: '2026-07-20', currentPhaseNo: 10, status: 'nearly_complete', dailyCost: 60000 },
  { name: 'Palm Meadows — C', city: 'Vijayawada', start: '2024-01-01', targetEnd: '2025-04-01', projectedEnd: '2025-04-15', currentPhaseNo: 11, status: 'complete', dailyCost: 60000 },
];

function seededRandom(seed) {
  let s = seed;
  return () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
}

async function main() {
  await pg.connect();
  console.log('Connected.');

  console.log('Upserting auth users...');
  const userIds = {};
  for (const u of USERS) userIds[u.role] = await upsertAuthUser(u.email, u.name);

  console.log('Truncating app tables...');
  await pg.query(`truncate table
    notifications, delay_events, resource_assignments, demand_forecasts,
    price_history, purchase_orders, stock_requests, reliability_score_history,
    vendor_deliveries, vendor_materials, vendors, material_substitutes,
    subphase_materials, phase_dependencies, subphases, phases, projects,
    sites, materials, profiles
    restart identity cascade;`);

  console.log('Inserting profiles...');
  for (const u of USERS) {
    await pg.query(`insert into profiles (id, full_name, email, role) values ($1,$2,$3,$4)`,
      [userIds[u.role], u.name, u.email, u.role]);
  }

  console.log('Inserting materials...');
  const materialId = {};
  for (const [name, category, unit, stockOnHand] of MATERIALS) {
    const r = await pg.query(`insert into materials (name, category, unit, stock_on_hand) values ($1,$2,$3,$4) returning id`, [name, category, unit, stockOnHand]);
    materialId[name] = r.rows[0].id;
  }

  console.log('Inserting vendors + vendor_materials...');
  const vendorId = {};
  const vendorMeta = {}; // letter -> {score, onTime, complaints, leadTime}
  for (const [letter, material, score, onTime, complaints, price, leadTime, totalOrders] of VENDOR_ROWS) {
    const fullName = `Vendor ${letter}`;
    if (!vendorId[letter]) {
      const r = await pg.query(`insert into vendors (name, reliability_score) values ($1,$2) returning id`, [fullName, score]);
      vendorId[letter] = r.rows[0].id;
      vendorMeta[letter] = { score, onTime, complaints, leadTime, totalOrders };
    }
    await pg.query(`insert into vendor_materials (vendor_id, material_id, avg_price) values ($1,$2,$3)
      on conflict (vendor_id, material_id) do update set avg_price = excluded.avg_price`,
      [vendorId[letter], materialId[material], price]);
  }

  console.log('Generating vendor_deliveries (18-25 per vendor, matching on-time%/complaint rate)...');
  let deliveryCount = 0;
  for (const [letter, material, score, onTime, complaints, price, leadTime] of VENDOR_ROWS) {
    const rng = seededRandom(letter.charCodeAt(0) * 97 + material.length);
    const n = 18 + Math.floor(rng() * 8); // 18-25
    const onTimeCount = Math.round((onTime / 100) * n);
    const complaintCount = complaints > 0 ? Math.max(1, Math.round((complaints / 20) * n)) : 0;
    for (let i = 0; i < n; i++) {
      const orderDaysAgo = Math.floor(rng() * 365) + 5;
      const orderDate = daysAgo(orderDaysAgo);
      const promisedDate = addDays(orderDate, leadTime);
      const isOnTime = i < onTimeCount;
      const isComplaint = i < complaintCount;
      const actualDate = isOnTime ? promisedDate : addDays(promisedDate, 2 + Math.floor(rng() * 8));
      const qtyOrdered = 4 + Math.round(rng() * 8 * 10) / 10;
      const qtyDelivered = isComplaint ? Math.round((qtyOrdered * (0.85 + rng() * 0.1)) * 10) / 10 : qtyOrdered;
      const priceJitter = Math.round(price * (0.97 + rng() * 0.06));
      await pg.query(`insert into vendor_deliveries
        (vendor_id, material_id, order_date, promised_date, actual_date, qty_ordered, qty_delivered, complaint, price)
        values ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [vendorId[letter], materialId[material], orderDate, promisedDate, actualDate, qtyOrdered, qtyDelivered, isComplaint, priceJitter]);
      deliveryCount++;
    }
  }
  console.log(`  ${deliveryCount} delivery rows generated.`);

  console.log('Inserting reliability_score_history...');
  for (const [letter, date, score] of SCORE_HISTORY) {
    await pg.query(`insert into reliability_score_history (vendor_id, recorded_at, score) values ($1,$2,$3)`,
      [vendorId[letter], date, score]);
  }

  console.log('Inserting price_history...');
  for (const [name] of MATERIALS) {
    const curve = PRICE_CURVES[name] || FLAT_CURVE;
    for (let w = 0; w < 6; w++) {
      const recordedAt = daysAgo((5 - w) * 7);
      await pg.query(`insert into price_history (material_id, week_index, recorded_at, price_index) values ($1,$2,$3,$4)`,
        [materialId[name], w + 1, recordedAt, curve[w]]);
    }
  }

  console.log('Inserting sites + projects...');
  const siteId = {};
  for (const city of [...new Set(PROJECTS.map((p) => p.city))]) {
    const r = await pg.query(`insert into sites (name, city) values ($1,$2) returning id`, [`${city} Site`, city]);
    siteId[city] = r.rows[0].id;
  }
  const projectId = {};
  const projectMeta = {};
  for (const p of PROJECTS) {
    const r = await pg.query(`insert into projects (site_id, name, start_date, target_end_date, projected_end_date, daily_cost_estimate, status)
      values ($1,$2,$3,$4,$5,$6,$7) returning id`,
      [siteId[p.city], p.name, p.start, p.targetEnd, p.projectedEnd, p.dailyCost, p.status]);
    projectId[p.name] = r.rows[0].id;
    projectMeta[p.name] = p;
  }

  console.log('Building phase/subphase template for every project...');
  // Distribute planned dates proportionally across each project's real
  // start_date -> target_end_date span (§14.6), weighted by each phase's
  // subphase count, so the cascade engine's forward pass (task 5) lands on
  // plausible dates instead of a generic placeholder schedule.
  const TOTAL_SUBPHASES = PHASES.reduce((sum, ph) => sum + ph.subphases.length, 0);
  // subphaseRef[projectName][phaseNo][subphaseName] = subphase id, for later lookups
  const subphaseRef = {};
  for (const p of PROJECTS) {
    subphaseRef[p.name] = {};
    const currentNo = p.currentPhaseNo;
    const totalDays = Math.round((new Date(p.targetEnd) - new Date(p.start)) / 86400000);
    let cursorDate = p.start;

    for (const phaseTpl of PHASES) {
      let phaseStatus;
      if (p.status === 'complete') phaseStatus = 'complete';
      else if (phaseTpl.no < currentNo) phaseStatus = 'complete';
      else if (phaseTpl.no === currentNo) phaseStatus = 'in_progress';
      else phaseStatus = 'locked';

      const phaseDurationDays = Math.max(
        phaseTpl.subphases.length,
        Math.round((phaseTpl.subphases.length / TOTAL_SUBPHASES) * totalDays)
      );
      const plannedStart = cursorDate;
      const plannedEnd = addDays(plannedStart, phaseDurationDays);
      cursorDate = plannedEnd;
      const actualStart = phaseStatus !== 'locked' ? plannedStart : null;
      const actualEnd = phaseStatus === 'complete' ? plannedEnd : null;

      const phaseR = await pg.query(`insert into phases
        (project_id, template_phase_no, name, unlock_type, sequence, planned_start, planned_end, actual_start, actual_end, projected_end, status)
        values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) returning id`,
        [projectId[p.name], phaseTpl.no, phaseTpl.name, phaseTpl.unlockType, phaseTpl.no, plannedStart, plannedEnd, actualStart, actualEnd, plannedEnd, phaseStatus]);
      const phaseId = phaseR.rows[0].id;
      subphaseRef[p.name][phaseTpl.no] = {};

      for (let i = 0; i < phaseTpl.subphases.length; i++) {
        const sub = phaseTpl.subphases[i];
        let subStatus;
        if (phaseStatus === 'complete') subStatus = 'complete';
        else if (phaseStatus === 'locked') subStatus = 'locked';
        else {
          // in_progress phase: first subphase available/in_progress, rest locked by default
          subStatus = i === 0 ? 'in_progress' : 'locked';
        }
        const subDuration = Math.max(1, Math.round(phaseDurationDays / phaseTpl.subphases.length));
        const subPlannedStart = addDays(plannedStart, i * subDuration);
        const subPlannedEnd = addDays(subPlannedStart, subDuration);
        const subActualStart = subStatus !== 'locked' ? subPlannedStart : null;
        const subActualEnd = subStatus === 'complete' ? subPlannedEnd : null;
        const unlockType = sub.unlockType || phaseTpl.unlockType;

        const supervisorFor = (p.name === 'Tower B — Structural' || p.name === 'Lakeview Phase 2') ? userIds.supervisor : null;

        const subR = await pg.query(`insert into subphases
          (phase_id, name, sequence, parallel_group, unlock_type, planned_start, planned_end, actual_start, actual_end, projected_end, status, assigned_supervisor_id)
          values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) returning id`,
          [phaseId, sub.name, i + 1, sub.parallelGroup || null, unlockType, subPlannedStart, subPlannedEnd, subActualStart, subActualEnd, subPlannedEnd, subStatus, supervisorFor]);
        const subId = subR.rows[0].id;
        subphaseRef[p.name][phaseTpl.no][sub.name] = subId;

        if (sub.material) {
          const required = sub.material.qty;
          const inStock = subStatus === 'complete' || subStatus === 'in_progress' ? required : required; // default sufficient
          await pg.query(`insert into subphase_materials (subphase_id, material_id, quantity_required, quantity_in_stock, required_by_date)
            values ($1,$2,$3,$4,$5)`,
            [subId, materialId[sub.material.name], required, inStock, subPlannedEnd]);
        }
      }
    }
  }

  console.log('Applying Tower B flagship Columns scenario (§14.7.3)...');
  const towerBCols = subphaseRef['Tower B — Structural'][3];
  const towerBColsPhaseId = (await pg.query(`select id from phases where project_id=$1 and template_phase_no=3`, [projectId['Tower B — Structural']])).rows[0].id;
  const colOverrides = [
    { name: 'Column Layout Marking', status: 'complete' },
    { name: 'Column Reinforcement (Steel) Pre-A', status: 'complete', material: 'TMT Steel Bars (12mm)', required: 3.0, stock: 5.0 },
    { name: 'Column Reinforcement (Steel) Pre-B', status: 'complete', material: 'TMT Steel Bars (12mm)', required: 3.0, stock: 3.2, earlyEnd: true },
    { name: 'Column Reinforcement During', status: 'in_progress', material: 'TMT Steel Bars (12mm)', required: 3.0, stock: 3.0 },
    { name: 'Column Reinforcement Post', status: 'locked' },
    { name: 'Column Shuttering Pre-A', status: 'locked', material: 'Shuttering Plates (18mm ply)', required: 40, stock: 0 },
    { name: 'Column Shuttering Pre-B', status: 'locked', material: 'Shuttering Plates (18mm ply)', required: 20, stock: 0 },
    { name: 'Column Shuttering During', status: 'locked' },
    { name: 'Column Safety Clearance', status: 'locked' },
    { name: 'Column RCC Post (Casting Complete)', status: 'locked', material: 'Cement (OPC 53)', required: 25, stock: 40 },
  ];
  for (const o of colOverrides) {
    const subId = towerBCols[o.name];
    await pg.query(`update subphases set status=$1 where id=$2`, [o.status, subId]);
    if (o.material) {
      await pg.query(`update subphase_materials set quantity_required=$1, quantity_in_stock=$2 where subphase_id=$3 and material_id=$4`,
        [o.required, o.stock, subId, materialId[o.material]]);
    }
  }
  // Phase 3 (Columns) itself: in_progress, matches project currentPhaseNo=3
  await pg.query(`update phases set status='in_progress' where id=$1`, [towerBColsPhaseId]);

  console.log('Inserting stock requests + purchase orders (§14.8, §14.9)...');
  const towerBShutteringPreA = towerBCols['Column Shuttering Pre-A'];
  const lakeviewSlabRCCDuring = subphaseRef['Lakeview Phase 2'][6]['Slab RCC During'];
  const riversideFootingsRCCDuring = subphaseRef['Riverside Block C'][1]['Footing RCC During'];
  const sunriseCorridorsConduit = subphaseRef['Sunrise Enclave — B'][10]['Electrical Conduit / JB Fixing'];

  // shortfall material rows for the three active/pending requests, matching the flagship narrative
  await pg.query(`update subphase_materials set quantity_in_stock = 20 where subphase_id=$1 and material_id=$2`,
    [lakeviewSlabRCCDuring, materialId['Cement (OPC 53)']]); // required 80, stock 20 -> insufficient
  await pg.query(`update subphase_materials set quantity_in_stock = 0 where subphase_id=$1 and material_id=$2`,
    [riversideFootingsRCCDuring, materialId['TMT Steel Bars (12mm)']]); // required per template small, stock 0 -> insufficient
  await pg.query(`update subphase_materials set quantity_in_stock = 200 where subphase_id=$1 and material_id=$2`,
    [sunriseCorridorsConduit, materialId['Electrical Conduit']]); // fulfilled -> now sufficient

  const sr104 = await pg.query(`insert into stock_requests (subphase_id, material_id, quantity, status, urgency, created_by)
    values ($1,$2,$3,'pending_pm_approval','high',$4) returning id`,
    [towerBShutteringPreA, materialId['Shuttering Plates (18mm ply)'], 40, userIds.supervisor]);
  const sr103 = await pg.query(`insert into stock_requests (subphase_id, material_id, quantity, status, urgency, created_by)
    values ($1,$2,$3,'pending_pm_approval','medium',$4) returning id`,
    [lakeviewSlabRCCDuring, materialId['Cement (OPC 53)'], 60, userIds.supervisor]);
  const sr101 = await pg.query(`insert into stock_requests (subphase_id, material_id, quantity, status, urgency, created_by)
    values ($1,$2,$3,'pending_pm_approval','high',$4) returning id`,
    [riversideFootingsRCCDuring, materialId['TMT Steel Bars (12mm)'], 15, null]);
  const sr098 = await pg.query(`insert into stock_requests (subphase_id, material_id, quantity, status, urgency, created_by)
    values ($1,$2,$3,'pending_pm_approval','low',$4) returning id`,
    [sunriseCorridorsConduit, materialId['Electrical Conduit'], 200, userIds.supervisor]);

  // walk each to its final §14.8 status via real UPDATEs so triggers fire naturally
  await pg.query(`update stock_requests set status='approved', approved_by=$1, approved_at=$2 where id=$3`,
    [userIds.pm, daysAgo(1), sr104.rows[0].id]);

  const po2291 = await pg.query(`insert into purchase_orders (material_id, vendor_id, quantity, status, source_stock_request_id, order_date, promised_date, created_by)
    values ($1,$2,$3,'recommended',$4,$5,$6,$7) returning id`,
    [materialId['Shuttering Plates (18mm ply)'], vendorId['N'], 40, sr104.rows[0].id, daysAgo(0), addDays(daysAgo(0), 4), userIds.procurement]);
  // PO exists now, so the 'sourced' trigger's vendor-name join resolves correctly
  await pg.query(`update stock_requests set status='sourced' where id=$1`, [sr104.rows[0].id]);

  await pg.query(`update stock_requests set status='approved', approved_by=$1, approved_at=$2 where id=$3`,
    [userIds.pm, daysAgo(1), sr103.rows[0].id]);
  // sr101 stays pending_pm_approval — "before" state
  await pg.query(`update stock_requests set status='approved', approved_by=$1, approved_at=$2 where id=$3`,
    [userIds.pm, daysAgo(21), sr098.rows[0].id]);
  await pg.query(`update stock_requests set status='fulfilled' where id=$1`, [sr098.rows[0].id]);

  const po2280 = await pg.query(`insert into purchase_orders (material_id, vendor_id, quantity, status, source_stock_request_id, order_date, promised_date, created_by)
    values ($1,$2,$3,'recommended',$4,$5,$6,$7) returning id`,
    [materialId['Cement (OPC 53)'], vendorId['A'], 60, sr103.rows[0].id, daysAgo(1), addDays(daysAgo(1), 4), userIds.procurement]);
  await pg.query(`update purchase_orders set status='approved' where id=$1`, [po2280.rows[0].id]);

  const po2265 = await pg.query(`insert into purchase_orders (material_id, vendor_id, quantity, status, order_date, promised_date, actual_delivery_date, created_by)
    values ($1,$2,$3,'approved',$4,$5,$6,$7) returning id`,
    [materialId['TMT Steel Bars (12mm)'], vendorId['E'], 12, daysAgo(10), addDays(daysAgo(10), 3), addDays(daysAgo(10), 3), userIds.procurement]);
  await pg.query(`update purchase_orders set status='ordered' where id=$1`, [po2265.rows[0].id]);
  await pg.query(`update purchase_orders set status='delivered' where id=$1`, [po2265.rows[0].id]);

  const po2240 = await pg.query(`insert into purchase_orders (material_id, vendor_id, quantity, status, source_stock_request_id, order_date, promised_date, actual_delivery_date, created_by)
    values ($1,$2,$3,'approved',$4,$5,$6,$7,$8) returning id`,
    [materialId['Electrical Conduit'], vendorId['M'], 200, sr098.rows[0].id, daysAgo(24), addDays(daysAgo(24), 5), addDays(daysAgo(24), 4), userIds.procurement]);
  await pg.query(`update purchase_orders set status='ordered' where id=$1`, [po2240.rows[0].id]);
  await pg.query(`update purchase_orders set status='delivered' where id=$1`, [po2240.rows[0].id]);

  console.log('Seed complete.');
  await pg.end();

  console.log('Building dependency graph edges...');
  require('child_process').execSync(`node "${__dirname}/build-dependencies.js"`, { stdio: 'inherit' });

  console.log('Generating consumption history...');
  require('child_process').execSync(`node "${__dirname}/seed-consumption.js"`, { stdio: 'inherit' });
}

main().catch(async (err) => {
  console.error(err);
  try { await pg.end(); } catch (_) {}
  process.exit(1);
});
