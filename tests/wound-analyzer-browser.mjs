import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile } from 'node:fs/promises';
import { chromium } from '../outputs/qa/node_modules/playwright/index.mjs';
import { MOCK_WOUND_PATIENTS } from '../lib/wound-patients.ts';

// Frontend contract QA: all session reads, writes, images and deletes are routed
// to an in-memory fixture. No real SQLite, Supabase or owner data is touched.
const base = process.env.MEDIPASS_TEST_URL || 'http://localhost:3001';
assert.ok(['localhost', '127.0.0.1'].includes(new URL(base).hostname));
const origin = new URL(base).origin;
const sample = await readFile('public/wound-demo/day_007_rgb.png');
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1050 }, colorScheme: 'light', timezoneId: 'UTC' });
const page = await context.newPage();
const errors = [], requests = [], sessions = new Map();
let feedbackWrites = 0;
let sequence = 0, failure, scenario = 'stagnant';
const nextId = () => (++sequence).toString(16).padStart(32, '0');
const baselineDate = new Date(Date.now() - 21 * 86_400_000);
baselineDate.setUTCHours(10, 0, 0, 0);
const atDay = day => new Date(baselineDate.getTime() + day * 86_400_000).toISOString();
page.on('pageerror', error => errors.push(error.message));
await mkdir('outputs/qa', { recursive: true });
await context.route(url => url.origin === origin && url.pathname === '/api/feedback', route => {
  if (route.request().method() !== 'GET') {
    feedbackWrites++;
    return route.fulfill({ status: 400, json: { error: 'Browser QA must not save feedback' } });
  }
  return route.fulfill({ status: 200, json: { requests: [] } });
});

