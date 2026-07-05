import { Router } from 'express';
import { pool } from '../db';
import { requireAuth } from '../middleware/auth';
import { asyncHandler } from '../middleware/asyncHandler';

export const sitesRouter = Router();

sitesRouter.get('/', requireAuth, asyncHandler(async (_req, res) => {
  const r = await pool.query(`select * from sites order by city`);
  res.json(r.rows);
}));
