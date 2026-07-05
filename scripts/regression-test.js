// High-level regression sweep: auth, role enforcement, validation, state
// machine edge cases, and the full business pipeline, run against the live
// API + ml-service. Prints PASS/FAIL per check; does not mutate seed data
// permanently (cleans up whatever it creates).
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
  if (cond) { pass++; }
  else { fail++; failures.push(`${name}${detail ? ' -- ' + detail : ''}`); console.log(`  FAIL: ${name}${detail ? ' -- ' + detail : ''}`); }
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
  if (error) throw new Error(`signin failed for ${email}: ${error.message}`);
  return data.session.access_token;
}

async function main() {
  await pg.connect();
  console.log('=== Signing in all 3 roles ===');
  const pmToken = await signIn('1@nexus.com');
  const supToken = await signIn('2@nexus.com');
  const procToken = await signIn('3@nexus.com');
  console.log('OK: all 3 roles authenticated\n');

  console.log('=== Auth edge cases ===');
  {
    const r = await req('/api/me');
    check('no token -> 401', r.status === 401, `got ${r.status}`);
  }
  {
    const r = await req('/api/me', { token: 'garbage.invalid.token' });
    check('bad token -> 401', r.status === 401, `got ${r.status}`);
  }
  {
    const r = await req('/api/me', { token: pmToken });
    check('valid token -> 200 + correct role', r.status === 200 && r.body.role === 'pm', JSON.stringify(r.body));
  }

  console.log('\n=== Role enforcement (each role blocked from others\' actions) ===');
  {
    const r = await req('/api/projects', { method: 'POST', token: supToken, body: { name: 'x', site_id: 'x', start_date: '2026-01-01', target_end_date: '2026-02-01' } });
    check('supervisor cannot create project -> 403', r.status === 403, `got ${r.status}`);
  }
  {
    const r = await req('/api/subphases/00000000-0000-0000-0000-000000000000/start', { method: 'POST', token: pmToken });
    check('PM cannot start subphase -> 403', r.status === 403, `got ${r.status}`);
  }
  {
    const r = await req('/api/purchase-orders', { method: 'POST', token: supToken, body: { material_id: 'x', vendor_id: 'x', quantity: 1 } });
    check('supervisor cannot create PO -> 403', r.status === 403, `got ${r.status}`);
  }
  {
    const sr = await req('/api/stock-requests', { token: pmToken });
    const anyRow = sr.body?.[0];
    if (anyRow) {
      const r = await req(`/api/stock-requests/${anyRow.id}/approve`, { method: 'POST', token: procToken });
      check('procurement cannot approve stock request -> 403', r.status === 403, `got ${r.status}`);
    } else {
      console.log('  (skipped: no stock requests exist to test against)');
    }
  }

  console.log('\n=== Procurement never sees pending_pm_approval (critical isolation rule) ===');
  {
    const r = await req('/api/stock-requests', { token: procToken });
    const leaked = (r.body ?? []).some((x) => x.status === 'pending_pm_approval');
    check('no pending_pm_approval rows visible to procurement', !leaked);
  }

  console.log('\n=== Validation edge cases ===');
  {
    const r = await req('/api/projects', { method: 'POST', token: pmToken, body: { name: 'Missing Fields Test' } });
    check('create project missing fields -> 422', r.status === 422, `got ${r.status}`);
  }
  {
    const r = await req('/api/purchase-orders', { method: 'POST', token: procToken, body: { quantity: 5 } });
    check('create PO missing fields -> 422', r.status === 422, `got ${r.status}`);
  }
  {
    const r = await req('/api/subphases/00000000-0000-0000-0000-000000000000/end', { method: 'POST', token: supToken, body: {} });
    check('end subphase missing actual_end -> 422', r.status === 422, `got ${r.status}`);
  }
  {
    const r = await req('/api/subphases/00000000-0000-0000-0000-000000000000', { token: pmToken });
    check('nonexistent subphase -> 404', r.status === 404, `got ${r.status}`);
  }
  {
    const r = await req('/api/projects/00000000-0000-0000-0000-000000000000', { token: pmToken });
    check('nonexistent project -> 404', r.status === 404, `got ${r.status}`);
  }

  console.log('\n=== State-machine edge cases ===');
  {
    // find any complete or locked subphase and try to start/end it wrongly
    const subs = await pg.query(`select id, status from subphases where status = 'complete' limit 1`);
    if (subs.rows[0]) {
      const r = await req(`/api/subphases/${subs.rows[0].id}/start`, { method: 'POST', token: supToken });
      check('cannot start a complete subphase -> 409', r.status === 409, `got ${r.status}`);
    }
    const locked = await pg.query(`select id, status from subphases where status = 'locked' limit 1`);
    if (locked.rows[0]) {
      const r = await req(`/api/subphases/${locked.rows[0].id}/start`, { method: 'POST', token: supToken });
      check('cannot start a locked subphase -> 409', r.status === 409, `got ${r.status}`);
    }
  }
  {
    const po = await pg.query(`select id, status from purchase_orders where status = 'delivered' limit 1`);
    if (po.rows[0]) {
      const r = await req(`/api/purchase-orders/${po.rows[0].id}/deliver`, { method: 'POST', token: procToken, body: { actual_date: '2026-01-01', qty_received: 1 } });
      check('cannot re-deliver an already-delivered PO -> 409', r.status === 409, `got ${r.status}`);
    } else {
      console.log('  (skipped: no delivered PO to test double-delivery against)');
    }
  }
  {
    const sr = await pg.query(`select id, status from stock_requests where status != 'pending_pm_approval' limit 1`);
    if (sr.rows[0]) {
      const r = await req(`/api/stock-requests/${sr.rows[0].id}/approve`, { method: 'POST', token: pmToken });
      check('cannot re-approve an already-actioned stock request -> 409', r.status === 409, `got ${r.status}`);
    }
  }

  console.log('\n=== Read endpoints across all roles (no 500s) ===');
  const readEndpoints = ['/api/projects', '/api/sites', '/api/materials', '/api/vendors', '/api/notifications', '/api/dashboard/risk-summary', '/api/dashboard/delay-patterns'];
  for (const ep of readEndpoints) {
    for (const [role, token] of [['pm', pmToken], ['supervisor', supToken], ['procurement', procToken]]) {
      const r = await req(ep, { token });
      check(`${ep} as ${role} -> not 5xx`, r.status < 500, `got ${r.status}`);
    }
  }

  console.log('\n=== ml-service reachability ===');
  {
    const r = await fetch(`${ML}/health`);
    check('ml-service /health -> 200', r.status === 200);
  }
  {
    const mat = await pg.query(`select id from materials where name = 'TMT Steel Bars (12mm)'`);
    const r = await fetch(`${ML}/price/forecast/${mat.rows[0].id}`);
    const body = await r.json();
    check('price forecast returns projection array', Array.isArray(body.projection) && body.projection.length === 6, JSON.stringify(body));
  }
  {
    const proj = await pg.query(`select id from projects limit 1`);
    if (proj.rows[0]) {
      const r = await fetch(`${ML}/cascade/recalculate`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ project_id: proj.rows[0].id }) });
      check('cascade recalculate -> 200', r.status === 200, `got ${r.status}`);
    } else {
      console.log('  (skipped: no projects exist to test cascade against)');
    }
  }

  console.log('\n=== Concurrency: two simultaneous approvals of the same stock request ===');
  {
    const client = pg;
    const srIns = await client.query(`
      insert into stock_requests (subphase_id, material_id, quantity, status, urgency, created_by)
      select id, (select id from materials limit 1), 1, 'pending_pm_approval', 'low', null
      from subphases limit 1 returning id
    `);
    const srId = srIns.rows[0].id;
    const [r1, r2] = await Promise.all([
      req(`/api/stock-requests/${srId}/approve`, { method: 'POST', token: pmToken }),
      req(`/api/stock-requests/${srId}/approve`, { method: 'POST', token: pmToken }),
    ]);
    const successes = [r1.status, r2.status].filter((s) => s === 200).length;
    check('concurrent double-approve: exactly one wins', successes === 1, `statuses: ${r1.status}, ${r2.status}`);
    await client.query(`delete from stock_requests where id = $1`, [srId]);
  }

  console.log(`\n=== RESULTS: ${pass} passed, ${fail} failed ===`);
  if (failures.length) {
    console.log('Failures:');
    failures.forEach((f) => console.log(' -', f));
  }

  await pg.end();
  process.exit(fail > 0 ? 1 : 0);
}

main().catch(async (e) => { console.error('FATAL:', e); try { await pg.end(); } catch (_) {} process.exit(1); });
