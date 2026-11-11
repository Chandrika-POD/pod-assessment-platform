import { createApp } from './app.js';
import { pool } from './db/client.js';
import { config } from './config/env.js';

if (!config.databaseUrl)
  throw new Error(
    'DATABASE_URL is required. Copy .env.example to .env in the project root.',
  );
const server = createApp(pool).listen(config.port, config.host, () => {
  console.log(`Assessment API: http://${config.host}:${config.port}`);
});
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () =>
    server.close(async () => {
      await pool.end();
      process.exit(0);
    }),
  );
}
