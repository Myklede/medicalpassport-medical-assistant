// Read-only navigation QA. All /api requests use isolated in-memory fixtures;
// no clinical, feedback, SQLite or Supabase data is written.
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from '../outputs/qa/node_modules/playwright/index.mjs';
import { demoPatients, demoClinicians, demoEncounters } from '../lib/portal-seed.ts';

const base = process.env.MEDIPASS_TEST_URL || 'http://localhost:3001';
const origin = new URL(base).origin;
assert.ok(['localhost', '127.0.0.1'].includes(new URL(base).hostname), 'Local QA only');
const patients = demoPatients();
const encounters = demoEncounters();
const portal = {
  patients, clinicians: demoClinicians, demo: true,
  storage: { provider: 'd1', connected: true, project_url: null, label: 'Isolated navigation fixture', schema_version: 1 },
};
const legacy = {
  patient: { id: 'qa-legacy-patient-unrelated', display_name: 'Legacy navigation fixture', birth_date: '1980-01-01', blood_type: 'O+', preferred_language: 'en', emergency_contact_name: null, emergency_contact_phone: null },
  user: { display_name: 'Isolated navigation QA' }, access: { role: 'owner', can_write: true },
  records: [], persistence: 'isolated-navigation-fixture',
};

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, colorScheme: 'light' });
const errors = [], writes = [], unexpected = [], recordsReads = [];
await context.route(url => url.origin === origin && url.pathname.startsWith('/api/'), route => {
  const request = route.request(), url = new URL(request.url());
  if (request.method() !== 'GET') {
    writes.push(`${request.method()} ${url.pathname}`);
    return route.fulfill({ status: 405, json: { error: 'Navigation QA cannot mutate data' } });
  }
  if (url.pathname === '/api/feedback') return route.fulfill({ json: { requests: [] } });
  if (url.pathname === '/api/portal') return route.fulfill({ json: portal });
  if (url.pathname === '/api/portal/data') return route.fulfill({ json: { ...portal, encounters } });
  if (url.pathname === '/api/portal/encounters') return route.fulfill({ json: { encounters: encounters.filter(visit => visit.patient_id === url.searchParams.get('patient_id')) } });
  if (url.pathname === '/api/records') {
    recordsReads.push(url.pathname + url.search);
    return route.fulfill({ json: legacy });
  }
  unexpected.push(url.pathname + url.search);
  return route.fulfill({ status: 404, json: { error: 'No navigation fixture for this API' } });
});
const page = await context.newPage();
page.on('pageerror', error => errors.push(`${page.url()}: ${error.message}`));
page.setDefaultTimeout(15_000);
await mkdir('outputs/qa/records-navigation', { recursive: true });

function hrefPatient(href, expectedPatient, pathname = '/editor') {
  const url = new URL(href, origin);
  assert.equal(url.origin, origin, 'Navigation must remain same-origin');
  assert.equal(url.pathname, pathname);
  assert.equal(url.searchParams.get('patient'), expectedPatient || null);
  assert.deepEqual([...url.searchParams.keys()], expectedPatient ? ['patient'] : [], 'Only return patient context is propagated');
}

async function loadedPortal(target = page, patient = patients[0]) {
  const heading = target.locator('.mp-patient-heading h2');
  await heading.waitFor();
  await target.waitForFunction(expected => document.querySelector('.mp-patient-heading h2')?.textContent === expected, patient.display_name);
  assert.equal(await heading.innerText(), patient.display_name);
  const current = new URL(target.url());
  assert.equal(current.origin, origin);
  assert.equal(current.searchParams.get('patient'), patient.id);
}

async function recordsHeader(target = page, patientId = '') {
  const link = target.getByTestId('records-hospital-link');
  await link.waitFor();
  assert.equal(await link.isVisible(), true, 'Hospital return must be visible without opening menu');
  assert.equal(await link.innerText(), 'Cổng bệnh viện');
  assert.equal(await link.evaluate(element => element.tagName), 'A', 'Return must be a real AppLink anchor');
  assert.equal(await link.evaluate(element => Boolean(element.closest('header'))), true, 'Return remains in sticky header');
  hrefPatient(await link.getAttribute('href'), patientId);
  const rect = await link.evaluate(element => {
    const { x, y, width, height } = element.getBoundingClientRect();
    return { x, y, width, height };
  });
  assert.ok(rect && rect.width >= 44 && rect.height >= 44, 'Return tap target at least 44 px');
  const viewport = await target.evaluate(() => ({ width: innerWidth, height: innerHeight, overflow: document.documentElement.scrollWidth > innerWidth + 1 }));
  assert.equal(viewport.overflow, false, 'No horizontal overflow');
  assert.ok(rect.x >= 0 && rect.x + rect.width <= viewport.width + 1 && rect.y >= 0 && rect.y + rect.height <= viewport.height, 'Return is initially inside viewport');
  assert.equal(await target.getByRole('link', { name: 'Care team', exact: true }).count(), 0, 'No false-active legacy Care team switch');
  const home = target.getByRole('link', { name: 'Về sảnh MediPass', exact: true });
  assert.equal(await home.getAttribute('href'), '/');
  await target.getByText('Hồ sơ trước đây · module riêng', { exact: true }).first().waitFor();
  return link;
}

