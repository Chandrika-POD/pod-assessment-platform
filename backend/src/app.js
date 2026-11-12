import express from 'express';
import { GAD7 } from '../../shared/assessments/gad7.js';
import { createConversationsService } from './modules/conversations/conversations.service.js';
import { createConversationsRouter } from './modules/conversations/conversations.routes.js';
import { createPatientsRouter } from './modules/patients/patients.routes.js';
import { errorHandler } from './middleware/errors.js';

export function createApp(
  pool,
  {
    conversations = createConversationsService(pool),
    onConversationChange,
    geminiConfigured = Boolean(process.env.GEMINI_API_KEY?.trim()),
  } = {},
) {
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
  app.get('/api/assessment-definitions', (_req, res) =>
    res.json({ definitions: [GAD7], geminiConfigured }),
  );
  app.use(
    '/api/conversations',
    createConversationsRouter(conversations, onConversationChange),
  );
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
