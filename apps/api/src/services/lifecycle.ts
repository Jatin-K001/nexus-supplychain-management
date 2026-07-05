import { PoolClient } from 'pg';
import { pool } from '../db';

type DelayCause = 'material' | 'labor' | 'weather' | 'other';

interface SubphaseRow {
  id: string;
  phase_id: string;
  name: string;
  sequence: number;
  parallel_group: number | null;
  unlock_type: string;
  planned_start: string | null;
  planned_end: string | null;
  status: string;
}

async function loadPhaseSubphases(client: PoolClient, phaseId: string): Promise<SubphaseRow[]> {
  const r = await client.query(
    `select id, phase_id, name, sequence, parallel_group, unlock_type, planned_start, planned_end, status
     from subphases where phase_id = $1 order by sequence asc`,
    [phaseId]
  );
  return r.rows;
}

/** §3.1 Start Subphase. `nextStartDate`, if given, is stashed on whichever
 * subphase(s) would unlock next (as their planned_start) so that when this
 * one ends, auto-activation has a pre-chosen date to use instead of
 * defaulting to "today". */
export async function startSubphase(subphaseId: string, nextStartDate?: string) {
  const client = await pool.connect();
  try {
    const cur0 = await client.query(`select id, phase_id, status, planned_end from subphases where id = $1`, [subphaseId]);
    if (cur0.rowCount === 0) throw new HttpError(404, 'Subphase not found');
    if (cur0.rows[0].status !== 'available') {
      throw new HttpError(409, `Subphase is '${cur0.rows[0].status}', must be 'available' to start`);
    }

    // Global stock gate: if the required material isn't on hand, this can't
    // start yet. Still raises/finds the stock request so the PM → Procurement
    // → delivery pipeline runs — the supervisor just has to wait for it.
    const gateCheck = await runStockCheck(client, subphaseId);
    if (!(await isStockSufficient(client, subphaseId))) {
      const shortage = gateCheck.created[0] ?? gateCheck.alreadyRequested[0];
      throw new HttpError(
        409,
        shortage
          ? `Cannot start — ${shortage.materialName} is short. A stock request has been sent to the PM; wait for Procurement to deliver it.`
          : 'Cannot start — required material is not yet in stock.'
      );
    }

    await client.query('begin');
    const cur = await client.query(`select id, phase_id, status, planned_end from subphases where id = $1 for update`, [subphaseId]);
    if (cur.rowCount === 0) throw new HttpError(404, 'Subphase not found');
    const sub = cur.rows[0];
    if (sub.status !== 'available') {
      throw new HttpError(409, `Subphase is '${sub.status}', must be 'available' to start`);
    }
    await client.query(
      `update subphases set status = 'in_progress', actual_start = now(), projected_end = planned_end where id = $1`,
      [subphaseId]
    );
    // a phase is "in progress" the moment any of its subphases is
    await client.query(
      `update phases set status = 'in_progress', actual_start = coalesce(actual_start, now())
       where id = $1 and status <> 'in_progress'`,
      [sub.phase_id]
    );

    if (nextStartDate) {
      const subs = await loadPhaseSubphases(client, sub.phase_id);
      const previewIds = previewNextUnlocks(subs, subphaseId);
      if (previewIds.length > 0) {
        await client.query(`update subphases set planned_start = $2 where id = any($1::uuid[])`, [previewIds, nextStartDate]);
      }
    }

    await client.query('commit');
    return { ok: true };
  } catch (err) {
    await client.query('rollback');
    throw err;
  } finally {
    client.release();
  }
}

/** Read-only preview of §3.1/§3.2's unlock rule — same logic as
 * computeNextUnlocks but usable before the subphase has actually ended, so
 * the UI can show "this sets the start date for X" during Activate. */
export function previewNextUnlocks(subs: SubphaseRow[], currentId: string): string[] {
  return computeNextUnlocks(subs, currentId);
}

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

/**
 * Given a subphase that just completed, figure out which sibling(s) unlock next,
 * per its unlock_type / parallel_group (§2, covers sequential / parallel+merge /
 * independent — the four unlock types the MVU build priority requires).
 * Returns ids of subphases whose status flips locked -> available in this phase,
 * or [] if the completed subphase was the last one (phase-transition handled by caller).
 */
