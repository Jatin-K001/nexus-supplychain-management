import { Router } from 'express';
import { pool } from '../db';
import { requireAuth, requireRole, AuthedRequest } from '../middleware/auth';
import { predictLeadTime, recomputeVendorScore } from '../services/vendors';
import { asyncHandler } from '../middleware/asyncHandler';

export const purchaseOrdersRouter = Router();

purchaseOrdersRouter.get('/', requireAuth, asyncHandler(async (req: AuthedRequest, res) => {
  const role = req.user!.role;
  let joinClause = '';
  let where = '1=1';
  const params: any[] = [];

  if (role === 'supervisor') {
    params.push(req.user!.id);
    joinClause = `join stock_requests sr on sr.id = po.source_stock_request_id`;
    where = `sr.created_by = $${params.length}`;
  }

  const r = await pool.query(
    `select po.*, m.name as material_name, m.unit, v.name as vendor_name
     from purchase_orders po
     join materials m on m.id = po.material_id
     join vendors v on v.id = po.vendor_id
     ${joinClause}
     where ${where}
     order by po.created_at desc`,
    params
  );
  res.json(r.rows);
}));

purchaseOrdersRouter.get('/:id', requireAuth, asyncHandler(async (req, res) => {
  const r = await pool.query(
    `select po.*, m.name as material_name, m.unit, v.name as vendor_name
     from purchase_orders po join materials m on m.id = po.material_id join vendors v on v.id = po.vendor_id
     where po.id = $1`,
    [req.params.id]
  );
  if (r.rowCount === 0) return res.status(404).json({ error: 'Not found' });
  res.json(r.rows[0]);
}));

// §6 step 6/8, §7: material + vendor carry over locked from comparison;
// promised_date is computed (Lead Time Prediction), never vendor-confirmed.
purchaseOrdersRouter.post('/', requireAuth, requireRole('procurement'), async (req: AuthedRequest, res) => {
  const { stock_request_id, material_id, vendor_id, quantity, notes } = req.body ?? {};
  if (!material_id || !vendor_id || !quantity) {
    return res.status(422).json({ error: 'material_id, vendor_id, quantity are required' });
  }

  const client = await pool.connect();
  try {
    await client.query('begin');

    const { days: leadDays } = await predictLeadTime(client, vendor_id, material_id);
    const orderDate = new Date();
    const promisedDate = new Date(orderDate);
    promisedDate.setDate(promisedDate.getDate() + leadDays);

    let projectId: string | null = null;
    if (stock_request_id) {
      const projRes = await client.query(
        `select p.project_id from stock_requests sr
         join subphases s on s.id = sr.subphase_id join phases p on p.id = s.phase_id
         where sr.id = $1`,
        [stock_request_id]
      );
      projectId = projRes.rows[0]?.project_id ?? null;
    }

    const po = await client.query(
      `insert into purchase_orders
         (material_id, vendor_id, quantity, status, source_stock_request_id, project_id, order_date, promised_date, notes, created_by)
       values ($1,$2,$3,'ordered',$4,$5,$6,$7,$8,$9) returning *`,
      [
        material_id, vendor_id, quantity, stock_request_id ?? null, projectId,
        orderDate.toISOString().slice(0, 10), promisedDate.toISOString().slice(0, 10),
        notes ?? null, req.user!.id,
      ]
    );

    if (stock_request_id) {
      await client.query(`update stock_requests set status = 'sourced' where id = $1 and status = 'approved'`, [stock_request_id]);
    }

    await client.query('commit');
    res.status(201).json(po.rows[0]);
  } catch (err) {
    await client.query('rollback');
    console.error(err);
    res.status(500).json({ error: 'Internal error' });
  } finally {
    client.release();
  }
});



// §6 step 10: Log Delivery — selects an existing order, promised date is
// read-only. This single submission recomputes vendor reliability live (§4.2).
purchaseOrdersRouter.post('/:id/deliver', requireAuth, requireRole('procurement'), async (req, res) => {
  const { actual_date, qty_received, complaint, price } = req.body ?? {};
  if (!actual_date || qty_received == null) {
    return res.status(422).json({ error: 'actual_date and qty_received are required' });
  }

  const client = await pool.connect();
  try {
    await client.query('begin');

    const poRes = await client.query(`select * from purchase_orders where id = $1 for update`, [req.params.id]);
    if (poRes.rowCount === 0) throw new Error('not_found');
    const po = poRes.rows[0];
    if (po.status !== 'ordered') {
      await client.query('rollback');
      return res.status(409).json({ error: `Cannot log delivery for a PO in status '${po.status}'` });
    }

    let deliveryPrice = price;
    if (deliveryPrice == null) {
      const avgPrice = await client.query(
        `select avg_price from vendor_materials where vendor_id = $1 and material_id = $2`,
        [po.vendor_id, po.material_id]
      );
      deliveryPrice = avgPrice.rows[0]?.avg_price ?? 0;
    }

    await client.query(
      `insert into vendor_deliveries (vendor_id, material_id, order_date, promised_date, actual_date, qty_ordered, qty_delivered, complaint, price)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [po.vendor_id, po.material_id, po.order_date, po.promised_date, actual_date, po.quantity, qty_received, !!complaint, deliveryPrice]
    );

    await client.query(
      `update purchase_orders set status = 'delivered', actual_delivery_date = $2 where id = $1`,
      [req.params.id, actual_date]
    );

    // The global stock pool is what every subphase's material availability
    // reads — a logged delivery is the one place Procurement adds to it.
    const stockRes = await client.query(
      `update materials set stock_on_hand = stock_on_hand + $2 where id = $1 returning stock_on_hand`,
      [po.material_id, qty_received]
    );

    const scoreResult = await recomputeVendorScore(client, po.vendor_id);

    await client.query('commit');
    res.json({ ok: true, vendorScore: scoreResult, materialStockOnHand: stockRes.rows[0].stock_on_hand });
  } catch (err) {
    await client.query('rollback');
    if ((err as Error).message === 'not_found') return res.status(404).json({ error: 'Not found' });
    console.error(err);
    res.status(500).json({ error: 'Internal error' });
  } finally {
    client.release();
  }
});
