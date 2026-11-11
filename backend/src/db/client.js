import pg from 'pg';
import { config } from '../config/env.js';

export const pool = new pg.Pool({
  connectionString: config.databaseUrl,
  connectionTimeoutMillis: 5000,
});
pool.on('error', (error) =>
  console.error('PostgreSQL connection error:', error.message),
);