try {
  await page.goto(base + '/signin-with-chatgpt?return_to=/editor');
  for (const width of [1440, 390, 360]) {
    for (const theme of ['light', 'dark']) {
      await page.setViewportSize({ width, height: width > 1000 ? 1000 : 844 });
      await page.evaluate(value => localStorage.setItem('medipass-theme', value), theme);

      for (const [path, selected] of [['/editor', patients[3]], ['/patient', patients[1]]]) {
        await page.goto(base + path);
        await loadedPortal();
        await page.locator('.mp-patient-row').filter({ hasText: selected.display_name }).click();
        await loadedPortal(page, selected);
        const entries = page.locator('a[href^="/records"]');
        assert.equal(await entries.count(), 2, 'Desktop rail and mobile tool links both exist');
        for (const entry of await entries.all()) hrefPatient(await entry.getAttribute('href'), selected.id, '/records');
        await page.locator('a[href^="/records"]:visible').first().click();
        await page.waitForURL(url => url.pathname === '/records');
        hrefPatient(page.url(), selected.id, '/records');
        const back = await recordsHeader(page, selected.id);
        assert.equal(await page.locator('html').evaluate(element => element.classList.contains('dark')), theme === 'dark');
        await back.click();
        await page.waitForURL(url => url.pathname === '/editor');
        await loadedPortal(page, selected);
      }

      // No referrer or history dependency: a direct URL still returns to /editor.
      await page.goto(base + '/records');
      const directBack = await recordsHeader();
      await page.getByText('Legacy navigation fixture', { exact: true }).first().waitFor({ state: 'attached' });
      if (width < 768) {
        await page.getByRole('button', { name: 'Open navigation', exact: true }).click();
        const menu = page.getByRole('navigation', { name: 'Mobile navigation', exact: true });
        await menu.waitFor();
        await menu.getByRole('button', { name: 'Medical records', exact: true }).click();
        await menu.waitFor({ state: 'hidden' });
        await recordsHeader();
      }
      await page.screenshot({ path: `outputs/qa/records-navigation/records-${width}-${theme}.png` });
      await directBack.click();
      await page.waitForURL(url => url.pathname === '/editor');
      await loadedPortal();

      await page.goto(base + '/records');
      await recordsHeader();
      await page.getByRole('link', { name: 'Về sảnh MediPass', exact: true }).click();
      await page.waitForURL(url => url.pathname === '/');
      await page.locator('.mp-lobby').waitFor();
      console.log(`PASS ${width}px ${theme}: hospital/patient → records → same patient, direct return, logo home, mobile menu`);
    }
  }

  // Context is data, not a navigation destination. Encoded and repeated values
  // must never alter the API identity or create an external return link.
  const encodedId = 'qa return/Đ &?=+#';
  await page.goto(base + '/records?patient=' + encodeURIComponent(encodedId) + '&return_to=' + encodeURIComponent('https://example.invalid/'));
  await recordsHeader(page, encodedId);
  const repeated = '/records?patient=' + encodeURIComponent(patients[1].id) + '&patient=' + encodeURIComponent('https://example.invalid/');
  await page.goto(base + repeated);
  const repeatedLink = page.getByTestId('records-hospital-link');
  await repeatedLink.waitFor();
  const repeatedHref = new URL(await repeatedLink.getAttribute('href'), origin);
  assert.equal(repeatedHref.origin, origin);
  assert.equal(repeatedHref.pathname, '/editor');
  assert.ok([null, patients[1].id].includes(repeatedHref.searchParams.get('patient')), 'Repeated values are ignored or first-value only');
  assert.ok(repeatedHref.searchParams.getAll('patient').length <= 1, 'Return query has at most one patient');

  // Returning inside a phone preview remains in the frame and preserves patient.
  await page.setViewportSize({ width: 1440, height: 1000 });
  const iframePatient = patients[2];
  const innerPath = '/records?patient=' + encodeURIComponent(iframePatient.id);
  const outerPath = '/mobile?path=' + encodeURIComponent(innerPath);
  await page.goto(base + outerPath);
  const frameElement = page.locator('iframe[title="MediPass trên điện thoại"]');
  await frameElement.waitFor();
  const frame = await (await frameElement.elementHandle()).contentFrame();
  assert.ok(frame);
  const frameBack = await recordsHeader(frame, iframePatient.id);
  await frameBack.click();
  await frame.waitForURL(url => url.pathname === '/editor');
  await loadedPortal(frame, iframePatient);
  assert.equal(new URL(page.url()).pathname, '/mobile', 'Return stays inside same-origin preview');
  await page.getByRole('link', { name: 'Về máy tính', exact: true }).click();
  await page.waitForURL(url => url.pathname === '/editor');
  await loadedPortal(page, iframePatient);

  assert.ok(recordsReads.length > 0);
  assert.deepEqual([...new Set(recordsReads)], ['/api/records'], 'Return context never changes legacy records API identity');
  assert.deepEqual(writes, [], 'No clinical or feedback writes');
  assert.deepEqual(unexpected, [], 'All API requests use known isolated fixtures');
  assert.deepEqual(errors, [], 'No browser runtime errors');
  console.log('PASS records return navigation: 1440/390/360 light/dark, nonfirst patient preservation, real anchors, direct entry, logo, mobile menu, encoded/repeated contexts and same-origin iframe. All API data mocked; no writes.');
} finally {
  await browser.close();
}
