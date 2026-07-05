import { Router } from 'express';
import { pool } from '../db';
import { requireAuth, AuthedRequest } from '../middleware/auth';
import { asyncHandler } from '../middleware/asyncHandler';

export const notificationsRouter = Router();

// §8.3: filtered to the current user, most recent first
notificationsRouter.get('/', requireAuth, asyncHandler(async (req: AuthedRequest, res) => {
  const r = await pool.query(
    `select * from notifications where recipient_user_id = $1 order by created_at desc limit 50`,
    [req.user!.id]
  );
  res.json(r.rows);
}));

notificationsRouter.post('/:id/read', requireAuth, asyncHandler(async (req: AuthedRequest, res) => {
  await pool.query(
    `update notifications set read_at = now() where id = $1 and recipient_user_id = $2 and read_at is null`,
    [req.params.id, req.user!.id]
  );
  res.json({ ok: true });
}));
