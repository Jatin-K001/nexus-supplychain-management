import { Router } from 'express';
import { pool } from '../db';
import { requireAuth, requireRole } from '../middleware/auth';
import { asyncHandler } from '../middleware/asyncHandler';

export const materialRequirementsRouter = Router();

/**
 * GET /api/material-requirements
 * Returns all subphase_materials rows with project/phase/subphase context
 * and current stock_on_hand so Procurement can see shortfalls and place orders.
 * Only accessible by procurement role.
 */
materialRequirementsRouter.get(
  '/',
  requireAuth,
  requireRole('procurement'),
  asyncHandler(async (_req, res) => {
    const r = await pool.query(`
      select
        sm.id,
        sm.subphase_id,
        sm.material_id,
        m.name            as material_name,
        m.unit,
        sm.quantity_required,
        m.stock_on_hand,
        greatest(0, sm.quantity_required - m.stock_on_hand) as shortfall,
        s.name            as subphase_name,
        s.status          as subphase_status,
        p.name            as phase_name,
        p.template_phase_no,
        pr.name           as project_name,
        pr.id             as project_id,
        -- is there already an open stock request for this subphase+material?
        (select count(*) from stock_requests sr
         where sr.subphase_id = sm.subphase_id
           and sr.material_id = sm.material_id
           and sr.status in ('pending_pm_approval','approved','sourced')
        )::int            as open_requests_count,
        -- is there already a purchase order in flight?
        (select count(*) from purchase_orders po
         join stock_requests sr on sr.id = po.source_stock_request_id
         where sr.subphase_id = sm.subphase_id
           and sr.material_id = sm.material_id
           and po.status in ('recommended','approved','ordered')
        )::int            as active_orders_count
      from subphase_materials sm
      join materials m  on m.id  = sm.material_id
      join subphases  s  on s.id  = sm.subphase_id
      join phases     p  on p.id  = s.phase_id
      join projects   pr on pr.id = p.project_id
      order by pr.name, p.template_phase_no, s.sequence, m.name
    `);
    res.json(r.rows);
  })
);
