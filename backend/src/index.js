import { createApp } from './app.js';
import { pool } from './db/client.js';
import { config } from './config/env.js';
import { migrate } from './db/migrate.js';
import { createConversationsService } from './modules/conversations/conversations.service.js';
import { attachConversationLive } from './modules/conversations/conversations.live.js';

if (!config.databaseUrl)
  throw new Error(
    'DATABASE_URL is required. Copy .env.example to .env in the project root.',
  );
const db = await pool.connect();
try {
  await db.query('BEGIN');
  await migrate(db);
  await db.query('COMMIT');
} catch (error) {
  await db.query('ROLLBACK');
  throw error;
} finally {
  db.release();
}
const conversations = createConversationsService(pool);
let live;
const app = createApp(pool, {
  conversations,
  onConversationChange: (state) => live?.changed(state),
});
const server = app.listen(config.port, config.host, () => {
  console.log(`Assessment API: http://${config.host}:${config.port}`);
});
live = attachConversationLive(server, {
  service: conversations,
  apiKey: process.env.GEMINI_API_KEY?.trim(),
  model: process.env.GEMINI_LIVE_MODEL?.trim() || 'gemini-3.8-live',
  origins: (
    process.env.APP_ORIGINS || 'http://localhost:5173,http://127.0.0.1:5173'
  )
    .split(',')
    .map((value) => value.trim()),
});
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    live.close();
    server.close(async () => {
      await pool.end();
      process.exit(0);
    });
  });
}
