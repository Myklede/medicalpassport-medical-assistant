import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from '../outputs/qa/node_modules/playwright/index.mjs';

const base = process.env.MEDIPASS_TEST_URL || 'http://localhost:3001';
assert.ok(['localhost', '127.0.0.1'].includes(new URL(base).hostname));
const api = 'http://127.0.0.1:8000/api/analyze-wound';
const image = 'public/wound-demo/day_007_rgb.png';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1050 }, colorScheme: 'light' });
const page = await context.newPage();
const errors = [];
page.on('pageerror', error => errors.push(error.message));
await mkdir('outputs/qa', { recursive: true });

async function openAnalyzer(path = '/wound-analyzer') {
  await page.goto(base + path);
  await page.locator('[data-testid="wound-analyzer"][data-ready="true"]').waitFor({ timeout: 60000 });
}
async function submit() {
  const response = page.waitForResponse(res => res.url() === api && res.request().method() === 'POST');
  await page.getByRole('button', { name: 'Phân tích ảnh', exact: true }).click();
  return await response;
}

try {
  await page.goto(base + '/signin-with-chatgpt?return_to=/wound-analyzer');
  await openAnalyzer();
  assert.equal(await page.getByRole('button', { name: 'Phân tích ảnh', exact: true }).isDisabled(), true);
  assert.equal(await page.getByRole('switch', { name: 'Developer Mode' }).isChecked(), false);
  assert.equal(await page.getByRole('combobox').count(), 0);
  assert.equal(await page.getByLabel('Ngày theo dõi', { exact: true }).count(), 0);
  await page.getByLabel('Chọn ảnh PNG hoặc JPEG').setInputFiles(image);
  await page.route(api, async route => {
    await new Promise(resolve => setTimeout(resolve, 700));
    await route.continue();
  });
  const pending = submit();
  await page.getByRole('button', { name: 'Đang phân tích…' }).waitFor();
  assert.equal(await page.getByRole('switch', { name: 'Developer Mode' }).isDisabled(), true);
  const response = await pending;
  assert.equal(response.status(), 200);
  assert.ok(!response.request().postData().includes('"synthetic":true'), 'Do not label arbitrary user uploads as synthetic');
  const payload = await response.json();
  assert.equal(payload.patient_id, 'SYN000014');
  assert.equal(payload.objective_measurements.visits[0].day, 0);
  assert.equal(payload.pipeline_visuals, undefined);
  assert.ok(!response.request().postData().includes('include_pipeline_visuals'));
  await page.getByTestId('patient-brief').waitFor();
  assert.equal(await page.getByTestId('pipeline-visualization').count(), 0);
  assert.equal(await page.getByText('Clinical Brief & metadata', { exact: true }).count(), 0);
  await page.screenshot({ path: 'outputs/qa/wound-patient-light.png', fullPage: true, animations: 'disabled' });
  await page.unroute(api);

  await page.getByRole('switch', { name: 'Developer Mode' }).check();
  assert.equal(await page.getByTestId('patient-brief').count(), 0);
  assert.equal(await page.getByRole('button', { name: 'Phân tích ảnh', exact: true }).isDisabled(), true);
  for (const patientId of ['SYN000014', 'MOCK-002', 'MOCK-003', 'MOCK-004', 'MOCK-005']) {
    await page.getByRole('combobox', { name: 'Chọn bệnh nhân giả lập' }).click();
    assert.equal(await page.getByRole('option').count(), 5);
    await page.getByRole('option', { name: new RegExp(patientId) }).click();
    await page.getByLabel('Chọn ảnh PNG hoặc JPEG').setInputFiles(image);
    const developerResponse = await submit();
    assert.equal(developerResponse.status(), 200);
    const developerBrief = await developerResponse.json();
    assert.equal(developerBrief.patient_id, patientId);
    assert.equal(developerBrief.pipeline_visuals.status, 'available');
    // Chromium may omit multipart uploads from postData(); assert the real API's
    // profile echo and opt-in-only extension instead (serialization has unit tests).
    await page.getByTestId('pipeline-visualization').waitFor();
    assert.equal(await page.getByTestId('pipeline-visualization').getByRole('article').count(), 4);
    await page.waitForFunction(() => [...document.querySelectorAll('[data-testid="pipeline-visualization"] img')].length === 3 && [...document.querySelectorAll('[data-testid="pipeline-visualization"] img')].every(img => img.complete && img.naturalWidth > 0));
  }
  await page.screenshot({ path: 'outputs/qa/wound-developer-light.png', fullPage: true, animations: 'disabled' });
  // Changing back to Patient Mode must restore the fixed profile, not MOCK-005.
  await page.getByRole('switch', { name: 'Developer Mode' }).uncheck();
  assert.equal(await page.getByTestId('pipeline-visualization').count(), 0);
  await page.getByLabel('Chọn ảnh PNG hoặc JPEG').setInputFiles(image);
  const locked = await submit();
  assert.equal((await locked.json()).patient_id, 'SYN000014');
  assert.equal((await locked.json()).pipeline_visuals, undefined);

  await page.route(api, route => route.fulfill({ status: 200, json: { ...payload, patient_id: 'WRONG-PATIENT' } }));
  await submit();
  await page.getByRole('alert').filter({ hasText: 'không khớp hồ sơ' }).waitFor();
  assert.equal(await page.getByTestId('patient-brief').count(), 0);
  await page.unroute(api);

  await page.route(api, route => route.fulfill({ status: 422, json: { detail: [{ loc: ['body', 'day'], msg: 'Invalid visit day', input: 'PRIVATE-INPUT' }] } }));
  await submit();
  await page.getByRole('alert').waitFor();
  assert.match(await page.getByRole('alert').innerText(), /HTTP 422/);
  assert.match(await page.getByRole('alert').innerText(), /day: Invalid visit day/);
  assert.ok(!(await page.getByRole('alert').innerText()).includes('PRIVATE-INPUT'));
  await page.unroute(api);

  await page.route(api, route => route.abort('connectionrefused'));
  await page.getByRole('button', { name: 'Phân tích ảnh', exact: true }).click();
  await page.getByRole('alert').filter({ hasText: 'Không kết nối được' }).waitFor();
  assert.equal(await page.getByTestId('patient-brief').count(), 0);
  await page.unroute(api);

  const abstention = structuredClone(payload);
  abstention.objective_measurements.visits[0].tissue_percentages = null;
  abstention.objective_measurements.visits[0].risk_deterioration_score = null;
  abstention.objective_measurements.visits[0].quality = { usable_for_demo: false, reasons: ['extreme_exposure'] };
  await page.route(api, route => route.fulfill({ status: 200, json: abstention }));
  await submit();
  await page.getByRole('heading', { name: 'Ảnh chưa đủ rõ để đọc kết quả', exact: true }).waitFor();
  assert.ok(!(await page.getByTestId('patient-brief').innerText()).includes('0.0%'));
  await page.unroute(api);

  await page.setViewportSize({ width: 390, height: 844 });
  await openAnalyzer('/wounds');
  await page.getByRole('switch', { name: 'Developer Mode' }).check();
  await page.getByRole('button', { name: 'Thử ảnh & hồ sơ mẫu', exact: true }).click();
  await page.getByText('SYN000014-day_007.png', { exact: true }).waitFor();
  assert.match(await page.getByRole('combobox', { name: 'Chọn bệnh nhân giả lập' }).innerText(), /SYN000014/);
  assert.match(await page.getByTestId('baseline-summary').innerText(), /A-/);
  const sampleResponse = await submit();
  assert.equal(sampleResponse.status(), 200);
  const sampleBrief = await sampleResponse.json();
  assert.equal(sampleBrief.patient_id, 'SYN000014');
  assert.equal(sampleBrief.objective_measurements.visits[0].day, 7);
  await page.getByTestId('pipeline-visualization').waitFor();
  await page.locator('.mp-theme-toggle').click();
  await page.locator('html.dark').waitFor();
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  await page.screenshot({ path: 'outputs/qa/wound-developer-mobile-dark.png', fullPage: true, animations: 'disabled' });
  // An older server without visuals still renders its valid brief and placeholders.
  await page.route(api, route => route.fulfill({ status: 200, json: payload }));
  await submit();
  await page.getByText('Máy chủ chưa cung cấp ảnh đầu vào.', { exact: true }).waitFor();
  assert.equal(await page.getByTestId('pipeline-visualization').locator('img').count(), 0);
  await page.unroute(api);
  await page.getByRole('button', { name: 'Bỏ ảnh đã chọn' }).click();
  assert.equal(await page.getByRole('button', { name: 'Phân tích ảnh', exact: true }).isDisabled(), true);
  assert.equal(await page.getByTestId('clinical-brief').count(), 0);
  await page.getByRole('switch', { name: 'Developer Mode' }).uncheck();
  await page.getByLabel('Chọn ảnh PNG hoặc JPEG').setInputFiles(image);
  assert.equal((await submit()).status(), 200);
  await page.getByTestId('patient-brief').waitFor();
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  await page.screenshot({ path: 'outputs/qa/wound-patient-mobile-dark.png', fullPage: true, animations: 'disabled' });

  await page.getByRole('link', { name: 'Lịch sử & ghi nhận', exact: true }).click();
  assert.ok(page.url().endsWith('/wounds/history'));
  await page.getByRole('heading', { name: 'Assessment history', exact: true }).waitFor();
  await page.getByLabel('Observation notes').fill('Read-only QA: no save');
  await page.getByRole('slider').fill('3');
  await page.getByLabel('Fever or feeling seriously unwell', { exact: true }).check();
  const stored = await page.request.get(base + '/api/wounds');
  assert.equal(stored.status(), 200);
  assert.ok(Array.isArray((await stored.json()).cases));
  const entry = page.getByRole('link', { name: 'Phân tích ảnh AI', exact: true });
  await entry.waitFor({ timeout: 60000 });
  assert.equal(await entry.getAttribute('href'), '/wounds');
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  await entry.click();
  await page.getByTestId('wound-analyzer').waitFor();
  assert.deepEqual(errors, []);
  console.log('PASS Patient/Developer modes, fixed patient identity, all five profiles, live Base64/U-Net panels, loading lock, 422/network errors, quality abstention, old-server fallback, dark/mobile layouts, sample and history.');
} catch (error) {
  await page.screenshot({ path: 'outputs/qa/wound-analyzer-failure.png', fullPage: true }).catch(() => {});
  throw error;
} finally {
  await browser.close();
}
