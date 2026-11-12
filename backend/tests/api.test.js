import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { migrate } from '../src/db/migrate.js';
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
  const migrationClient = await db.connect();
  try {
    await migrationClient.query('BEGIN');
    await migrate(migrationClient);
    await migrationClient.query('COMMIT');
  } finally {
    migrationClient.release();
  }
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

test('Conversation drafts persist across service recreation, revisions reject stale updates, and completion is idempotent', async () => {
  const patient = (
    await request('/patients', {
      name: 'Conversation Test',
      dateOfBirth: '1990-01-01',
      gender: 'Other',
      email: 'conversation@example.com',
    })
  ).data;
  const id = randomUUID();
  const created = await request('/conversations', {
    id,
    patientId: patient.id,
    assessmentId: 'GAD7',
  });
  assert.equal(created.status, 201);
  assert.equal(created.data.definition.questions.length, 7);
  assert.equal(
    (await request(`/conversations/${id}/finalize`, { revision: 0 })).status,
    400,
  );
  const patch = async (body) => {
    const response = await fetch(`${base}/conversations/${id}/answers`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return { status: response.status, data: await response.json() };
  };
  assert.equal(
    (await patch({ questionId: 'Q2', value: 1, revision: 0 })).status,
    409,
  );
  assert.equal(
    (await patch({ questionId: 'Q1', value: 4, revision: 0 })).status,
    400,
  );
  const concurrent = await Promise.all([
    patch({ questionId: 'Q1', value: 2, revision: 0 }),
    patch({ questionId: 'Q1', value: 2, revision: 0 }),
  ]);
  assert.deepEqual(concurrent.map((r) => r.status).sort(), [200, 409]);
  const { createConversationsService } =
    await import('../src/modules/conversations/conversations.service.js');
  const resumed = await createConversationsService(db).get(id);
  assert.equal(resumed.answers[0], 2);
  assert.equal(resumed.revision, 1);
  for (let i = 1; i < 7; i++)
    assert.equal(
      (await patch({ questionId: `Q${i + 1}`, value: 1, revision: i })).status,
      200,
    );
  // Final review can correct a confirmed answer.
  assert.equal(
    (await patch({ questionId: 'Q1', value: 3, revision: 7 })).status,
    200,
  );
  assert.equal(
    (await request(`/conversations/${id}/finalize`, { revision: 7 })).status,
    409,
  );
  const result = await request(`/conversations/${id}/finalize`, {
    revision: 8,
  });
  assert.equal(result.status, 200);
  assert.equal(result.data.score, 9);
  assert.equal(result.data.severity, 'Mild');
  assert.equal(result.data.mode, 'conversation');
  assert.equal(result.data.definition.version, '1.0.0-draft.1');
  const retry = await request(`/conversations/${id}/finalize`, { revision: 8 });
  assert.equal(retry.data.id, result.data.id);
  assert.equal(
    (await patch({ questionId: 'Q1', value: 0, revision: 8 })).status,
    409,
  );
  assert.equal(
    (await request(`/patients/${patient.id}`)).data.assessments.length,
    1,
  );
  const secondPatient = (
    await request('/patients', {
      name: 'Other Conversation Test',
      dateOfBirth: '1990-01-01',
      gender: 'Other',
      email: 'other@example.com',
    })
  ).data;
  assert.equal(
    (
      await request('/conversations', {
        id,
        patientId: secondPatient.id,
        assessmentId: 'GAD7',
      })
    ).status,
    409,
  );
  assert.equal(
    (
      await request('/conversations', {
        id: randomUUID(),
        patientId: patient.id,
        assessmentId: 'UNKNOWN',
      })
    ).status,
    400,
  );
});
test('Public configuration exposes definitions and availability without secrets', async () => {
  const result = await request('/assessment-definitions');
  assert.equal(result.status, 200);
  assert.equal(typeof result.data.geminiConfigured, 'boolean');
  assert.equal(result.data.definitions[0].id, 'GAD7');
  assert.deepEqual(Object.keys(result.data).sort(), [
    'definitions',
    'geminiConfigured',
  ]);
});