function makeBrief(session, captures = session.captures) {
  const capture = captures.at(-1);
  if (!capture) return null;
  const profile = session.patient_profile;
  const visits = captures.map(item => ({
    day: item.day, timestamp: item.timestamp, image_name: item.name, image_sha256: item.hash,
    analysis_status: item.scenario === 'pending' ? 'pending_model' : 'complete',
    risk_deterioration_score: ['quality', 'pending'].includes(item.scenario) ? null : .42,
    quality: { usable_for_demo: !['quality', 'pending'].includes(item.scenario), reasons: item.scenario === 'quality' ? ['extreme_exposure'] : [] },
    measurement_status: ['quality', 'pending'].includes(item.scenario) ? 'unavailable' : 'available', measurement_source: 'binary_wound_mask_v2',
    tissue_percentages: ['quality', 'pending'].includes(item.scenario) ? null : item.scenario === 'improving'
      ? { granulation: 55, slough: 25, necrotic: 20 } : { granulation: 40, slough: 35, necrotic: 25 },
    unclassified_percentage: ['quality', 'pending'].includes(item.scenario) ? null : 0,
    area_cm2: ['quality', 'pending'].includes(item.scenario) ? null : item.scenario === 'improving' ? 3.49995 : 4,
    wound_area_pixels: ['quality', 'pending'].includes(item.scenario) ? null : item.scenario === 'improving' ? 34999 : 40000,
    capture_conditions_consistent: item.consistent,
  }));
  const last = visits.at(-1), prev = visits.at(-2);
  const comparable = !!prev?.tissue_percentages && !!last.tissue_percentages;
  const elapsed = prev ? last.day - prev.day : 0;
  const highRisk = comparable && elapsed >= 7 && last.area_cm2 === prev.area_cm2 && (profile.has_diabetes_type_2 || profile.hba1c_level > 8);
  const comparison = prev ? {
    from_day: prev.day, to_day: last.day, elapsed_days: elapsed, comparison_consistent: comparable,
    tissue_comparison_available: comparable, area_comparison_available: comparable,
    change_percentage_points: comparable ? Object.fromEntries(['granulation', 'slough', 'necrotic'].map(key => [key, last.tissue_percentages[key] - prev.tissue_percentages[key]])) : null,
    unclassified_change_pp: comparable ? 0 : null,
    area_change_cm2: comparable ? last.area_cm2 - prev.area_cm2 : null,
    area_change_pixels: comparable ? last.wound_area_pixels - prev.wound_area_pixels : null,
    area_trend_change_percent: comparable ? 100 * (last.area_cm2 - prev.area_cm2) / prev.area_cm2 : null,
    pixel_comparison_supports_trend: comparable && last.capture_conditions_consistent && prev.capture_conditions_consistent,
  } : null;
  const locale = language => ({
    simple_explanation: `${language} · Results for day ${last.day}; ${visits.length} images were evaluated.`,
    baseline_context: `${language} · Recorded baseline HbA1c ${profile.hba1c_level}%; type 2 diabetes: ${profile.has_diabetes_type_2 ? 'recorded' : 'not recorded'}.`,
    why_this_matters: `${language} · The biological mechanism supplied by the server must be displayed in full.`,
    possible_consequences: `${language} · Conditional consequences from the server, not a diagnosis.`,
    what_to_do: Array.from({ length: 6 }, (_, index) => ({ action_id: `action-${index}`, text: `${language} · Complete guidance item ${index + 1}.` })),
    when_to_seek_care: `${language} · Signs that require contacting a clinician from the saved result.`,
    measurement_note: `${language} · Color labels are image estimates and do not confirm tissue.`,
    rule_note: highRisk ? `${language} · The seven-day threshold is a research rule.` : '',
    safety_note: `${language} · Scores are uncalibrated and require professional review.`,
  });
  const explanation = { locales: { vi: locale('VI'), en: locale('EN') }, clinical_validation: false };
  const alerts = highRisk ? [{ rule_id: 'high_risk_non_healing_trajectory', scope: 'latest', elapsed_days: elapsed }] : [];
  return {
    patient_id: session.patient_id,
    objective_measurements: { visits, trajectory_available: comparable, latest_change: comparison },
    multimodal_context_analysis: 'Synthetic contract QA narrative', system_recommendation: 'Synthetic contract QA guidance',
    patient_explanation: explanation,
    pipeline_visuals: {
      status: capture.scenario === 'pending' ? 'unavailable' : capture.scenario === 'quality' ? 'quality_abstained' : 'available',
      original_image: capture.buffer.toString('base64'), original_mime_type: 'image/png',
      unet_segmentation_mask: ['quality', 'pending'].includes(capture.scenario) ? null : capture.buffer.toString('base64'),
      tissue_analysis_overlay: ['quality', 'pending'].includes(capture.scenario) ? null : capture.buffer.toString('base64'),
      model: { version: 'qa-fixture-not-inference' },
    },
    trajectory_risk_assessment: {
      latest_comparison: comparison,
      healing_status: !comparable ? 'insufficient_data' : capture.scenario === 'improving' ? 'improving' : 'stagnant',
      Deterioration_Risk_Score: comparable ? .55 : null, Uncertainty_Score: .65,
      non_healing_trajectory: { flagged: highRisk, elapsed_days: elapsed, from_day: prev?.day, to_day: last.day },
      risk_alerts: alerts, patient_explanation: explanation,
    },
    risk_alerts: alerts, uncertainty: { calibrated: false }, provenance: { model_version: 'qa-fixture-not-inference' },
    limitations: ['Synthetic UI contract fixture; no inference or clinical validation is performed by this test.'],
  };
}
function snapshot(session) {
  return {
    session_id: session.session_id, patient_id: session.patient_id, patient_profile: session.patient_profile,
    created_at: session.created_at, storage_provider: 'local_sqlite', baseline_locked: true,
    visits: session.captures.map(({ visit_id, day, timestamp, scenario: captureScenario }) => ({ visit_id, day, timestamp, image_path: `/api/wound-sessions/${session.session_id}/visits/${visit_id}/image`, analysis_status: captureScenario === 'pending' ? 'pending_model' : 'complete' })),
    brief: makeBrief(session),
  };
}
async function readForm(request) {
  return new Request(request.url(), { method: 'POST', headers: { 'content-type': request.headers()['content-type'] }, body: request.postDataBuffer() }).formData();
}
function formText(form, key) {
  const value = form.get(key);
  assert.equal(typeof value, 'string', `Multipart text field ${key} is required`);
  if (typeof value !== 'string') throw new Error(`Invalid multipart field ${key}`);
  return value;
}
await context.route(url => url.origin === origin && url.pathname.startsWith('/api/wound-sessions'), async route => {
  const request = route.request(), url = new URL(request.url());
  const parts = url.pathname.slice('/api/wound-sessions'.length).split('/').filter(Boolean);
  const method = request.method(), patientId = url.searchParams.get('patient_id');
  requests.push({ method, path: url.pathname, patientId });
  if (failure?.method === method && failure.matches(parts)) {
    const current = failure; failure = undefined;
    return current.abort ? route.abort('connectionrefused') : route.fulfill({ status: current.status || 200, json: current.payload });
  }
  const fulfill = json => route.fulfill({ status: 200, json });
  if (!parts.length && method === 'GET') return fulfill({ storage_provider: 'local_sqlite', sessions: [...sessions.values()].filter(session => session.patient_id === patientId).map(session => ({
    session_id: session.session_id, patient_id: session.patient_id, created_at: session.created_at,
    updated_at: session.captures.at(-1)?.timestamp || session.created_at, visit_count: session.captures.length,
    latest_day: session.captures.at(-1)?.day ?? null, storage_provider: 'local_sqlite', baseline_locked: true,
  })).reverse() });
  if (!parts.length && method === 'POST') {
    const profile = JSON.parse(formText(await readForm(request), 'patient_data'));
    assert.ok(MOCK_WOUND_PATIENTS.some(patient => patient.patient_id === profile.patient_id));
    assert.equal(typeof profile.fpg_mg_dl, 'number');
    assert.equal(typeof profile.peripheral_vascular_status, 'string');
    const session = { session_id: nextId(), patient_id: profile.patient_id, patient_profile: profile, created_at: new Date().toISOString(), captures: [] };
    sessions.set(session.session_id, session);
    return fulfill(snapshot(session));
  }
  const session = sessions.get(parts[0]);
  if (!session) return route.fulfill({ status: 404, json: { detail: 'Synthetic session not found' } });
  if (method === 'POST' && parts[1] === 'visits' && parts.length === 2) {
    const form = await readForm(request), file = form.get('image');
    assert.equal(form.get('patient_id'), session.patient_id);
    const buffer = Buffer.from(await file.arrayBuffer());
    const capture = { visit_id: nextId(), day: Number(formText(form, 'day')), timestamp: formText(form, 'timestamp'), name: file.name,
      hash: createHash('sha256').update(buffer).digest('hex'), buffer, scenario, consistent: form.get('capture_conditions_consistent') === 'true' };
    assert.ok(!session.captures.some(item => item.hash === capture.hash), 'Fixtures must be distinct captures');
    session.captures.push(capture);
    await new Promise(resolve => setTimeout(resolve, 250));
    return fulfill(snapshot(session));
  }
  assert.equal(patientId, session.patient_id, 'Reads/images/deletes must retain patient scope');
  if (parts.length === 1 && method === 'GET') return fulfill(snapshot(session));
  if (parts.length === 1 && method === 'DELETE') { sessions.delete(session.session_id); return fulfill({ deleted: true, session_id: session.session_id }); }
  const index = session.captures.findIndex(capture => capture.visit_id === parts[2]);
  if (index < 0) return route.fulfill({ status: 404, json: { detail: 'Synthetic visit not found' } });
  const capture = session.captures[index];
  if (parts[3] === 'image') return route.fulfill({ status: 200, contentType: 'image/png', body: capture.buffer });
  if (parts[3] === 'analyze' && method === 'POST') { capture.scenario = 'stagnant'; return fulfill(snapshot(session)); }
  if (method === 'DELETE') { session.captures.splice(index, 1); return fulfill(snapshot(session)); }
  if (method === 'GET') return fulfill({ session_id: session.session_id, visit_id: capture.visit_id, patient_id: session.patient_id, brief: makeBrief(session, session.captures.slice(0, index + 1)) });
  throw new Error(`Unhandled mocked request: ${method} ${url.pathname}`);
});

