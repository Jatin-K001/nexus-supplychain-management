import './env';
import express from 'express';
import cors from 'cors';
import { env } from './env';
import { projectsRouter } from './routes/projects';
import { phasesRouter } from './routes/phases';
import { subphasesRouter } from './routes/subphases';
import { stockRequestsRouter } from './routes/stockRequests';
import { purchaseOrdersRouter } from './routes/purchaseOrders';
import { vendorsRouter } from './routes/vendors';
import { demandForecastsRouter } from './routes/demandForecasts';
import { materialsRouter } from './routes/materials';
import { dashboardRouter } from './routes/dashboard';
import { mlProxyRouter } from './routes/mlProxy';
import { sitesRouter } from './routes/sites';
import { notificationsRouter } from './routes/notifications';
import { materialRequirementsRouter } from './routes/materialRequirements';
import { requireAuth, AuthedRequest } from './middleware/auth';

const app = express();
app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => res.json({ ok: true }));

// §1: role is derived from the account record on sign-in, never chosen
app.get('/api/me', requireAuth, (req: AuthedRequest, res) => res.json(req.user));

app.use('/api/projects', projectsRouter);
app.use('/api/phases', phasesRouter);
app.use('/api/subphases', subphasesRouter);
app.use('/api/stock-requests', stockRequestsRouter);
app.use('/api/purchase-orders', purchaseOrdersRouter);
app.use('/api/vendors', vendorsRouter);
app.use('/api/demand-forecasts', demandForecastsRouter);
app.use('/api/materials', materialsRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/ml', mlProxyRouter);
app.use('/api/sites', sitesRouter);
app.use('/api/notifications', notificationsRouter);
app.use('/api/material-requirements', materialRequirementsRouter);

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: 'Internal error' });
});

app.listen(env.port, () => {
  console.log(`Nexus API listening on :${env.port}`);
});
