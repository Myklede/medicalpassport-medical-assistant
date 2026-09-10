// Focused, read-only Chrome QA for the global theme control.
import assert from 'node:assert/strict';
import { chromium } from '../outputs/qa/node_modules/playwright/index.mjs';

const base = process.env.MEDIPASS_TEST_URL || 'http://localhost:3001';
assert.ok(['localhost', '127.0.0.1'].includes(new URL(base).hostname));

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await context.newPage();
const errors = [];
page.on('pageerror', error => errors.push(error.message));

try {
  await page.goto(base + '/signin-with-chatgpt?return_to=/');
  await page.goto(base + '/');
  await page.locator('.mp-lobby').waitFor({ timeout: 60000 });
  assert.equal(await page.locator('.mp-lobby-choice').count(), 2);
  assert.equal(await page.locator('.mp-lobby-links a').count(), 3);
  assert.equal(await page.getByRole('link', { name: /Cổng bệnh viện/ }).getAttribute('href'), '/editor');
  assert.equal(await page.getByRole('link', { name: /Góc nhìn bệnh nhân/ }).getAttribute('href'), '/patient');
  await page.screenshot({ path: 'outputs/qa/lobby.png', fullPage: true });

  await page.goto(base + '/editor');
  await page.locator('.mp-patient-row').first().waitFor({ timeout: 60000 });
  await page.locator('.mp-patient-row').nth(1).click();
  await page.locator('.mp-education').first().waitFor();
  assert.match(await page.locator('.mp-education-simple').first().innerText(), /NÓI ĐƠN GIẢN/);
  await page.locator('.mp-lab-verdict').first().waitFor();
  assert.match(await page.locator('.mp-lab-plain-grid').first().innerText(), /Vì sao cần chú ý\?/);
  assert.match(await page.locator('.mp-lab-plain-grid').first().innerText(), /Ăn uống & sinh hoạt/);
  await page.evaluate(() => localStorage.removeItem('medipass-theme'));
  await page.reload();
  await page.locator('.mp-patient-row').first().waitFor();

  const before = await page.locator('.mp-topbar').evaluate(element => getComputedStyle(element).backgroundColor);
  if (await page.locator('html').evaluate(element => element.classList.contains('dark'))) {
    await page.locator('.mp-theme-toggle').click();
  }
  await page.locator('.mp-theme-toggle').click();
  await page.locator('html.dark').waitFor();
  const after = await page.locator('.mp-topbar').evaluate(element => getComputedStyle(element).backgroundColor);
  assert.notEqual(after, before, 'Portal surface must visibly change in dark mode');
  assert.equal(await page.evaluate(() => localStorage.getItem('medipass-theme')), 'dark');

  await page.reload();
  await page.locator('html.dark').waitFor();
  await page.waitForFunction(() => document.querySelector('.mp-theme-toggle')?.getAttribute('aria-pressed') === 'true');
  assert.equal(await page.locator('.mp-theme-toggle').getAttribute('aria-pressed'), 'true');

  await page.goto(base + '/mobile?path=/patient');
  const phone = page.frameLocator('iframe[title="MediPass trên điện thoại"]');
  await phone.locator('.mp-patient-row').first().waitFor({ timeout: 60000 });
  await phone.locator('html.dark').waitFor();
  await phone.locator('.mp-theme-toggle').click();
  await page.locator('html:not(.dark)').waitFor();
  assert.equal(await page.evaluate(() => localStorage.getItem('medipass-theme')), 'light');

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(base + '/patient');
  await page.locator('.mp-patient-row').first().waitFor();
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  await page.locator('.mp-theme-toggle').click();
  await page.locator('html.dark').waitFor();
  assert.deepEqual(errors, []);
  console.log('PASS Chrome light/dark persistence, phone-preview sync and mobile viewport');
} finally {
  await browser.close();
}