async function ready() {
  await page.locator('[data-testid="multi-visit-workflow"][aria-busy="false"]').waitFor({ timeout: 30_000 });
  await page.locator('[data-slot="switch"]:not([data-disabled])').waitFor();
}
async function openAnalyzer(path = '/wound-analyzer') {
  await page.goto(base + path);
  await page.locator('[data-testid="wound-analyzer"][data-ready="true"]').waitFor({ timeout: 60_000 });
  await ready();
}
async function noOverflow() { assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'No horizontal overflow'); }
async function assertFloatingControlsSeparate() {
  const pill = await page.locator('.mp-theme-toggle').boundingBox();
  const toolbar = await page.locator('.mp-review-toolbar').boundingBox();
  assert.ok(pill && toolbar, 'Theme control and review toolbar are visible');
  const overlaps = pill.x < toolbar.x + toolbar.width && pill.x + pill.width > toolbar.x
    && pill.y < toolbar.y + toolbar.height && pill.y + pill.height > toolbar.y;
  assert.equal(overlaps, false, 'Theme pill must not overlap the mobile toolbar');
}
async function assertDarkClinicalPalette() {
  const rgb = await page.getByTestId('wound-clinical-history').locator('details[data-encounter-id]').first().evaluate(element => {
    // Canvas normalizes both rgb() and Tailwind oklch() into comparable sRGB.
    const canvas = document.createElement('canvas'); canvas.width = 1; canvas.height = 1;
    const drawing = canvas.getContext('2d');
    drawing.fillStyle = getComputedStyle(element).backgroundColor;
    drawing.fillRect(0, 0, 1, 1);
    return Array.from(drawing.getImageData(0, 0, 1, 1).data).slice(0, 3);
  });
  // Tailwind's oklch slate-900 can round a channel by 1 during sRGB conversion.
  assert.ok(rgb.every((channel, index) => Math.abs(channel - [15, 23, 42][index]) <= 2), `Dark clinical card must be Deep Slate, received rgb(${rgb.join(',')})`);
  assert.equal(await page.getByTestId('wound-analyzer').evaluate(element => getComputedStyle(element).getPropertyValue('--card').trim()), '#0f172a');
}
async function addCapture(day, marker, nextScenario = 'stagnant') {
  scenario = nextScenario;
  // PNG trailing bytes make distinct hashes while preserving a decodable raster;
  // the test verifies upload contracts, not the fully mocked model inference.
  await page.getByLabel('Choose one or more images', { exact: true }).setInputFiles({ name: `synthetic-ui-${marker}.png`, mimeType: 'image/png', buffer: Buffer.concat([sample, Buffer.from(`\nsynthetic-ui-${marker}`)]) });
  await page.getByLabel('Capture date and time 1', { exact: true }).fill(atDay(day).slice(0, 16));
  await page.getByLabel('Image scale for capture 1', { exact: true }).fill('100');
  await page.getByTestId('visit-draft').getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Save & analyze', exact: true }).click();
  await page.getByRole('button', { name: 'Processing…', exact: true }).waitFor();
  await page.locator('[data-slot="switch"][data-disabled]').waitFor({ timeout: 5_000 });
  assert.equal(await page.getByRole('switch', { name: 'Developer Mode' }).isDisabled(), true);
  await ready();
  await page.getByTestId('current-wound-measurements').waitFor();
}
async function assertSavedCount(count) {
  await page.getByTestId('saved-visits').getByText(`${count} saved captures`, { exact: true }).waitFor();
  assert.equal(await page.getByTestId('saved-visits').locator('article').count(), count);
}
async function assertEducation(language = 'EN') {
  const text = await page.getByTestId('patient-education').innerText();
  for (const fragment of ['Results for day', 'Recorded baseline HbA1c', 'The biological mechanism', 'Conditional consequences', 'Complete guidance item 6.', 'Signs that require contacting a clinician', 'Scores are uncalibrated']) {
    assert.ok(text.includes(`${language} · ${fragment}`), `Entire education field: ${fragment}`);
  }
}

