// Populates phase_dependencies with real edges derived from the template's
// unlock rules (§2) — sequential chain, parallel fan-out/fan-in, cross-phase
// transitions. This table is what the cascade engine (§5.1) builds its
// networkx graph from, so it needs real rows, not an empty table.
require('dotenv').config({ path: __dirname + '/../.env' });
const { Client } = require('pg');
const { PHASES } = require('../db/phaseTemplate');

const pg = new Client({
  host: process.env.DB_HOST, port: 5432, user: process.env.DB_USER,
  password: process.env.DB_PASSWORD, database: 'postgres', ssl: { rejectUnauthorized: false },
});

async function main() {
  await pg.connect();
  await pg.query('truncate table phase_dependencies');

  const projects = (await pg.query('select id, name from projects')).rows;
  let edgeCount = 0;

  for (const project of projects) {
    const phases = (await pg.query(
      'select id, template_phase_no, unlock_type from phases where project_id=$1 order by template_phase_no',
      [project.id]
    )).rows;

    const subsByPhase = {};
    for (const phase of phases) {
      subsByPhase[phase.template_phase_no] = (await pg.query(
        'select id, sequence, parallel_group from subphases where phase_id=$1 order by sequence',
        [phase.id]
      )).rows;
    }

    const addEdge = async (predId, succId) => {
      await pg.query(
        'insert into phase_dependencies (predecessor_subphase_id, successor_subphase_id, lag_days) values ($1,$2,0)',
        [predId, succId]
      );
      edgeCount++;
    };

    for (const phase of phases) {
      const subs = subsByPhase[phase.template_phase_no];
      if (phase.unlock_type === 'independent') continue; // no internal edges

      for (let i = 0; i < subs.length - 1; i++) {
        const cur = subs[i];
        const next = subs[i + 1];
        if (cur.parallel_group != null && cur.parallel_group === next.parallel_group) {
          continue; // siblings in the same group don't depend on each other
        }
        if (cur.parallel_group != null) {
          // last member of a group -> edges handled at group-exit below
          continue;
        }
        if (next.parallel_group != null) {
          // fan-out: cur feeds every member of the upcoming group
          const group = subs.filter((s) => s.parallel_group === next.parallel_group);
          for (const g of group) await addEdge(cur.id, g.id);
        } else {
          await addEdge(cur.id, next.id);
        }
      }
      // fan-in: every member of a group feeds the subphase right after the group
      const groups = [...new Set(subs.filter((s) => s.parallel_group != null).map((s) => s.parallel_group))];
      for (const g of groups) {
        const members = subs.filter((s) => s.parallel_group === g);
        const maxSeq = Math.max(...members.map((s) => s.sequence));
        const after = subs.find((s) => s.sequence === maxSeq + 1);
        if (after) for (const m of members) await addEdge(m.id, after.id);
      }
    }

    // cross-phase: last subphase(s) of phase N -> first subphase(s) of phase N+1
    for (let i = 0; i < phases.length - 1; i++) {
      const cur = phases[i];
      const next = phases[i + 1];
      const curSubs = subsByPhase[cur.template_phase_no];
      const nextSubs = subsByPhase[next.template_phase_no];
      if (curSubs.length === 0 || nextSubs.length === 0) continue;

      const curTail = cur.unlock_type === 'independent'
        ? curSubs
        : [curSubs[curSubs.length - 1]];
      const nextHead = next.unlock_type === 'independent'
        ? nextSubs
        : [nextSubs[0]];

      for (const t of curTail) for (const h of nextHead) await addEdge(t.id, h.id);
    }
  }

  console.log(`Inserted ${edgeCount} dependency edges across ${projects.length} projects.`);
  await pg.end();
}

main().catch(async (e) => { console.error(e); await pg.end(); process.exit(1); });
