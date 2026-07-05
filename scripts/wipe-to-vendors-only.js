// Wipes every project/workflow table, keeps: profiles (login accounts),
// materials, vendors, vendor_materials, vendor_deliveries,
// reliability_score_history, price_history, material_substitutes.
require('dotenv').config({ path: __dirname + '/../.env' });
const { Client } = require('pg');

const pg = new Client({
  host: process.env.DB_HOST, port: 5432, user: process.env.DB_USER,
  password: process.env.DB_PASSWORD, database: 'postgres', ssl: { rejectUnauthorized: false },
});

const TABLES_TO_WIPE = [
  'notifications',
  'delay_events',
  'resource_assignments',
  'demand_forecasts',
  'purchase_orders',
  'stock_requests',
  'consumption_logs',
  'subphase_materials',
  'phase_dependencies',
  'subphases',
  'phases',
  'projects',
  'sites',
];

async function main() {
  await pg.connect();
  console.log('Wiping:', TABLES_TO_WIPE.join(', '));
  await pg.query(`truncate table ${TABLES_TO_WIPE.join(', ')} restart identity cascade`);
  console.log('Done. Kept: profiles, materials, vendors, vendor_materials, vendor_deliveries, reliability_score_history, price_history, material_substitutes.');
  await pg.end();
}

main().catch(async (e) => { console.error(e); await pg.end(); process.exit(1); });