try {
  if (process.argv.includes('--visual-only') || process.env.MEDIPASS_WOUND_VISUAL_ONLY === '1') {
    const fixture = { session_id: nextId(), patient_id: 'SYN000014', patient_profile: { ...MOCK_WOUND_PATIENTS[0] }, created_at: new Date().toISOString(), captures: [{
      visit_id: nextId(), day: 0, timestamp: atDay(0), name: 'synthetic-visual-qa.png',
      hash: createHash('sha256').update(sample).digest('hex'), buffer: sample, scenario: 'stagnant', consistent: true,
    }] };
    sessions.set(fixture.session_id, fixture);
    await page.goto(base + '/signin-with-chatgpt?return_to=/wounds');
    await page.setViewportSize({ width: 390, height: 844 });
    await openAnalyzer('/wounds'); await assertSavedCount(1);
    if (!(await page.locator('html').evaluate(element => element.classList.contains('dark')))) await page.locator('.mp-theme-toggle').click();
    await page.locator('html.dark').waitFor();
    await assertDarkClinicalPalette(); await assertFloatingControlsSeparate(); await noOverflow();
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: 'outputs/qa/wound-mobile-dark-top-final.png', animations: 'disabled' });
    await page.getByTestId('current-wound-measurements').evaluate(element => element.scrollIntoView({ block: 'start' }));
    await page.screenshot({ path: 'outputs/qa/wound-mobile-dark-result-final.png', animations: 'disabled' });
    const encounter = page.getByTestId('wound-clinical-history').locator('details[data-encounter-id]').first();
    await encounter.locator('summary').click();
    await encounter.evaluate(element => element.scrollIntoView({ block: 'start' }));
    await page.screenshot({ path: 'outputs/qa/wound-mobile-dark-accordion-final.png', animations: 'disabled' });
    assert.deepEqual(errors, []);
    console.log('PASS focused 390px visual QA: Deep Slate clinical card, theme pill separated from toolbar, no horizontal overflow. Mock session only; no persistence writes.');
  } else {
  await page.goto(base + '/signin-with-chatgpt?return_to=/wound-analyzer');
  await openAnalyzer();
  assert.equal(await page.getByRole('switch', { name: 'Developer Mode' }).isChecked(), false);
  assert.equal(await page.getByRole('combobox', { name: 'Select simulated patient' }).count(), 0);
  assert.equal(await page.getByRole('button', { name: 'Save & analyze', exact: true }).isDisabled(), true);
  assert.equal(await page.getByLabel('Take a photo with the camera', { exact: true }).getAttribute('capture'), 'environment');
  await addCapture(0, 'first');
  await assertSavedCount(1);
  const patientSession = [...sessions.values()][0];
  assert.equal(patientSession.patient_id, 'SYN000014');
  assert.equal(await page.getByTestId('longitudinal-tracking').count(), 0);
  assert.equal(await page.getByTestId('pipeline-visualization').count(), 0);
  assert.match(await page.getByTestId('fused-baseline-context').innerText(), /9\.6%/);
  assert.match(await page.getByTestId('current-wound-measurements').innerText(), /40\.0%/);
  await assertEducation();
  await assertEducation('EN');
  await noOverflow();
  await page.screenshot({ path: 'outputs/qa/wound-patient-single-light.png', fullPage: true, animations: 'disabled' });
  await addCapture(7, 'second');
  await assertSavedCount(2);
  assert.equal(sessions.size, 1, 'Follow-up appends to the same session');
  await page.getByTestId('high-risk-non-healing-alert').waitFor();
  assert.match(await page.getByTestId('healing-status').innerText(), /Stagnant/);
  assert.match(await page.getByTestId('longitudinal-tracking').innerText(), /0 cm²/);
  assert.match(await page.getByTestId('longitudinal-tracking').innerText(), /Day 0 → day 7/);

  await page.evaluate(() => localStorage.clear());
  await page.reload(); await ready(); await assertSavedCount(2);
  await page.getByTestId('high-risk-non-healing-alert').waitFor();
  await page.getByRole('switch', { name: 'Developer Mode' }).check(); await ready();
  await page.getByTestId('pipeline-visualization').waitFor();
  assert.equal(await page.getByTestId('pipeline-visualization').getByRole('article').count(), 4);
  assert.equal(await page.getByTestId('pipeline-visualization').locator('img').count(), 3);
  await page.getByTestId('saved-visits').getByRole('button', { name: /^View capture/ }).first().click(); await ready();
  await page.getByTestId('pipeline-visualization').getByRole('heading', { name: 'Pipeline Visualization · Day 0', exact: true }).waitFor();
  assert.equal(await page.getByTestId('longitudinal-tracking').count(), 0, 'Historical selection uses the matching cumulative brief');
  assert.equal(await page.getByTestId('pipeline-visualization').locator('img').first().getAttribute('src'), `/api/wound-sessions/${patientSession.session_id}/visits/${patientSession.captures[0].visit_id}/image?patient_id=SYN000014`);
  assert.equal(await page.getByTestId('pipeline-visualization').locator('img').nth(1).getAttribute('src'), `data:image/png;base64,${patientSession.captures[0].buffer.toString('base64')}`);
  await page.getByTestId('saved-visits').getByRole('button', { name: /^View capture/ }).last().click(); await ready();

  const profiles = page.getByRole('combobox', { name: 'Select simulated patient' });
  assert.equal(await profiles.locator('option').count(), 5);
  for (const patient of MOCK_WOUND_PATIENTS.slice(1)) {
    await profiles.selectOption(patient.patient_id); await ready();
    assert.equal(await page.getByTestId('saved-visits').count(), 0);
    assert.equal(await page.getByTestId('pipeline-visualization').count(), 0);
    assert.ok(requests.some(request => request.path === '/api/wound-sessions' && request.patientId === patient.patient_id));
  }
  await profiles.selectOption('MOCK-002'); await ready(); await addCapture(0, 'other-profile');
  assert.equal(sessions.size, 2);
  await page.getByRole('switch', { name: 'Developer Mode' }).uncheck(); await ready(); await assertSavedCount(2);
  assert.match(await page.getByTestId('fused-baseline-context').innerText(), /9\.6%/);
  assert.equal(await page.getByTestId('pipeline-visualization').count(), 0);

  const history = page.getByTestId('wound-clinical-history');
  const cards = history.locator('details[data-encounter-id]');
  assert.equal(await cards.count(), 4);
  for (let index = 0; index < await cards.count(); index++) {
    const encounter = cards.nth(index);
    if (!(await encounter.evaluate(element => element.open))) await encounter.locator('summary').click();
    for (const label of ['Vitals & laboratory results', 'Wound status & procedures', 'Medications & dressings', 'Care & follow-up']) {
      assert.equal(await encounter.getByRole('heading', { name: label, exact: true }).isVisible(), true);
    }
    const sourceId = await encounter.getAttribute('data-encounter-id');
    const source = MOCK_WOUND_PATIENTS[0].clinical_visits.find(visit => visit.visit_id === sourceId);
    assert.ok(source, 'Each accordion maps to the complete original visit');
    const normalize = value => String(value).replace(/\s+/g, ' ').trim();
    const visibleText = normalize(await encounter.innerText());
    const preserved = [source.summary, source.encounter_type, source.clinician.name, source.clinician.specialty, source.record_source,
      source.wound.site, source.wound.edge_state, source.wound.exudate, source.wound.surrounding_skin, source.wound.measurement_note,
      ...source.wound.procedures, ...source.medications.flatMap(medication => Object.values(medication)),
      ...source.dressings.flatMap(dressing => Object.values(dressing)), source.care.offloading, source.care.dressing_protocol,
      source.care.monitoring, source.care.follow_up_location, ...source.care.additional_notes,
      ...source.measurements.flatMap(measurement => [measurement.code, measurement.label, measurement.value, measurement.unit, measurement.reference_range])];
    for (const value of preserved) assert.ok(visibleText.includes(normalize(value)), `Clinical detail retained in ${sourceId}: ${value}`);
    assert.equal(await encounter.locator(`time[datetime="${source.care.follow_up_date}"]`).count() >= 1, true);
  }
  await page.setViewportSize({ width: 390, height: 844 }); await noOverflow(); await assertFloatingControlsSeparate();
  await page.screenshot({ path: 'outputs/qa/wound-patient-mobile-light.png', fullPage: true, animations: 'disabled' });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: 'outputs/qa/wound-mobile-light-top-viewport.png', animations: 'disabled' });
  await page.getByTestId('longitudinal-tracking').evaluate(element => element.scrollIntoView({ block: 'start' }));
  await page.screenshot({ path: 'outputs/qa/wound-mobile-light-result-viewport.png', animations: 'disabled' });
  await page.locator('.mp-theme-toggle').click(); await page.locator('html.dark').waitFor(); await noOverflow();
  await assertDarkClinicalPalette(); await assertFloatingControlsSeparate();
  await page.screenshot({ path: 'outputs/qa/wound-patient-mobile-dark.png', fullPage: true, animations: 'disabled' });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: 'outputs/qa/wound-mobile-dark-top-viewport.png', animations: 'disabled' });
  await cards.first().evaluate(element => element.scrollIntoView({ block: 'start' }));
  await page.screenshot({ path: 'outputs/qa/wound-mobile-dark-accordion-viewport.png', animations: 'disabled' });
  await page.getByRole('switch', { name: 'Developer Mode' }).check(); await ready();
  await page.getByRole('combobox', { name: 'Select simulated patient' }).selectOption('SYN000014'); await ready();
  await page.getByTestId('pipeline-visualization').waitFor(); await noOverflow();
  await page.screenshot({ path: 'outputs/qa/wound-developer-mobile-dark.png', fullPage: true, animations: 'disabled' });
  await page.getByTestId('pipeline-visualization').evaluate(element => element.scrollIntoView({ block: 'start' }));
  await page.screenshot({ path: 'outputs/qa/wound-mobile-dark-pipeline-viewport.png', animations: 'disabled' });
  await addCapture(14, 'improving', 'improving'); await assertSavedCount(3);
  assert.match(await page.getByTestId('healing-status').innerText(), /Improving/);
  assert.ok((await page.getByTestId('longitudinal-tracking').innerText()).includes(String(makeBrief(patientSession).objective_measurements.latest_change.area_change_cm2)), 'Show the exact numeric delta from the response');
  assert.match(await page.getByTestId('longitudinal-tracking').innerText(), /\+15/);

  const deleteBefore = requests.filter(request => request.method === 'DELETE').length;
  const touchTarget = await page.getByTestId('saved-visits').getByRole('button', { name: /^Delete capture/ }).last().boundingBox();
  assert.ok(touchTarget?.height >= 44 && touchTarget.width >= 44, 'Delete remains a usable phone-sized touch target');
  await page.getByTestId('saved-visits').getByRole('button', { name: /^Delete capture/ }).last().click();
  await page.getByRole('alertdialog').waitFor(); await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  assert.equal(requests.filter(request => request.method === 'DELETE').length, deleteBefore);
  await assertSavedCount(3);
  await page.getByTestId('saved-visits').getByRole('button', { name: /^Delete capture/ }).last().click();
  await page.getByRole('button', { name: 'Confirm deletion', exact: true }).click(); await ready(); await assertSavedCount(2);
  assert.equal(patientSession.captures.length, 2);
  assert.equal([...sessions.values()].find(session => session.patient_id === 'MOCK-002').captures.length, 1);
  await addCapture(15, 'poor-quality', 'quality'); await assertSavedCount(3);
  assert.match(await page.getByTestId('healing-status').innerText(), /Insufficient comparable data/);
  assert.ok(!(await page.getByTestId('current-wound-measurements').innerText()).includes('0.0%'));
  assert.equal(await page.getByTestId('pipeline-visualization').locator('img').count(), 1);

  const badSnapshot = snapshot(patientSession); badSnapshot.patient_id = 'WRONG-PATIENT';
  failure = { method: 'GET', matches: parts => parts.length === 1, payload: badSnapshot };
  await page.getByRole('button', { name: 'Reload session', exact: true }).click();
  await page.getByRole('alert').filter({ hasText: 'does not match the patient' }).waitFor();
  await page.getByRole('button', { name: 'Reload session', exact: true }).click(); await ready(); await assertSavedCount(3);
  failure = { method: 'GET', matches: parts => parts.length === 0, abort: true };
  await page.getByRole('button', { name: 'Reload session', exact: true }).click();
  await page.getByRole('alert').filter({ hasText: 'Cannot connect to the tracking service' }).waitFor();
  assert.equal(patientSession.captures.length, 3, 'A network failure preserves saved captures');
  await page.getByRole('button', { name: 'Reload session', exact: true }).click(); await ready();
  await page.getByRole('button', { name: 'Delete session', exact: true }).click(); await page.getByRole('alertdialog').waitFor();
  await page.getByRole('button', { name: 'Confirm deletion', exact: true }).click(); await ready();
  assert.equal(sessions.has(patientSession.session_id), false);
  assert.equal(sessions.size, 1, 'Other patient remains intact');
  assert.equal(await page.getByTestId('saved-visits').count(), 0);
  await openAnalyzer('/wounds');
  assert.equal(await page.getByTestId('saved-visits').count(), 0, 'Explicit deletion survives refresh');
  await addCapture(0, 'missing-model', 'pending');
  await assertSavedCount(1);
  await page.getByTestId('pending-model-capture').waitFor();
  assert.ok(!(await page.getByTestId('patient-brief').innerText()).includes('The first image has been analyzed'));
  assert.ok(!(await page.getByTestId('current-wound-measurements').innerText()).includes('0.0%'));
  const uploadCount = requests.filter(request => request.method === 'POST' && request.path.endsWith('/visits')).length;
  await page.getByRole('button', { name: 'Analyze saved image again', exact: true }).click();
  await ready();
  await page.getByTestId('pending-model-capture').waitFor({ state: 'detached' });
  await assertSavedCount(1);
  assert.equal(requests.filter(request => request.method === 'POST' && request.path.endsWith('/visits')).length, uploadCount, 'Retry must reuse stored image');
  assert.match(await page.getByTestId('current-wound-measurements').innerText(), /40\.0%/);
  await noOverflow();

  // Shared-shell lint fixes must preserve region selection and closing a draft.
  // Feedback reads are mocked and every attempted write is blocked above.
  await page.getByRole('button', { name: 'Annotate interface', exact: true }).click();
  await page.getByRole('button', { name: 'Turn off annotations', exact: true }).waitFor();
  await page.getByRole('heading', { name: 'Add a tracking visit', exact: true }).click();
  await page.getByRole('dialog').getByRole('heading', { name: 'Pin a comment here', exact: true }).waitFor();
  await page.getByRole('dialog').getByRole('button', { name: 'Close comment', exact: true }).click();
  await page.getByRole('dialog').waitFor({ state: 'detached' });
  await page.getByRole('button', { name: 'Turn off annotations', exact: true }).click();
  assert.equal(feedbackWrites, 0, 'Opening and closing annotation does not save');

  await page.setViewportSize({ width: 1200, height: 1000 });
  await page.goto(base + '/mobile?path=%2Fwounds');
  const phone = page.frameLocator('iframe[title="MediPass mobile preview"]');
  await phone.locator('[data-testid="wound-analyzer"][data-ready="true"]').waitFor({ timeout: 60_000 });
  await phone.getByTestId('saved-visits').getByText('1 saved captures', { exact: true }).waitFor();
  const wasDark = await page.locator('html').evaluate(element => element.classList.contains('dark'));
  await phone.locator(wasDark ? 'html.dark' : 'html:not(.dark)').waitFor();
  await page.locator('.mp-theme-toggle').click();
  await phone.locator(wasDark ? 'html:not(.dark)' : 'html.dark').waitFor();
  await phone.locator('.mp-theme-toggle').click();
  await page.locator(wasDark ? 'html.dark' : 'html:not(.dark)').waitFor();
  const frame = await (await page.locator('iframe[title="MediPass mobile preview"]').elementHandle()).contentFrame();
  assert.equal(await frame.evaluate(() => innerWidth), 390);
  assert.ok(await frame.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  await page.screenshot({ path: 'outputs/qa/wound-mobile-preview-theme-sync.png', animations: 'disabled' });
  assert.deepEqual(errors, []);
  console.log('PASS persistent single/multi-capture workflow, complete English education, exact deltas/high-risk alert, five scoped profiles, server restore, historical pipeline, complete clinical accordions, 390px light/dark, delete/cancel, quality/pending-model retry, mismatch/network handling, annotation open/close without save, mobile iframe two-way theme sync. Session and feedback storage mocked.');
  }
} catch (error) {
  await page.screenshot({ path: 'outputs/qa/wound-analyzer-failure.png', fullPage: true }).catch(() => {});
  throw error;
} finally { await browser.close(); }
