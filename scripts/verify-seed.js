require('dotenv').config({ path: __dirname + '/../.env' });
const { Client } = require('pg');
const pg = new Client({
  host: 'aws-1-ap-south-1.pooler.supabase.com', port: 5432,
  user: 'postgres.voxwhdueseuqjgqlgapb', password: 'Sama@Tarun1312',
  database: 'postgres', ssl: { rejectUnauthorized: false },
});
async function main() {
  await pg.connect();
  const tables = ['profiles','materials','vendors','vendor_materials','vendor_deliveries',
    'reliability_score_history','price_history','sites','projects','phases','subphases',
    'subphase_materials','stock_requests','purchase_orders','notifications'];
  for (const t of tables) {
    const r = await pg.query(`select count(*) from ${t}`);
    console.log(t.padEnd(24), r.rows[0].count);
  }
  const notifs = await pg.query(`select recipient_user_id, message, read_at from notifications order by created_at desc limit 15`);
  console.log('\nRecent notifications:');
  notifs.rows.forEach(r => console.log(' -', r.message));
  await pg.end();
}
main().catch(e => { console.error(e); process.exit(1); });
