import { test, expect } from '@playwright/test';
import pg from 'pg';
import { loadEnvFile } from 'node:process';
loadEnvFile('.env');
const db = new pg.Pool({ connectionString: process.env.DATABASE_URL });
let patientId;
test.afterAll(async () => {
  if (patientId) {
    await db.query('DELETE FROM assessments WHERE patient_id = $1', [
      patientId,
    ]);
    await db.query('DELETE FROM patients WHERE id = $1', [patientId]);
  }
  await db.end();
});

test('Text conversation confirms proposals, resumes a draft, corrects review, and saves JSON-backed history', async ({
  page,
  request,
}) => {
  const response = await request.post('/api/patients', {
    data: {
      name: 'Conversation Browser Test',
      dateOfBirth: '1991-01-01',
      gender: 'Other',
      email: 'conversation-browser@example.com',
    },
  });
  patientId = (await response.json()).id;
  // Mock only provider availability and Live events. Persistence and scoring use the real API/Postgres.
  await page.route('**/api/assessment-definitions', async (route) => {
    const response = await route.fetch();
    const data = await response.json();
    await route.fulfill({ json: { ...data, geminiConfigured: true } });
  });
  let socket;
  await page.routeWebSocket('**/api/conversations/*/live', (ws) => {
    socket = ws;
    ws.send(JSON.stringify({ type: 'status', status: 'connected' }));
    ws.send(
      JSON.stringify({
        type: 'transcript',
        speaker: 'assistant',
        text: 'Over the past two weeks, how often have you been bothered by feeling nervous, anxious or on edge?',
      }),
    );
    ws.onMessage((message) => {
      const data = JSON.parse(message);
      if (data.type === 'text')
        ws.send(
          JSON.stringify({
            type: 'proposal',
            questionId: 'Q1',
            revision: 0,
            value: 2,
            summary: 'More than half the days.',
          }),
        );
    });
  });
  async function open() {
    await page.goto('/');
    await page
      .getByRole('textbox', { name: 'Search patients' })
      .fill('Conversation Browser Test');
    await page
      .getByRole('button', { name: /Conversation Browser Test/ })
      .click();
    await page.getByRole('button', { name: 'Start conversation' }).click();
  }
  await open();
  await expect(
    page.getByRole('button', { name: 'Start with text' }),
  ).toBeDisabled();
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Start with text' }).click();
  await expect(
    page
      .getByRole('status', { exact: false })
      .filter({ hasText: /^Connected$/ }),
  ).toBeVisible();
  await page
    .getByLabel('Your response')
    .fill('This happened more than half the days.');
  await page.getByRole('button', { name: 'Send response' }).click();
  await expect(
    page.getByText('Suggested response — please confirm'),
  ).toBeVisible();
  await expect(page.getByText('0 of 7 confirmed')).toBeVisible();
  await page
    .getByRole('button', { name: 'Confirm response', exact: true })
    .click();
  await expect(page.getByText('1 of 7 confirmed')).toBeVisible();
  await expect(
    page.getByRole('heading', {
      name: 'Not being able to stop or control worrying',
    }),
  ).toBeVisible();
  socket.send(
    JSON.stringify({
      type: 'proposal',
      questionId: 'Q1',
      revision: 0,
      value: 3,
      summary: 'Stale response',
    }),
  );
  await expect(page.getByText('Stale response')).not.toBeVisible();
  await page.screenshot({
    path: 'artifacts/gad7-conversation-desktop.png',
    fullPage: true,
  });
  await page.getByRole('button', { name: 'Disconnect', exact: true }).click();
  await page.getByRole('button', { name: 'Back to patient details' }).click();
  await page.getByRole('button', { name: 'Start conversation' }).click();
  await expect(page.getByText('1 of 7 confirmed')).toBeVisible();
  // Explicit choices work without the provider connection.
  for (let i = 1; i < 7; i++) {
    await page
      .getByRole('radio', { name: 'Several days', exact: true })
      .check();
    await page
      .getByRole('button', { name: 'Confirm response', exact: true })
      .click();
    await expect(page.getByText(`${i + 1} of 7 confirmed`)).toBeVisible();
  }
  await expect(
    page.getByRole('heading', { name: 'Review your answers' }),
  ).toBeVisible();
  await page.getByLabel('Review Q1').selectOption('3');
  await expect(
    page.getByRole('button', { name: 'Confirm answers and save assessment' }),
  ).toBeEnabled();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: 'artifacts/gad7-conversation-review-mobile.png',
    fullPage: true,
    animations: 'disabled',
  });
  await page
    .getByRole('button', { name: 'Confirm answers and save assessment' })
    .click();
  await expect(page.getByRole('status')).toContainText('9/21 · Mild');
  await page.locator('.history-item summary').click();
  await expect(page.locator('.answer-review')).toContainText('1.0.0-draft.1');
  const result = await db.query(
    'SELECT score, administration_mode, definition_snapshot FROM assessments WHERE patient_id = $1',
    [patientId],
  );
  expect(result.rows).toHaveLength(1);
  expect(result.rows[0].score).toBe(9);
  expect(result.rows[0].administration_mode).toBe('conversation');
  expect(result.rows[0].definition_snapshot.id).toBe('GAD7');
});
test('Missing Gemini key leaves the standard form accessible', async ({
  page,
}) => {
  await page.route('**/api/assessment-definitions', async (route) => {
    const response = await route.fetch();
    const data = await response.json();
    await route.fulfill({ json: { ...data, geminiConfigured: false } });
  });
  await page.goto('/');
  await page.getByRole('button', { name: /Akash Kumar/ }).click();
  await page.getByRole('button', { name: 'Start conversation' }).click();
  await expect(
    page.getByRole('heading', { name: 'Gemini is not configured yet' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Back to assessments' }).click();
  await page.getByRole('button', { name: 'Start GAD-7' }).click();
  await expect(
    page.getByRole('button', { name: 'Save assessment' }),
  ).toBeVisible();
});

test('Voice mode can mute and releases the microphone when disconnected', async ({
  browser,
  request,
}) => {
  const context = await browser.newContext({
    permissions: ['microphone'],
    viewport: { width: 390, height: 844 },
  });
  const page = await context.newPage();
  await page.addInitScript(() => {
    window.capturedTracks = [];
    const original = navigator.mediaDevices.getUserMedia.bind(
      navigator.mediaDevices,
    );
    navigator.mediaDevices.getUserMedia = async (...args) => {
      const stream = await original(...args);
      window.capturedTracks.push(...stream.getTracks());
      return stream;
    };
  });
  await page.route('**/api/assessment-definitions', async (route) => {
    const response = await route.fetch();
    const data = await response.json();
    await route.fulfill({ json: { ...data, geminiConfigured: true } });
  });
  await page.routeWebSocket('**/api/conversations/*/live', (ws) => {
    ws.send(JSON.stringify({ type: 'status', status: 'connected' }));
  });
  try {
    await page.goto('/');
    await page.getByRole('textbox', { name: 'Search patients' }).fill('Akash');
    await page.getByRole('button', { name: /Akash Kumar/ }).click();
    await page.getByRole('button', { name: 'Start conversation' }).click();
    await page.getByRole('checkbox').check();
    await page.getByRole('button', { name: 'Start with voice' }).click();
    await expect(
      page.getByRole('button', { name: 'Mute microphone' }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Mute microphone' }).click();
    expect(
      await page.evaluate(() =>
        capturedTracks.every((track) => !track.enabled),
      ),
    ).toBe(true);
    await page.screenshot({
      path: 'artifacts/gad7-conversation-voice-mobile.png',
      fullPage: true,
      animations: 'disabled',
    });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.getByRole('button', { name: 'Disconnect', exact: true }).click();
    expect(
      await page.evaluate(
        () =>
          capturedTracks.length > 0 &&
          capturedTracks.every((track) => track.readyState === 'ended'),
      ),
    ).toBe(true);
  } finally {
    await context.close();
  }
});