function computeNextUnlocks(subs: SubphaseRow[], endedId: string): string[] {
  const idx = subs.findIndex((s) => s.id === endedId);
  const ended = subs[idx];

  if (ended.unlock_type === 'independent') {
    // all independent subphases in the phase were unlocked together at phase start
    return [];
  }

  if (ended.parallel_group != null) {
    const siblings = subs.filter((s) => s.parallel_group === ended.parallel_group);
    const allSiblingsDone = siblings.every((s) => s.id === endedId || s.status === 'complete');
    if (!allSiblingsDone) return [];
    const maxSeq = Math.max(...siblings.map((s) => s.sequence));
    const next = subs.find((s) => s.sequence === maxSeq + 1);
    return next ? [next.id] : [];
  }

  // plain sequential step: unlock the very next subphase (which may itself open
  // a parallel group, or be a merge gate — either way it's a single unlock here)
  const next = subs[idx + 1];
  if (!next) return [];
  // if the next subphase is the first member of a parallel group, unlock the
  // whole group at once rather than a single item
  if (next.parallel_group != null) {
    return subs.filter((s) => s.parallel_group === next.parallel_group).map((s) => s.id);
  }
  return [next.id];
}

/** Sets subphase(s) straight to in_progress with a real actual_start —
 * used both for the manual first Activate and for auto-starting whatever
 * unlocks next when a subphase ends, per the user's requested flow (ending
 * a subphase should never leave the next one sitting in a separate
 * "available, needs manual start" limbo). */
async function activateSubphases(client: PoolClient, ids: string[], startDate: string) {
  if (ids.length === 0) return;
  await client.query(
    `update subphases set status = 'in_progress', actual_start = $2, projected_end = planned_end where id = any($1::uuid[])`,
    [ids, startDate]
  );
  await client.query(
    `update phases set status = 'in_progress', actual_start = coalesce(actual_start, $2)
     where id = (select phase_id from subphases where id = $1) and status <> 'in_progress'`,
    [ids[0], startDate]
  );
}

/** Returns the ids of whichever phase this advanced into and unlocked, or []
 * if this was the project's final phase — caller auto-activates them. */
async function maybeAdvancePhase(client: PoolClient, phaseId: string): Promise<string[]> {
  const subs = await loadPhaseSubphases(client, phaseId);
  const allComplete = subs.every((s) => s.status === 'complete');
  if (!allComplete) return [];

  const phaseRes = await client.query(
    `update phases set status = 'complete', actual_end = now() where id = $1 returning project_id, template_phase_no`,
    [phaseId]
  );
  const { project_id, template_phase_no } = phaseRes.rows[0];

  const nextPhaseRes = await client.query(
    `select id, unlock_type from phases where project_id = $1 and template_phase_no = $2`,
    [project_id, template_phase_no + 1]
  );
  if (nextPhaseRes.rowCount === 0) return []; // was the final phase
  const nextPhase = nextPhaseRes.rows[0];

  const nextSubs = await loadPhaseSubphases(client, nextPhase.id);
  if (nextSubs.length === 0) return [];

  return nextPhase.unlock_type === 'independent' ? nextSubs.map((s) => s.id) : [nextSubs[0].id];
}

interface CreatedStockRequest {
  id: string;
  materialName: string;
  quantity: number;
  subphaseName: string;
}

interface StockCheckResult {
  created: CreatedStockRequest[];
  alreadyRequested: CreatedStockRequest[]; // insufficient, but an open request already covers it
}

/** §3.2 step 2-3: Stock Sufficiency Check against a newly-unlocked subphase.
 * Returns any requests it actually created, so callers (SUP·07) can show
 * exactly what got auto-generated instead of guessing from a generic flag —
 * and separately reports insufficiency that's already covered by an open
 * request, so "stock was sufficient" is never shown when it wasn't. */
