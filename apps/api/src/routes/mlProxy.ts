import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth';
import { asyncHandler } from '../middleware/asyncHandler';

export const mlProxyRouter = Router();
const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://localhost:8000';

// §5.5 Critical Path Identification
mlProxyRouter.get('/critical-path/:projectId', requireAuth, asyncHandler(async (req, res) => {
  const r = await fetch(`${ML_SERVICE_URL}/critical-path/${req.params.projectId}`);
  const body = await r.json();
  res.status(r.status).json(body);
}));

// §4.4 Auto-Generated Purchase Recommendations — PM/procurement can trigger
// an on-demand sweep; in production this would also run on a schedule.
mlProxyRouter.post('/purchase-recommendations/generate', requireAuth, requireRole('pm', 'procurement'), asyncHandler(async (_req, res) => {
  const r = await fetch(`${ML_SERVICE_URL}/purchase-recommendations/generate`, { method: 'POST' });
  const body = await r.json();
  res.status(r.status).json(body);
}));
