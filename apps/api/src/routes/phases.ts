import { Router } from 'express';
import { pool } from '../db';
import { requireAuth } from '../middleware/auth';
import { asyncHandler } from '../middleware/asyncHandler';

export const phasesRouter = Router();

// §3.3 drilldown step 3: Subphase list for a phase
phasesRouter.get('/:id/subphases', requireAuth, asyncHandler(async (req, res) => {
  const r = await pool.query(
    `select * from subphases where phase_id = $1 order by sequence asc`,
    [req.params.id]
  );
  res.json(r.rows);
}));

// SUP·10: same subphase list, but each row carries its material/stock status
// instead of a start/end action — powers the stock-setup drilldown (§3.3).
phasesRouter.get('/:id/subphases-with-materials', requireAuth, asyncHandler(async (req, res) => {
  const subphases = await pool.query(`select * from subphases where phase_id = $1 order by sequence asc`, [req.params.id]);
  const materials = await pool.query(
    `select sm.subphase_id, m.name as material_name, sm.quantity_required, m.stock_on_hand as quantity_in_stock
     from subphase_materials sm join materials m on m.id = sm.material_id
     where sm.subphase_id = any($1::uuid[])`,
    [subphases.rows.map((s) => s.id)]
  );
  const bySubphase = new Map<string, any[]>();
  for (const m of materials.rows) {
    if (!bySubphase.has(m.subphase_id)) bySubphase.set(m.subphase_id, []);
    bySubphase.get(m.subphase_id)!.push(m);
  }
  res.json(subphases.rows.map((s) => ({ ...s, materials: bySubphase.get(s.id) ?? [] })));
}));
