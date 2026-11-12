import { readdir, readFile } from 'node:fs/promises';

// Caller supplies a transaction-bound client. All migrations are repeatable.
export async function migrate(db) {
  await db.query('SELECT pg_advisory_xact_lock(71024119)');
  const folder = new URL('./migrations/', import.meta.url);
  for (const file of (await readdir(folder))
    .filter((name) => /^\d+.*\.sql$/.test(name))
    .sort()) {
    await db.query(await readFile(new URL(file, folder), 'utf8'));
  }
}
