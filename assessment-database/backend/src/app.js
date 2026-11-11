import express from 'express';
import { createPatientsRouter } from './modules/patients/patients.routes.js';
import { errorHandler } from './middleware/errors.js';

export function createApp(pool) {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '16kb' }));
  app.get('/', (_req, res) => {
    res.json({ service: 'OpenMind Assessment API', health: '/api/health' });
  });
  app.use('/api', (_req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });
  app.get('/api/health', async (_req, res) => {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', database: 'connected' });
  });
  app.use('/api/patients', createPatientsRouter(pool));
  app.use('/api', (_req, res) =>
    res.status(404).json({ error: 'Endpoint not found.' }),
  );

  app.use((_req, res) =>
    res.status(404).json({ error: 'Endpoint not found.' }),
  );
  app.use(errorHandler);
  return app;
}
