// Read-only UI regression. Fresh local sign-in; no clinical/feedback saves.
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from '../outputs/qa/node_modules/playwright/index.mjs';

const base = process.env.MEDIPASS_TEST_URL || 'http://localhost:3001';
assert.ok(['localhost', '127.0.0.1'].includes(new URL(base).hostname));
const contrastOnly = process.argv.includes('--contrast-only');
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, colorScheme: 'light' });
const page = await context.newPage();
const errors = [];
const apiErrors = [];
page.on('pageerror', error => errors.push(`${page.url()}: ${error.message}`));
page.on('response', response => {
  const url = new URL(response.url());
  if (url.origin === new URL(base).origin && url.pathname.startsWith('/api/') && response.status() >= 500) {
    apiErrors.push(`${response.request().method()} ${url.pathname}${url.search}: ${response.status()}`);
  }
});
const routes = contrastOnly ? ['/editor', '/patient', '/data', '/feedback'] : ['/', '/editor', '/patient', '/records', '/insurance', '/medications', '/wounds', '/wound-analyzer', '/wounds/history', '/therapy', '/data', '/feedback', '/mobile?path=/wounds'];
const themes = contrastOnly ? ['dark'] : ['light', 'dark'];

// Regression targets missed by checking theme tokens alone: inherited brand
// text, clinical context, useful secondary links and outline button surfaces.
async function assertDarkTextContrast(route, print = false) {
  const required = route === '/editor' || route === '/patient'
    ? ['.mp-patient-heading p:not(.mp-eyebrow)', '.mp-baseline:not(.mp-allergy-panel) p', '.mp-visit-meta b', '.mp-education-note']
    : route === '/data' ? ['.mp-data-explorer', '.mp-data-flow span']
    : route === '/feedback' ? ['.mp-feedback-summary strong', '.mp-feedback-summary span']
    : route.startsWith('/visit/') ? ['.mp-document', '.mp-document-toolbar .mp-brand', '.mp-document > .mp-muted'] : [];
  for (const selector of required) assert.ok(await page.locator(selector).count(), `${route}: loaded contrast target ${selector}`);
  const checked = await page.evaluate(print => {
    const selectors = print ? ['.mp-document *'] : [
      '.mp-brand span', '.mp-mobile-links a', '.mp-patient-heading p:not(.mp-eyebrow)',
      '.mp-patient-heading [data-slot=button]', '.mp-baseline:not(.mp-allergy-panel) .mp-panel-label',
      '.mp-baseline:not(.mp-allergy-panel) p', '.mp-muted', '.mp-roster-note p', '.mp-strip-right',
      '.mp-text-action', '.mp-visit-toolbar [data-slot=button]', '.mp-visit-meta b', '.mp-visit-meta>span',
      '.mp-education-note', '.mp-education-sources a', '.mp-lab-reference b', '.mp-source', '.mp-footnote a',
      '.mp-feedback-summary strong', '.mp-feedback-summary span', '.mp-feedback-context a',
      '.mp-data-flow span', '.mp-schema-list code', '.mp-schema-list a', '.mp-document-header>span',
      '.mp-document-patient small', '.mp-document-footer', '.mp-page-heading [data-slot=button]',
    ];
    // Canvas normalizes CSS rgb/oklch/color-mix into sRGB; alpha compositing
    // resolves translucent buttons and subtitle opacity against real parents.
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 1;
    const ctx = canvas.getContext('2d');
    function rgba(value) {
      ctx.clearRect(0, 0, 1, 1); ctx.fillStyle = value; ctx.fillRect(0, 0, 1, 1);
      return Array.from(ctx.getImageData(0, 0, 1, 1).data).map((value, index) => index === 3 ? value / 255 : value);
    }
    function blend(top, bottom) { return top.slice(0, 3).map((value, index) => value * top[3] + bottom[index] * (1 - top[3])).concat(1); }
    function background(element) {
      const chain = [];
      for (let node = element; node; node = node.parentElement) chain.push(rgba(getComputedStyle(node).backgroundColor));
      return chain.reverse().reduce((under, over) => blend(over, under), [255, 255, 255, 1]);
    }
    function luminance(rgb) {
      return rgb.slice(0, 3).map(value => value / 255).map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4)
        .reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0);
    }
    let count = 0;
    const failures = [];
    for (const element of document.querySelectorAll(selectors.join(','))) {
      if (!element.getClientRects().length || !Array.from(element.childNodes).some(node => node.nodeType === 3 && node.textContent.trim())) continue;
      const style = getComputedStyle(element);
      if (style.visibility === 'hidden' || element.closest('button:disabled,[aria-disabled=true]')) continue;
      const bg = background(element), fg = rgba(style.color);
      for (let node = element; node; node = node.parentElement) fg[3] *= Number(getComputedStyle(node).opacity);
      const a = luminance(blend(fg, bg)), b = luminance(bg);
      const ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
      const large = parseFloat(style.fontSize) >= 24 || (parseFloat(style.fontSize) >= 18.66 && Number(style.fontWeight) >= 700);
      count++;
      if (ratio < (large ? 3 : 4.5)) failures.push({ selector: element.tagName.toLowerCase() + '.' + Array.from(element.classList).join('.'), text: element.textContent.trim().slice(0, 45), ratio: Number(ratio.toFixed(2)) });
    }
    return { count, failures };
  }, print);
  assert.ok(checked.count > 0, `${route}: visible text measured`);
  assert.deepEqual(checked.failures, [], `${route}: ${print ? 'print' : 'dark'} text contrast (4.5:1 normal / 3:1 large)`);
}

