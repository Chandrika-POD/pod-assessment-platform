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
test('Complete patient workflow persists to PostgreSQL and survives reload', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: /Akash Kumar/ })).toBeVisible();
  await page.screenshot({
    path: 'artifacts/patients-desktop.png',
    fullPage: true,
  });
  await page.getByRole('button', { name: 'Next page' }).click();
  await expect(
    page.getByRole('button', { name: /Priya Sharma/ }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Add Patient', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Full name').fill('Workflow Test Patient');
  await dialog.getByLabel('Date of birth').fill('1995-05-10');
  await dialog.getByLabel('Gender').selectOption('Female');
  await dialog.getByLabel('Email').fill('workflow-test@example.com');
  const created = page.waitForResponse(
    (response) =>
      response.url().endsWith('/api/patients') &&
      response.request().method() === 'POST',
  );
  await dialog
    .getByRole('button', { name: 'Add patient', exact: true })
    .click();
  patientId = (await (await created).json()).id;
  await expect(dialog).not.toBeVisible();
  await page
    .getByRole('textbox', { name: 'Search patients' })
    .fill('Workflow Test Patient');
  await page.getByRole('button', { name: /Workflow Test Patient/ }).click();
  await expect(
    page.getByRole('heading', { name: 'Patient details', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Start GAD-7' }).click();
  await page.getByRole('button', { name: 'Save assessment' }).click();
  await expect(page.getByRole('alert')).toContainText('all seven');
  const answers = [3, 2, 2, 1, 1, 0, 1];
  for (let i = 0; i < 7; i++)
    await page
      .locator(`input[name="question-${i}"][value="${answers[i]}"]`)
      .check();
  await page.screenshot({ path: 'artifacts/gad7-form.png', fullPage: true });
  await page.getByRole('button', { name: 'Save assessment' }).click();
  await expect(page.getByRole('status')).toContainText('10/21 · Moderate');
  const result = await db.query(
    'SELECT score, severity, answers FROM assessments WHERE patient_id = $1',
    [patientId],
  );
  expect(result.rows).toEqual([{ score: 10, severity: 'Moderate', answers }]);
  await page.screenshot({
    path: 'artifacts/patient-result.png',
    fullPage: true,
  });
  await page.reload();
  await page
    .getByRole('textbox', { name: 'Search patients' })
    .fill('Workflow Test Patient');
  await page.getByRole('button', { name: /Workflow Test Patient/ }).click();
  await expect(page.locator('.history-item')).toHaveCount(1);
  await page.locator('.history-item summary').click();
  await expect(page.locator('.answer-review')).toContainText(
    'Nearly every day',
  );
  await page.getByRole('button', { name: 'Back to patients' }).click();
  await page.getByRole('textbox', { name: 'Search patients' }).fill('Akash');
  await page.getByRole('button', { name: /Akash Kumar/ }).click();
  await expect(page.locator('.history-item')).toHaveCount(0);
});
test('Mobile patient list and questionnaire fit the screen', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.getByRole('button', { name: /Akash Kumar/ })).toBeVisible();
  await page.screenshot({
    path: 'artifacts/patients-mobile.png',
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.getByRole('button', { name: /Akash Kumar/ }).click();
  await page.getByRole('button', { name: 'Start GAD-7' }).click();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.locator('input[name="question-0"][value="1"]').check();
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button', { name: 'Keep answering' }).click();
  await expect(
    page.locator('input[name="question-0"][value="1"]'),
  ).toBeChecked();
});