async function runStockCheck(client: PoolClient, subphaseId: string): Promise<StockCheckResult> {
  // Availability now reads the ONE global stock_on_hand per material
  // (Procurement-owned, updated on every delivery) — not a private
  // per-subphase figure, so a shortage anywhere reflects the real shared pool.
  const materials = await client.query(
    `select sm.material_id, sm.quantity_required, m.stock_on_hand, m.name as material_name, s.name as subphase_name
     from subphase_materials sm
     join materials m on m.id = sm.material_id
     join subphases s on s.id = sm.subphase_id
     where sm.subphase_id = $1`,
    [subphaseId]
  );
  const created: CreatedStockRequest[] = [];
  const alreadyRequested: CreatedStockRequest[] = [];
  for (const m of materials.rows) {
    if (Number(m.stock_on_hand) >= Number(m.quantity_required)) continue;

    const existing = await client.query(
      `select id from stock_requests
       where subphase_id = $1 and material_id = $2 and status in ('pending_pm_approval','approved','sourced')`,
      [subphaseId, m.material_id]
    );
    if ((existing.rowCount ?? 0) > 0) {
      alreadyRequested.push({
        id: existing.rows[0].id,
        materialName: m.material_name,
        quantity: Number(m.quantity_required),
        subphaseName: m.subphase_name,
      });
      continue; // don't duplicate an open request
    }

    const shortfall = Number(m.quantity_required) - Number(m.stock_on_hand);
    const urgency = Number(m.stock_on_hand) === 0 ? 'high' : shortfall > Number(m.quantity_required) * 0.5 ? 'medium' : 'low';
    const supervisorRes = await client.query(
      `select assigned_supervisor_id from subphases where id = $1`,
      [subphaseId]
    );
    const inserted = await client.query(
      `insert into stock_requests (subphase_id, material_id, quantity, status, urgency, created_by)
       values ($1, $2, $3, 'pending_pm_approval', $4, $5) returning id`,
      [subphaseId, m.material_id, m.quantity_required, urgency, supervisorRes.rows[0]?.assigned_supervisor_id ?? null]
    );
    created.push({
      id: inserted.rows[0].id,
      materialName: m.material_name,
      quantity: Number(m.quantity_required),
      subphaseName: m.subphase_name,
    });
  }
  return { created, alreadyRequested };
}

/** Global stock gate: can this subphase actually start right now, given the
 * one shared stock_on_hand pool Procurement owns? Used both by the manual
 * Activate action and by End's auto-start-next step — same rule everywhere. */
async function isStockSufficient(client: PoolClient, subphaseId: string): Promise<boolean> {
  const r = await client.query(
    `select 1 from subphase_materials sm join materials m on m.id = sm.material_id
     where sm.subphase_id = $1 and m.stock_on_hand < sm.quantity_required limit 1`,
    [subphaseId]
  );
  return r.rowCount === 0;
}

interface EndSubphaseInput {
  actualEndDate: string; // YYYY-MM-DD
  delayCause?: DelayCause;
  nextStartDate?: string; // YYYY-MM-DD — auto-activates whatever unlocks next
}