async function assertDarkModePrint(route, width) {
  await page.emulateMedia({ media: 'print' });
  try {
    const print = await page.evaluate(() => {
      const documentCard = document.querySelector('.mp-document');
      const heading = documentCard.querySelector('h1');
      const canvas = document.createElement('canvas'); canvas.width = canvas.height = 1;
      const ctx = canvas.getContext('2d');
      function color(value) {
        ctx.clearRect(0, 0, 1, 1); ctx.fillStyle = value; ctx.fillRect(0, 0, 1, 1);
        return Array.from(ctx.getImageData(0, 0, 1, 1).data);
      }
      const darkSurfaces = [];
      for (const element of [documentCard, ...documentCard.querySelectorAll('*')]) {
        if (!element.getClientRects().length || element.closest('svg')) continue;
        const background = color(getComputedStyle(element).backgroundColor);
        if (background[3] > 0 && background.slice(0, 3).some(value => value < 235)) {
          darkSurfaces.push({ selector: element.tagName.toLowerCase() + '.' + Array.from(element.classList).join('.'), background });
        }
      }
      return {
        darkThemePreserved: document.documentElement.classList.contains('dark'),
        documentBackground: color(getComputedStyle(documentCard).backgroundColor),
        headingColor: color(getComputedStyle(heading).color),
        darkSurfaces,
      };
    });
    assert.equal(print.darkThemePreserved, true, `${route}: print does not reset the user's dark theme`);
    assert.deepEqual(print.documentBackground, [255, 255, 255, 255], `${route}: white print document`);
    assert.deepEqual(print.headingColor, [15, 23, 42, 255], `${route}: Deep Slate print heading`);
    assert.deepEqual(print.darkSurfaces, [], `${route}: no dark clinical print surfaces`);
    await assertDarkTextContrast(route, true);
    const name = route.split('?')[0].replaceAll('/', '-');
    await page.screenshot({ path: `outputs/qa/brand/${name}-print-from-dark-${width}.png` });
  } finally {
    await page.emulateMedia({ media: 'screen' });
  }
}
await mkdir('outputs/qa/brand', { recursive: true });
try {
  await page.goto(base + '/signin-with-chatgpt?return_to=/');
  await page.goto(base + '/editor');
  await page.locator('.mp-patient-row').first().waitFor({ timeout: 60000 });
  await page.locator('a[href^="/visit/"]').first().waitFor();
  routes.push(await page.locator('a[href^="/visit/"]').first().getAttribute('href'));
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
    for (const theme of themes) {
      await page.evaluate(value => localStorage.setItem('medipass-theme', value), theme);
      for (const route of routes) {
        const response = await page.goto(base + route);
        assert.equal(response.status(), 200, route);
        await page.locator('[data-testid="medipass-brand"]').first().waitFor({ state: 'attached', timeout: 60000 });
        await page.waitForFunction(() => document.querySelector('.mp-theme-toggle')?.getAttribute('aria-pressed') === String(document.documentElement.classList.contains('dark')));
        await page.waitForLoadState('networkidle');
        if (route === '/editor' || route === '/patient') {
          await page.locator('.mp-patient-row').first().waitFor();
          await page.locator('.mp-visit-card').first().waitFor();
        }
        if (route.startsWith('/visit/')) await page.locator('.mp-document').waitFor();
        if (route === '/data') await page.locator('.mp-data-explorer').waitFor();
        assert.deepEqual(apiErrors, [], `${route}: same-origin API requests must not return server errors`);
        const brand = page.locator('[data-testid="medipass-brand"]:visible').first();
        await brand.waitFor();
        const palette = await page.evaluate(() => ({
          primary: getComputedStyle(document.documentElement).getPropertyValue('--primary').trim(),
          card: getComputedStyle(document.documentElement).getPropertyValue('--card').trim(),
          dark: document.documentElement.classList.contains('dark'),
          overflow: document.documentElement.scrollWidth > innerWidth + 1,
        }));
        assert.equal(palette.primary, '#2563eb', `${route}: shared primary`);
        assert.equal(palette.card, theme === 'dark' ? '#0f172a' : '#ffffff', `${route}: shared surface`);
        assert.equal(palette.dark, theme === 'dark', `${route}: theme`);
        assert.equal(palette.overflow, false, `${route} ${theme} ${width}: overflow`);
        if (theme === 'dark') await assertDarkTextContrast(route);
        assert.equal(await brand.locator('svg rect').getAttribute('fill'), '#2563EB', `${route}: badge`);
        const dimensions = await brand.locator('svg').boundingBox();
        assert.ok(dimensions.width >= 32 && dimensions.width <= 44 && Math.abs(dimensions.width - dimensions.height) < 1, `${route}: undistorted badge`);
        const pill = await page.locator('.mp-theme-toggle').boundingBox();
        // The outer /mobile preview intentionally hides its duplicate review tools.
        const toolbar = await page.locator('.mp-review-toolbar').count() ? await page.locator('.mp-review-toolbar').boundingBox() : null;
        if (pill && toolbar) assert.ok(pill.x + pill.width <= toolbar.x || toolbar.x + toolbar.width <= pill.x || pill.y + pill.height <= toolbar.y || toolbar.y + toolbar.height <= pill.y, `${route}: controls overlap`);
        const name = route.split('?')[0].replaceAll('/', '-') || '-home';
        await page.screenshot({ path: `outputs/qa/brand/${name}-${theme}-${width}.png` });
        if (theme === 'dark' && route.startsWith('/visit/')) await assertDarkModePrint(route, width);
      }
    }
  }
  assert.deepEqual(errors, [], 'No unhandled browser errors');
  assert.deepEqual(apiErrors, [], 'No same-origin API server errors');
  console.log(`PASS ${routes.length} routes × ${themes.length} themes × 2 widths: shared brand/tokens, badge geometry, dark text contrast, readable light print from dark mode, no overflow or control overlap; no browser/API server errors.`);
} finally {
  await browser.close();
}
