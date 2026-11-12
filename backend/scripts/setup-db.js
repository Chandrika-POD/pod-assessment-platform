import pg from 'pg';
import { migrate } from '../src/db/migrate.js';
import { seedPatients } from '../src/db/seeds/patients.js';
if (!process.env.DATABASE_URL)
  throw new Error('Copy .env.example to .env first.');
const url = new URL(process.env.DATABASE_URL);
const database = decodeURIComponent(url.pathname.slice(1));
if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(database))
  throw new Error('Use an alphanumeric database name.');
const adminUrl = new URL(url);
adminUrl.pathname = '/postgres';
const admin = new pg.Client({ connectionString: adminUrl.toString() });
try {
  await admin.connect();
  const exists = await admin.query(
    'SELECT 1 FROM pg_database WHERE datname = $1',
    [database],
  );
  if (!exists.rowCount) await admin.query(`CREATE DATABASE "${database}"`);
} finally {
  await admin.end();
}
const db = new pg.Client({ connectionString: url.toString() });
try {
  await db.connect();
  await db.query('BEGIN');
  await migrate(db);
  await seedPatients(db);
  await db.query('COMMIT');
  console.log(
    `Database ${database} is ready. Six dummy patients seeded; existing records preserved.`,
  );
} catch (error) {
  await db.query('ROLLBACK');
  throw error;
} finally {
  await db.end();
}