/** §3.2 End Subphase — the full on-time/late vs. early branch */
export async function endSubphase(subphaseId: string, input: EndSubphaseInput) {
  const client = await pool.connect();
  try {
    await client.query('begin');

    const cur = await client.query(
      `select id, phase_id, planned_end, status from subphases where id = $1 for update`,
      [subphaseId]
    );
    if (cur.rowCount === 0) throw new HttpError(404, 'Subphase not found');
    const sub = cur.rows[0];
    if (sub.status !== 'in_progress') {
      throw new HttpError(409, `Subphase is '${sub.status}', must be 'in_progress' to end`);
    }
    if (!sub.planned_end) throw new HttpError(500, 'Subphase has no planned_end to compare against');

    const plannedEnd = new Date(sub.planned_end);
    const actualEnd = new Date(input.actualEndDate);
    const diffDays = Math.round((actualEnd.getTime() - plannedEnd.getTime()) / 86400000);

    const isEarly = diffDays < 0;
    const delayDays = isEarly ? 0 : diffDays;

    if (!isEarly && delayDays > 0 && !input.delayCause) {
      throw new HttpError(422, 'delay_cause is required when ending later than planned');
    }

    await client.query(
      `update subphases set status = 'complete', actual_end = $2, delay_days = $3, delay_cause = $4 where id = $1`,
      [subphaseId, input.actualEndDate, delayDays, isEarly ? null : input.delayCause ?? null]
    );

    let projectIdForCascade: string | null = null;
    if (!isEarly && delayDays > 0) {
      // §5.6: when the cause is 'material', auto-link the most recent stock
      // request / purchase order tied to this subphase — this dropdown IS
      // the root-cause attribution feature, not a separate lookup step.
      let linkedStockRequestId: string | null = null;
      let linkedPurchaseOrderId: string | null = null;
      if (input.delayCause === 'material') {
        const srRes = await client.query(
          `select id from stock_requests where subphase_id = $1 order by created_at desc limit 1`,
          [subphaseId]
        );
        linkedStockRequestId = srRes.rows[0]?.id ?? null;
        if (linkedStockRequestId) {
          const poRes = await client.query(
            `select id from purchase_orders where source_stock_request_id = $1 order by created_at desc limit 1`,
            [linkedStockRequestId]
          );
          linkedPurchaseOrderId = poRes.rows[0]?.id ?? null;
        }
      }

      await client.query(
        `insert into delay_events (subphase_id, phase_id, phase_name, cause, delay_days, related_stock_request_id, related_purchase_order_id)
         select $1, phase_id, (select name from phases where id = subphases.phase_id), $2, $3, $4, $5
         from subphases where id = $1`,
        [subphaseId, input.delayCause, delayDays, linkedStockRequestId, linkedPurchaseOrderId]
      );
      await client.query(
        `update phases set delay_days = delay_days + $2, delay_cause = $3 where id = $1`,
        [sub.phase_id, delayDays, input.delayCause]
      );
      const projRes = await client.query(
        `select project_id from phases where id = $1`,
        [sub.phase_id]
      );
      projectIdForCascade = projRes.rows[0]?.project_id ?? null;
    }

    // The chosen date for whatever unlocks next: explicit override on this
    // End call wins, otherwise fall back to whatever was set during this
    // subphase's own Activate step, otherwise just use today's actual_end.
    const subs = await loadPhaseSubphases(client, sub.phase_id);
    const toUnlock = computeNextUnlocks(subs, subphaseId);
    let unlockCandidates: string[] = [];
    let fallbackDate = input.nextStartDate ?? input.actualEndDate;

    if (toUnlock.length > 0) {
      unlockCandidates = toUnlock;
    } else {
      unlockCandidates = await maybeAdvancePhase(client, sub.phase_id);
    }

    // Each candidate only actually starts if the global stock pool covers
    // its material — otherwise it's unlocked (available) but left waiting,
    // and a stock request fires so the PM → Procurement → delivery pipeline
    // can resolve it; the supervisor can retry Activate once stock arrives.
    const activatedIds: string[] = [];
    let createdStockRequests: CreatedStockRequest[] = [];
    let alreadyRequestedMaterials: CreatedStockRequest[] = [];
    for (const id of unlockCandidates) {
      const target = subs.find((s) => s.id === id);
      const startDate = input.nextStartDate ?? target?.planned_start ?? fallbackDate;

      const checkResult = await runStockCheck(client, id);
      createdStockRequests = createdStockRequests.concat(checkResult.created);
      alreadyRequestedMaterials = alreadyRequestedMaterials.concat(checkResult.alreadyRequested);

      if (await isStockSufficient(client, id)) {
        await activateSubphases(client, [id], startDate);
        activatedIds.push(id);
      } else {
        await client.query(`update subphases set status = 'available', planned_start = $2 where id = $1`, [id, startDate]);
      }
    }

    await client.query('commit');

    let cascade: unknown = null;
    if (projectIdForCascade) {
      cascade = await triggerCascadeRecalc(projectIdForCascade);
    }

    const waitingOnStock = unlockCandidates.filter((id) => !activatedIds.includes(id));
    return { ok: true, delayDays, isEarly, activated: activatedIds, waitingOnStock, cascade, createdStockRequests, alreadyRequestedMaterials };
  } catch (err) {
    await client.query('rollback');
    throw err;
  } finally {
    client.release();
  }
}

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://localhost:8000';

/** §5.2: "automatically fires from ending a subphase late — never a separate
 * manual action." Failure here must not undo the already-committed lifecycle
 * state; it's a best-effort downstream recompute. */
async function triggerCascadeRecalc(projectId: string) {
  try {
    const res = await fetch(`${ML_SERVICE_URL}/cascade/recalculate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ project_id: projectId }),
    });
    if (!res.ok) {
      console.error('Cascade recalc failed', await res.text());
      return null;
    }
    return await res.json();
  } catch (err) {
    console.error('Cascade recalc unreachable', err);
    return null;
  }
}

