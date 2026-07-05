import { Router } from 'express';
import { pool } from '../db';
import { requireAuth, requireRole, AuthedRequest } from '../middleware/auth';
import { asyncHandler } from '../middleware/asyncHandler';
import { PHASES } from '../data/phaseTemplate';

export const projectsRouter = Router();

const TOTAL_SUBPHASES = PHASES.reduce((sum, ph) => sum + ph.subphases.length, 0);
const addDays = (dateStr: string, n: number) => {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};

// §3.3 drilldown step 1: Project list. SUP·02 "My Projects" scopes this down
// to only sites/projects the supervisor is actually assigned to — the PM
// sees everything company-wide, a supervisor sees only their own.
projectsRouter.get('/', requireAuth, asyncHandler(async (req: AuthedRequest, res) => {
  if (req.user!.role === 'supervisor') {
    const r = await pool.query(
      `select distinct pr.*, s.name as site_name, s.city
       from projects pr join sites s on s.id = pr.site_id
       join phases p on p.project_id = pr.id
       join subphases sp on sp.phase_id = p.id
       where sp.assigned_supervisor_id = $1
       order by pr.start_date asc`,
      [req.user!.id]
    );
    return res.json(r.rows);
  }
  const r = await pool.query(
    `select pr.*, s.name as site_name, s.city
     from projects pr join sites s on s.id = pr.site_id
     order by pr.start_date asc`
  );
  res.json(r.rows);
}));

projectsRouter.get('/:id', requireAuth, asyncHandler(async (req, res) => {
  const r = await pool.query(
    `select pr.*, s.name as site_name, s.city
     from projects pr join sites s on s.id = pr.site_id where pr.id = $1`,
    [req.params.id]
  );
  if (r.rowCount === 0) return res.status(404).json({ error: 'Not found' });
  res.json(r.rows[0]);
}));

// §3.3 drilldown step 2: Phase list for a project
projectsRouter.get('/:id/phases', requireAuth, asyncHandler(async (req, res) => {
  const r = await pool.query(
    `select * from phases where project_id = $1 order by template_phase_no asc`,
    [req.params.id]
  );
  res.json(r.rows);
}));

// PM·09 New Project Setup — instantiates the fixed 10-phase/97-subphase
// template (§2) against a fresh project. Phase 1's first subphase unlocks
// immediately so there's something to act on; everything else stays locked.
projectsRouter.post('/', requireAuth, requireRole('pm'), asyncHandler(async (req, res) => {
  const { name, site_id, start_date, target_end_date, daily_cost_estimate } = req.body ?? {};
  if (!name || !site_id || !start_date || !target_end_date) {
    return res.status(422).json({ error: 'name, site_id, start_date, target_end_date are required' });
  }

  const client = await pool.connect();
  try {
    await client.query('begin');

    const materialIds = new Map<string, string>();
    const matRes = await client.query(`select id, name from materials`);
    for (const m of matRes.rows) materialIds.set(m.name, m.id);

    // New projects auto-assign to the site supervisor so it shows up in
    // their "My Projects" immediately — Procurement needs no such
    // assignment since their queues are already company-wide (§1).
    const supervisorRes = await client.query(
      `select id from profiles where role = 'supervisor' order by created_at asc limit 1`
    );
    const supervisorId: string | null = supervisorRes.rows[0]?.id ?? null;

    const projRes = await client.query(
      `insert into projects (site_id, name, start_date, target_end_date, projected_end_date, daily_cost_estimate, status)
       values ($1,$2,$3,$4,$4,$5,'on_track') returning *`,
      [site_id, name, start_date, target_end_date, daily_cost_estimate ?? 60000]
    );
    const project = projRes.rows[0];

    // Distribute planned dates proportionally across the project's own
    // start_date -> target_end_date span, weighted by each phase's subphase
    // count — mirrors the seed script's logic so a manually-created project
    // behaves identically to a seeded one (every subphase needs a real
    // planned_end for the Start/End lifecycle's early/late comparison).
    const totalDays = Math.round((new Date(target_end_date).getTime() - new Date(start_date).getTime()) / 86400000);
    let cursorDate = start_date;

    for (const phaseTpl of PHASES) {
      const phaseStatus = phaseTpl.no === 1 ? 'in_progress' : 'locked';
      const phaseDurationDays = Math.max(
        phaseTpl.subphases.length,
        Math.round((phaseTpl.subphases.length / TOTAL_SUBPHASES) * totalDays)
      );
      const phasePlannedStart = cursorDate;
      const phasePlannedEnd = addDays(phasePlannedStart, phaseDurationDays);
      cursorDate = phasePlannedEnd;

      const phaseRes = await client.query(
        `insert into phases (project_id, template_phase_no, name, unlock_type, sequence, planned_start, planned_end, status)
         values ($1,$2,$3,$4,$5,$6,$7,$8) returning id`,
        [project.id, phaseTpl.no, phaseTpl.name, phaseTpl.unlockType, phaseTpl.no, phasePlannedStart, phasePlannedEnd, phaseStatus]
      );
      const phaseId = phaseRes.rows[0].id;

      for (let i = 0; i < phaseTpl.subphases.length; i++) {
        const sub = phaseTpl.subphases[i];
        const subStatus = phaseTpl.no === 1 && i === 0 ? 'available' : 'locked';
        const unlockType = sub.unlockType || phaseTpl.unlockType;
        const subDuration = Math.max(1, Math.round(phaseDurationDays / phaseTpl.subphases.length));
        const subPlannedStart = addDays(phasePlannedStart, i * subDuration);
        const subPlannedEnd = addDays(subPlannedStart, subDuration);

        const subRes = await client.query(
          `insert into subphases (phase_id, name, sequence, parallel_group, unlock_type, planned_start, planned_end, status, assigned_supervisor_id)
           values ($1,$2,$3,$4,$5,$6,$7,$8,$9) returning id`,
          [phaseId, sub.name, i + 1, sub.parallelGroup ?? null, unlockType, subPlannedStart, subPlannedEnd, subStatus, supervisorId]
        );

        if (sub.material) {
          const materialId = materialIds.get(sub.material.name);
          if (materialId) {
            await client.query(
              `insert into subphase_materials (subphase_id, material_id, quantity_required, quantity_in_stock)
               values ($1,$2,$3,0)`,
              [subRes.rows[0].id, materialId, sub.material.qty]
            );
          }
        }
      }
    }

    await client.query('commit');
    res.status(201).json(project);
  } catch (err) {
    await client.query('rollback');
    console.error(err);
    res.status(500).json({ error: 'Internal error' });
  } finally {
    client.release();
  }
}));
