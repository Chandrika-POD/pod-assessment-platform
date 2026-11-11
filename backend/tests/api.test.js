import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import pg from 'pg';
import { createApp } from '../src/app.js';

const schema = `test_${randomUUID().replaceAll('-', '')}`;
const admin = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const db = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  options: `-c search_path=${schema}`,
});
let server, base;
before(async () => {
  await admin.query(`CREATE SCHEMA ${schema}`);
  await db.query(
    await readFile(
      new URL('../src/db/migrations/001_initial.sql', import.meta.url),
      'utf8',
    ),
  );
  server = createApp(db).listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}/api`;
});
after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  await db.end();
  await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
  await admin.end();
});
async function request(path, body) {
  const response = await fetch(
    `${base}${path}`,
    body === undefined
      ? {}
      : {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        },
  );
  return { status: response.status, data: await response.json() };
}
test('Backend serves JSON and never falls back to the frontend', async () => {
  const origin = new URL(base).origin;
  const root = await fetch(`${origin}/`, { headers: { Accept: 'text/html' } });
  assert.equal(root.status, 200);
  assert.match(root.headers.get('content-type'), /application\/json/);
  assert.equal((await root.json()).service, 'OpenMind Assessment API');

  for (const path of ['/index.html', '/patients', '/api/unknown']) {
    const response = await fetch(`${origin}${path}`);
    assert.equal(response.status, 404);
    assert.deepEqual(await response.json(), { error: 'Endpoint not found.' });
  }
  const health = await request('/health');
  assert.deepEqual(health.data, { status: 'ok', database: 'connected' });
});
test('Patient-linked results persist, retries do not duplicate, and history is isolated', async () => {
  const first = await request('/patients', {
    name: 'Test One',
    dateOfBirth: '1990-01-01',
    gender: 'Female',
    email: 'test1@example.com',
  });
  const second = await request('/patients', {
    name: 'Test Two',
    dateOfBirth: '1991-02-02',
    gender: 'Male',
    email: 'test2@example.com',
  });
  assert.equal(first.status, 201);
  const id = first.data.id;
  const payload = {
    submissionId: randomUUID(),
    answers: [3, 2, 2, 1, 1, 0, 1],
  };
  const saved = await request(`/patients/${id}/assessments`, payload);
  assert.equal(saved.status, 201);
  assert.equal(saved.data.score, 10);
  assert.equal(saved.data.severity, 'Moderate');
  assert.equal(
    (await request(`/patients/${id}/assessments`, payload)).status,
    200,
  );
  assert.equal(
    (await request(`/patients/${second.data.id}/assessments`, payload)).status,
    409,
  );
  assert.equal(
    (
      await request(`/patients/${id}/assessments`, {
        ...payload,
        answers: Array(7).fill(0),
      })
    ).status,
    409,
  );
  const stored = await db.query(
    'SELECT answers, score FROM assessments WHERE id = $1 AND patient_id = $2',
    [payload.submissionId, id],
  );
  assert.deepEqual(stored.rows[0].answers, payload.answers);
  assert.equal(stored.rows[0].score, 10);
  assert.equal((await request(`/patients/${id}`)).data.assessments.length, 1);
  assert.equal(
    (await request(`/patients/${second.data.id}`)).data.assessments.length,
    0,
  );
  await request(`/patients/${id}/assessments`, {
    submissionId: randomUUID(),
    answers: Array(7).fill(0),
  });
  assert.equal((await request(`/patients/${id}`)).data.assessments.length, 2);
  const patients = (await request('/patients')).data;
  assert.equal(patients.find((p) => p.id === id).latestScore, 0);
  assert.equal(patients.find((p) => p.id === second.data.id).latestScore, null);
});
test('API rejects invalid patient IDs, missing patients, incomplete answers and client scoring', async () => {
  assert.equal((await request('/patients/not-a-uuid')).status, 400);
  assert.equal((await request(`/patients/${randomUUID()}`)).status, 404);
  const id = randomUUID();
  assert.equal(
    (
      await request(`/patients/${id}/assessments`, {
        submissionId: randomUUID(),
        answers: Array(7).fill(0),
      })
    ).status,
    404,
  );
  for (const answers of [[0], [0, 0, 0, 0, 0, 0, 4], [0, 0, 0, 0, 0, 0, '1']]) {
    assert.equal(
      (
        await request(`/patients/${id}/assessments`, {
          submissionId: randomUUID(),
          answers,
        })
      ).status,
      400,
    );
  }
  assert.equal(
    (
      await request(`/patients/${id}/assessments`, {
        submissionId: randomUUID(),
        answers: Array(7).fill(0),
        score: 21,
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await request('/patients', {
        name: 'Future',
        dateOfBirth: '2999-01-01',
        gender: 'Male',
        email: 'test@example.com',
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await request('/patients', {
        name: 'Invalid',
        dateOfBirth: '2000-02-31',
        gender: 'Male',
        email: 'test@example.com',
      })
    ).status,
    400,
  );
});
