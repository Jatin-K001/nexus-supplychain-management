// Full business-pipeline test: create project -> lifecycle (start/end with
// stock gate) -> auto stock request -> PM approve -> vendor compare -> place
// order -> deliver -> vendor score/stock update -> cascade recompute ->
// notifications. Cleans up everything it creates at the end.
require('dotenv').config({ path: __dirname + '/../.env' });
const { createClient } = require('@supabase/supabase-js');
const { Client } = require('pg');

const API = 'http://localhost:4000';
const ML = 'http://localhost:8000';
const supa = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
const pg = new Client({
  host: process.env.DB_HOST, port: 5432, user: process.env.DB_USER,
  password: process.env.DB_PASSWORD, database: 'postgres', ssl: { rejectUnauthorized: false },
});

let pass = 0, fail = 0;
const failures = [];
function check(name, cond, detail) {
  if (cond) { pass++; console.log(`  OK: ${name}`); }
  else { fail++; failures.push(name); console.log(`  FAIL: ${name}${detail ? ' -- ' + detail : ''}`); }
}

async function req(path, { method = 'GET', token, body } = {}) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try { json = await res.json(); } catch (_) {}
  return { status: res.status, body: json };
}

async function signIn(email) {
  const { data, error } = await supa.auth.signInWithPassword({ email, password: 'Nexus@2026' });
  if (error) throw new Error(`signin failed: ${error.message}`);
  return data.session.access_token;
}

async function forceCleanup() {
  // Always-run safety net: whatever state the test left behind, tear it down
  // in FK-safe order so a failed run never corrupts the DB for the next one.
  await pg.query(`delete from purchase_orders where project_id in (select id from projects where name = 'PIPELINE-TEST-PROJECT')`);
  await pg.query(`
    delete from purchase_orders where source_stock_request_id in (
      select sr.id from stock_requests sr
      join subphases sp on sp.id = sr.subphase_id
      join phases p on p.id = sp.phase_id
      join projects pr on pr.id = p.project_id
      where pr.name = 'PIPELINE-TEST-PROJECT'
    )
  `);
  await pg.query(`
    delete from stock_requests where subphase_id in (
      select sp.id from subphases sp
      join phases p on p.id = sp.phase_id
      join projects pr on pr.id = p.project_id
      where pr.name = 'PIPELINE-TEST-PROJECT'
    )
  `);
  await pg.query(`delete from projects where name = 'PIPELINE-TEST-PROJECT'`);
  await pg.query(`update materials set stock_on_hand = 5 where name = 'TMT Steel Bars (12mm)'`);
  await pg.query(`update materials set stock_on_hand = 10 where name = 'Sand (River, Fine)'`);
}

