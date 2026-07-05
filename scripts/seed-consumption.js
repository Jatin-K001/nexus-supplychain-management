// Synthetic daily consumption history — bootstrap data for §4.1's LSTM, same
// spirit as the vendor_deliveries generator (§14.2): not real procurement
// history, just enough of a realistic distribution for the model to train on.
require('dotenv').config({ path: __dirname + '/../.env' });
const { Client } = require('pg');

const pg = new Client({
  host: process.env.DB_HOST, port: 5432, user: process.env.DB_USER,
  password: process.env.DB_PASSWORD, database: 'postgres', ssl: { rejectUnauthorized: false },
});

const TODAY = new Date('2026-07-04');
const daysAgo = (n) => { const d = new Date(TODAY); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); };

function seededRandom(seed) {
  let s = seed;
  return () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
}

async function main() {
  await pg.connect();
  await pg.query('truncate table consumption_logs');

  const projects = (await pg.query(`select id, name, start_date, status from projects`)).rows;
  let rowCount = 0;

  for (const project of projects) {
    if (project.status === 'not_started') continue; // Greenfield: genuinely zero history — the sparse-data case §4.1's fallback exists for

    // materials actually assigned somewhere in this project's template
    const materials = (await pg.query(
      `select distinct m.id, m.name, m.category
       from subphase_materials sm
       join materials m on m.id = sm.material_id
       join subphases s on s.id = sm.subphase_id
       join phases p on p.id = s.phase_id
       where p.project_id = $1`,
      [project.id]
    )).rows;

    const projectStart = new Date(project.start_date);
    const historyDays = Math.min(120, Math.max(14, Math.round((TODAY - projectStart) / 86400000)));

    for (const material of materials) {
      const totalReq = (await pg.query(
        `select coalesce(sum(sm.quantity_required), 0) as total
         from subphase_materials sm join subphases s on s.id = sm.subphase_id
         join phases p on p.id = s.phase_id where p.project_id = $1 and sm.material_id = $2`,
        [project.id, material.id]
      )).rows[0].total;

      const baseline = Math.max(0.1, Number(totalReq) / 90); // spread total need across ~90 working days
      const rng = seededRandom(project.name.length * 31 + material.id.charCodeAt(0));

      for (let d = historyDays; d >= 1; d--) {
        if (rng() < 0.3) continue; // not every day has consumption logged
        const noise = 0.5 + rng(); // 0.5x - 1.5x baseline
        const qty = Math.round(baseline * noise * 100) / 100;
        if (qty <= 0) continue;
        await pg.query(
          `insert into consumption_logs (project_id, material_id, log_date, quantity) values ($1,$2,$3,$4)`,
          [project.id, material.id, daysAgo(d), qty]
        );
        rowCount++;
      }
    }
  }

  console.log(`Inserted ${rowCount} consumption_logs rows.`);
  await pg.end();
}

main().catch(async (e) => { console.error(e); await pg.end(); process.exit(1); });