async function main() {
  await pg.connect();
  const pmToken = await signIn('1@nexus.com');
  const supToken = await signIn('2@nexus.com');
  const procToken = await signIn('3@nexus.com');

  console.log('=== 1. PM creates project ===');
  const site = await pg.query(`select id from sites limit 1`);
  if (!site.rows[0]) throw new Error('no sites exist — cannot test project creation');
  const create = await req('/api/projects', {
    method: 'POST', token: pmToken,
    body: { name: 'PIPELINE-TEST-PROJECT', site_id: site.rows[0].id, start_date: '2026-07-05', target_end_date: '2027-07-05', daily_cost_estimate: 60000 },
  });
  check('project created', create.status === 201, JSON.stringify(create.body));
  const projectId = create.body.id;

  const phase1 = await pg.query(`select id from phases where project_id = $1 and template_phase_no = 1`, [projectId]);
  check('phase 1 exists', phase1.rowCount === 1);
  const subs = await pg.query(`select id, name, status, sequence from subphases where phase_id = $1 order by sequence`, [phase1.rows[0].id]);
  check('10 Footings subphases created', subs.rowCount === 10, `got ${subs.rowCount}`);
  check('first subphase available', subs.rows[0].status === 'available');
  check('rest locked', subs.rows.slice(1).every((s) => s.status === 'locked'));

  const assigned = await pg.query(`select assigned_supervisor_id from subphases where phase_id = $1 limit 1`, [phase1.rows[0].id]);
  check('auto-assigned to a supervisor', !!assigned.rows[0].assigned_supervisor_id);

  console.log('\n=== 2. Supervisor activates + ends subphase 1 (on time) ===');
  const sub1 = subs.rows[0].id;
  const start1 = await req(`/api/subphases/${sub1}/start`, { method: 'POST', token: supToken });
  check('subphase 1 activated', start1.status === 200, JSON.stringify(start1.body));

  const plannedEnd1 = await pg.query(`select planned_end from subphases where id = $1`, [sub1]);
  const end1 = await req(`/api/subphases/${sub1}/end`, {
    method: 'POST', token: supToken,
    body: { actual_end: plannedEnd1.rows[0].planned_end.toISOString().slice(0, 10) },
  });
  check('subphase 1 ended on time', end1.status === 200 && end1.body.delayDays === 0, JSON.stringify(end1.body));
  check('subphase 2 auto-activated', end1.body.activated?.length === 1);

  console.log('\n=== 3. Force a stock shortage, verify gate blocks + auto-request ===');
  const mat = await pg.query(`select id, name from materials where name = 'Sand (River, Fine)'`);
  await pg.query(`update materials set stock_on_hand = 0 where id = $1`, [mat.rows[0].id]);

  // Footing PCC Pre-B (subphase 2) needs Sand — end it to try to unlock Pre-C... actually
  // per template Sand is needed by subphase 2 itself, not what it unlocks. Walk forward
  // through subphases needing no material until we reach one whose *next* needs Sand.
  const allSubs = await pg.query(`select id, name, sequence from subphases where phase_id = $1 order by sequence`, [phase1.rows[0].id]);
  // Footing PCC Pre-A(1,Aggregate) -> Pre-B(2,Sand) -> During(3,Cement) -> Post(4) -> RCC Pre-A(5,TMT)
  // -> Pre-B(6) -> Pre-C(7) -> During(8,Cement) -> Post(9) -> Backfilling(10,Sand)
  // Ending subphase 9 (Post) unlocks 10 (Backfilling), which needs Sand -> shortage case.
  const sub9 = allSubs.rows[8].id; // index 8 = sequence 9

  // fast-forward: activate+end subphases 2..9 on time (only actually need to reach 9 in_progress)
  for (let i = 1; i < 9; i++) {
    const target = allSubs.rows[i].id;
    const cur = await pg.query(`select status, name from subphases where id = $1`, [target]);
    if (cur.rows[0].status === 'locked') {
      throw new Error(`chain stalled at "${cur.rows[0].name}" (still locked) — check material stock defaults`);
    }
    if (cur.rows[0].status === 'available') {
      const s = await req(`/api/subphases/${target}/start`, { method: 'POST', token: supToken });
      if (s.status !== 200) throw new Error(`failed to start "${cur.rows[0].name}": ${JSON.stringify(s.body)}`);
    }
    const pe = await pg.query(`select planned_end from subphases where id = $1`, [target]);
    const e = await req(`/api/subphases/${target}/end`, { method: 'POST', token: supToken, body: { actual_end: pe.rows[0].planned_end.toISOString().slice(0, 10) } });
    if (e.status !== 200) throw new Error(`failed to end "${cur.rows[0].name}": ${JSON.stringify(e.body)}`);
  }

  const sub10Before = await pg.query(`select status from subphases where id = $1`, [allSubs.rows[9].id]);
  check('Backfilling (needs Sand, stock=0) left available, NOT in_progress', sub10Before.rows[0].status === 'available', sub10Before.rows[0].status);

  const blockedStart = await req(`/api/subphases/${allSubs.rows[9].id}/start`, { method: 'POST', token: supToken });
  check('manual Activate blocked by stock gate -> 409', blockedStart.status === 409, JSON.stringify(blockedStart.body));

  const srCheck = await pg.query(
    `select id, status from stock_requests where subphase_id = $1 and material_id = $2`,
    [allSubs.rows[9].id, mat.rows[0].id]
  );
  check('stock request auto-created', srCheck.rowCount === 1, `count=${srCheck.rowCount}`);
  const srId = srCheck.rows[0].id;

  const pmNotif = await pg.query(
    `select id from notifications where related_id = $1 and recipient_user_id = (select id from profiles where role='pm')`,
    [srId]
  );
  check('PM notified of the stock request', pmNotif.rowCount >= 1);

  console.log('\n=== 4. PM approves -> Procurement sources -> places order ===');
  const approve = await req(`/api/stock-requests/${srId}/approve`, { method: 'POST', token: pmToken });
  check('PM approved stock request', approve.status === 200, JSON.stringify(approve.body));

  const procView = await req('/api/stock-requests', { token: procToken });
  check('procurement now sees the approved request', (procView.body ?? []).some((r) => r.id === srId));

  const compare = await req(`/api/vendors/compare/${mat.rows[0].id}`, { token: procToken });
  check('vendor comparison returns vendors for Sand', Array.isArray(compare.body) && compare.body.length > 0, JSON.stringify(compare.body)?.slice(0, 200));
  const bestVendor = compare.body[0];

  const placeOrder = await req('/api/purchase-orders', {
    method: 'POST', token: procToken,
    body: { stock_request_id: srId, material_id: mat.rows[0].id, vendor_id: bestVendor.vendor_id, quantity: 5, notes: 'pipeline test order' },
  });
  check('order placed, auto status=ordered', placeOrder.status === 201 && placeOrder.body.status === 'ordered', JSON.stringify(placeOrder.body));
  check('promised_date computed (not null)', !!placeOrder.body.promised_date);
  const poId = placeOrder.body.id;

  const srAfterSource = await pg.query(`select status from stock_requests where id = $1`, [srId]);
  check('stock request moved to sourced', srAfterSource.rows[0].status === 'sourced', srAfterSource.rows[0].status);

  console.log('\n=== 5. Procurement logs delivery -> vendor score + stock update ===');
  const vendorBefore = await pg.query(`select reliability_score from vendors where id = $1`, [bestVendor.vendor_id]);
  const deliver = await req(`/api/purchase-orders/${poId}/deliver`, {
    method: 'POST', token: procToken,
    body: { actual_date: placeOrder.body.promised_date.slice(0, 10), qty_received: 5, complaint: false },
  });
  check('delivery logged', deliver.status === 200, JSON.stringify(deliver.body));
  check('vendor score returned', typeof deliver.body.vendorScore?.score === 'number');
  const stockAfter = await pg.query(`select stock_on_hand from materials where id = $1`, [mat.rows[0].id]);
  check('material stock increased to 5', Number(stockAfter.rows[0].stock_on_hand) === 5, stockAfter.rows[0].stock_on_hand);

  console.log('\n=== 6. Supervisor can now activate the previously-blocked subphase ===');
  const nowStart = await req(`/api/subphases/${allSubs.rows[9].id}/start`, { method: 'POST', token: supToken });
  check('Activate now succeeds (stock arrived)', nowStart.status === 200, JSON.stringify(nowStart.body));

  console.log('\n=== 7. Cascade recompute reachable for this project ===');
  const cascade = await fetch(`${ML}/cascade/recalculate`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ project_id: projectId }) });
  check('cascade recompute 200', cascade.status === 200, cascade.status);

  console.log(`\n=== RESULTS: ${pass} passed, ${fail} failed ===`);
  if (failures.length) failures.forEach((f) => console.log(' -', f));

  console.log('\n=== Cleanup ===');
  await pg.query(`delete from vendor_deliveries where vendor_id = $1 and price = (select avg_price from vendor_materials where vendor_id=$1 and material_id=$2)`, [bestVendor.vendor_id, mat.rows[0].id]);
  await pg.query(`update vendors set reliability_score = $2 where id = $1`, [bestVendor.vendor_id, vendorBefore.rows[0].reliability_score]);
  await pg.query(`delete from reliability_score_history where vendor_id = $1 and recorded_at > now() - interval '5 minutes'`, [bestVendor.vendor_id]);
  await forceCleanup(); // deletes dependents in FK-safe order, then the project, then restores stock
  console.log('Cleaned up test project, vendor score/history, and material stock.');

  return fail > 0 ? 1 : 0;
}

main()
  .then(async (code) => { await pg.end(); process.exit(code); })
  .catch(async (e) => {
    console.error('FATAL:', e);
    try { await forceCleanup(); } catch (cleanupErr) { console.error('cleanup also failed:', cleanupErr); }
    try { await pg.end(); } catch (_) {}
    process.exit(1);
  });
