// Browser QA against localhost only. Playwright is supplied in outputs/qa.
import assert from 'node:assert/strict';
import { chromium } from '../outputs/qa/node_modules/playwright/index.mjs';
import { supabaseBrowserStore } from './supabase-browser-store.mjs';
const base = process.env.MEDIPASS_TEST_URL || 'http://localhost:3000';
assert.ok(['localhost', '127.0.0.1'].includes(new URL(base).hostname));
const production = new URL(base).port !== '3000';
const remote = supabaseBrowserStore();
assert.ok(!remote || production, 'Supabase QA uses the isolated localhost production identity');
let legacyPatientId;
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, permissions: ['camera'], ...(production ? { extraHTTPHeaders: { 'oai-authenticated-user-id': 'browser-qa', 'oai-authenticated-user-email': 'browser-qa@sites.test' } } : {}) });
const page = await context.newPage();
const errors = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if(m.type() === 'error' && !m.text().includes('404')) console.log('CONSOLE',m.text().slice(0,350)); });
const comment = `QA ghim bình luận ${Date.now()}`;
try {
  if (!production) await page.goto(base + '/signin-with-chatgpt?return_to=/editor');
  await page.goto(base + '/editor');
  await page.locator('.mp-patient-row').first().waitFor({ timeout: 60000 });
  assert.equal(await page.locator('.mp-patient-row').count(), 5);
  if (remote) assert.equal((await (await page.request.get(base+'/api/portal')).json()).storage.provider,'supabase','QA must use Supabase, not the D1 fallback');
  for(let i=0;i<5;i++) {
    await page.locator('.mp-patient-row').nth(i).click();
    await page.locator('.mp-visit-card').first().waitFor();
    const name = await page.locator('.mp-patient-heading h2').innerText();
    await page.getByRole('link',{name:'Xem phía bệnh nhân',exact:true}).click();
    await page.locator('.mp-patient-heading h2').waitFor();
    assert.equal(await page.locator('.mp-patient-heading h2').innerText(),name);
    assert.equal(await page.getByRole('button',{name:'Sửa thông tin chung',exact:true}).count(),0);
    await page.getByRole('link',{name:'Vào cổng bệnh viện',exact:true}).click();
    await page.locator('.mp-patient-row').first().waitFor();
  }
  console.log('PASS 5 patients preserve selection in both views');
  await page.getByRole('button',{name:'Sửa thông tin chung',exact:true}).click();
  await page.getByRole('dialog').waitFor();
  const originalNote = await page.getByLabel('Ghi chú chung',{exact:true}).inputValue();
  await page.getByLabel('Ghi chú chung',{exact:true}).fill(comment);
  await page.getByRole('button',{name:'Lưu hồ sơ chung',exact:true}).click();
  await page.getByRole('dialog').waitFor({state:'hidden'});
  const selectedId = new URL(page.url()).searchParams.get('patient');
  if(remote) assert.equal((await remote.read()).patients.find(p=>p.id===selectedId).general_note,comment);
  // A second device (separate browser context) must refresh an already-open view.
  const observerContext = await browser.newContext({viewport:{width:390,height:844}, ...(production ? {extraHTTPHeaders:{'oai-authenticated-user-id':'browser-qa','oai-authenticated-user-email':'browser-qa@sites.test'}} : {})});
  if(!production) await observerContext.addCookies(await context.cookies());
  const observer = await observerContext.newPage();
  observer.on('pageerror',e=>errors.push(e.message));
  await observer.goto(base+'/patient?patient='+selectedId);
  await observer.getByRole('tab',{name:'Thông tin chung',exact:true}).click();
  await observer.getByText(comment,{exact:true}).waitFor();
  await page.getByRole('button',{name:'Sửa thông tin chung',exact:true}).click();
  await page.getByLabel('Ghi chú chung',{exact:true}).fill(originalNote);
  await page.getByRole('button',{name:'Lưu hồ sơ chung',exact:true}).click();
  await page.getByRole('dialog').waitFor({state:'hidden'});
  await observer.getByText(originalNote,{exact:true}).waitFor({timeout:20000});
  console.log('PASS patient save/readback and automatic update on a separate mobile view');
  await page.getByRole('button',{name:'Thêm lần khám',exact:true}).click();
  const visitReason = 'Lần khám mô phỏng QA ' + Date.now();
  await page.getByLabel('Lý do khám *',{exact:true}).fill(visitReason);
  await page.getByLabel('Triệu chứng người bệnh khai',{exact:true}).fill('Dữ liệu giả để kiểm thử ghi và đọc.');
  await page.getByRole('tab',{name:'Xét nghiệm (0)',exact:true}).click();
  await page.getByRole('button',{name:'Thêm xét nghiệm',exact:true}).click();
  await page.getByLabel('Tên chuyên môn *',{exact:true}).fill('Glucose');
  await page.getByLabel('Kết quả *',{exact:true}).fill('95');
  await page.getByLabel('Đơn vị',{exact:true}).fill('mg/dL');
  await page.getByLabel('Giới hạn dưới',{exact:true}).fill('70');
  await page.getByLabel('Giới hạn trên',{exact:true}).fill('99');
  await page.getByLabel('Tên dễ hiểu',{exact:true}).fill('Đường trong máu – dữ liệu mô phỏng');
  await page.getByRole('tab',{name:'Thuốc (0)',exact:true}).click();
  await page.getByRole('button',{name:'Thêm thuốc',exact:true}).click();
  await page.getByLabel('Tên thuốc *',{exact:true}).fill('Thuốc giả lập QA');
  await page.getByRole('tab',{name:'Dịch vụ (0)',exact:true}).click();
  await page.getByRole('button',{name:'Thêm dịch vụ',exact:true}).click();
  await page.getByLabel('Tên chuyên môn *',{exact:true}).fill('Dịch vụ giả lập QA');
  await page.getByRole('tab',{name:'Bác sĩ',exact:true}).click();
  const savedVisitResponse = page.waitForResponse(r=>r.url().endsWith('/api/portal/encounters') && r.request().method()==='POST');
  await page.getByRole('button',{name:'Lưu lần khám',exact:true}).click();
  const visitResponse = await savedVisitResponse; assert.equal(visitResponse.status(),201);
  const savedVisit = (await visitResponse.json()).encounter;
  await page.getByRole('dialog').waitFor({state:'hidden'});
  await observer.getByRole('tab',{name:'Lịch sử khám',exact:true}).click();
  await observer.getByText(visitReason,{exact:true}).waitFor({timeout:20000});
  await observerContext.close();
  if(remote) {
    const actual=(await remote.read()).encounters.find(e=>e.id===savedVisit.id);
    assert.equal(actual.labs[0].value,'95'); assert.equal(actual.labs[0].unit,'mg/dL');
    assert.equal(actual.medications[0].name,'Thuốc giả lập QA'); assert.equal(actual.procedures[0].name,'Dịch vụ giả lập QA');
    assert.ok(actual.clinician.name);
  }
  console.log('PASS full encounter save, labs/medicines/procedures/doctor readback and live patient view');
  await page.getByRole('button',{name:'Chú thích giao diện',exact:true}).click();
  const card = page.locator('.mp-visit-card').first();
  const selector = await card.getAttribute('data-annotate');
  await card.locator('.mp-visit-title').click();
  await page.getByRole('dialog').waitFor();
  await page.getByLabel('Bạn muốn chỉnh sửa thế nào?').fill(comment);
  await page.getByRole('button',{name:'Lưu bình luận',exact:true}).click();
  await page.getByRole('dialog').waitFor({state:'hidden'});
  await page.locator(`.mp-annotation-pin[title="${comment}"]`).waitFor();
  // Reproduce two requests anchored at exactly the same point.
  await page.evaluate(async description => {
    const list = await (await fetch('/api/feedback')).json();
    const first = list.requests.find(r => r.description === description);
    const response = await fetch('/api/feedback', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...first, id: crypto.randomUUID(), version: 0, description: description + ' (cùng vị trí)' }) });
    if (!response.ok) throw new Error('Could not create overlapping pin fixture');
  }, comment);
  await page.reload();
  await page.locator(`[data-annotate="${selector}"]`).scrollIntoViewIfNeeded();
  await page.locator(`.mp-annotation-pin[title="${comment}"]`).waitFor({timeout:30000});
  await page.locator(`.mp-annotation-pin[title="${comment}"]`).click();
  assert.equal(await page.getByLabel('Bạn muốn chỉnh sửa thế nào?').inputValue(),comment);
  await page.getByRole('button',{name:'Đóng',exact:true}).click();
  await page.locator(`.mp-annotation-pin[title="${comment} (cùng vị trí)"]`).click();
  assert.equal(await page.getByLabel('Bạn muốn chỉnh sửa thế nào?').inputValue(),comment + ' (cùng vị trí)');
  await page.getByRole('button',{name:'Đóng',exact:true}).click();
  await page.getByRole('button',{name:'Tắt chú thích',exact:true}).click();
  const saved = await page.evaluate(async () => (await (await fetch('/api/feedback')).json()).requests);
  const item = saved.find(r=>r.description===comment);
  assert.ok(item.annotation.selector.includes(selector));
  assert.ok(item.encounter_id);
  if(remote) assert.deepEqual((await remote.read()).feedback.find(r=>r.id===item.id).annotation,item.annotation);
  console.log('PASS mouse selection, persistent overlapping pins, both comments clickable and normal click recovery');
  await page.screenshot({path:'outputs/qa/desktop.png',fullPage:true});
  await page.getByRole('button',{name:'Giao diện điện thoại',exact:true}).click();
  const phone = page.frameLocator('iframe[title="MediPass trên điện thoại"]');
  await phone.locator('.mp-patient-row').first().waitFor({timeout:60000});
  assert.equal(await phone.locator('.mp-patient-row').count(),5);
  await phone.getByRole('link',{name:'Xem phía bệnh nhân',exact:true}).click();
  await phone.getByRole('heading',{name:'Sổ sức khỏe',exact:true}).waitFor();
  await phone.locator('.mp-visit-card').first().waitFor();
  await page.screenshot({path:'outputs/qa/phone.png'});
  await page.getByRole('link',{name:'Về máy tính',exact:true}).click();
  assert.ok(page.url().includes('/patient?patient='));
  console.log('PASS phone frame and return to selected patient');
  for (const [link,heading] of [['Yêu cầu chỉnh sửa','Yêu cầu chỉnh sửa'],['Dữ liệu & Supabase','Dữ liệu & Supabase'],['Hồ sơ trước đây',null],['Wound Lab',null],['Motion Lab',null]]) {
    await page.goto(base+'/editor');
    await page.getByRole('link',{name:link,exact:true}).first().click();
    if(heading) await page.getByRole('heading',{name:heading,exact:true}).waitFor();
    else await page.locator('h1').first().waitFor();
    assert.ok(!page.url().endsWith('/editor'),link);
    if(link === 'Hồ sơ trước đây') {
      const records=await (await page.request.get(base+'/api/records')).json();
      legacyPatientId=records.patient.id;
      assert.ok(records.records.length>0);
      if(remote) assert.ok(records.persistence.includes('Supabase'));
    }
    if(link === 'Wound Lab') {
      await page.getByLabel('Observation notes').fill('QA input works');
      await page.getByRole('slider').fill('3');
      await page.getByLabel('Fever or feeling seriously unwell').check();
      const resp=await page.request.get(base+'/api/wounds'); assert.equal(resp.status(),200);
      const png = await page.evaluate(() => { const c=document.createElement('canvas'); c.width=100; c.height=100; const ctx=c.getContext('2d'); ctx.fillStyle='#dddddd'; ctx.fillRect(0,0,100,100); return c.toDataURL('image/png').split(',')[1]; });
      await page.locator('input[type="file"]').setInputFiles({name:'synthetic-qa.png',mimeType:'image/png',buffer:Buffer.from(png,'base64')});
      await page.getByLabel('Case name *',{exact:true}).fill(comment);
      await page.getByLabel('Body location *',{exact:true}).fill('Synthetic test fixture');
      await page.getByLabel('I have permission to use this photo, and it contains no face, name, tattoo, label, or other identifying feature.',{exact:true}).check();
      await page.getByLabel('I understand this is a research prototype, not a diagnosis or emergency service.',{exact:true}).check();
      const savedResponse=page.waitForResponse(r=>r.url().endsWith('/api/wounds')&&r.request().method()==='POST');
      await page.getByRole('button',{name:'Save and run safety review',exact:true}).click();
      assert.equal((await savedResponse).status(),201);
      await page.getByRole('heading',{name:comment,exact:true}).waitFor();
      await page.reload();
      await page.getByRole('heading',{name:comment,exact:true}).waitFor();
      const stored=await (await page.request.get(base+'/api/wounds')).json();
      const assessment=stored.cases.find(c=>c.label===comment).assessments[0];
      assert.equal((await page.request.get(base+assessment.image_url)).status(),200);
      console.log('PASS wound image upload, save, history reload and protected image readback');
    }
    if(link === 'Motion Lab') {
      await page.getByLabel('Exercise protocol').selectOption('knee-extension');
      await page.getByRole('button',{name:'Preview camera',exact:true}).click();
      await page.getByRole('button',{name:'Stop',exact:true}).waitFor();
      await page.getByRole('button',{name:'Stop',exact:true}).click();
    }
  }
  console.log('PASS all navigation, wound inputs, camera start/stop');
  await page.setViewportSize({width:390,height:844});
  await page.goto(base+'/patient');
  await page.locator('.mp-patient-row').first().waitFor();
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth+1),'mobile must not overflow');
  for(const name of ['Wound Lab','Motion Lab','Hồ sơ trước đây']) assert.ok(await page.getByRole('link',{name,exact:true}).last().isVisible());
  await page.getByRole('tab',{name:'Thông tin chung',exact:true}).click();
  await page.getByRole('button',{name:'Chú thích giao diện',exact:true}).click();
  await page.locator('[data-annotate="general-note"]').click();
  await page.getByLabel('Bạn muốn chỉnh sửa thế nào?').fill(comment + ' (mobile)');
  await page.getByRole('button',{name:'Lưu bình luận',exact:true}).click();
  await page.getByRole('dialog').waitFor({state:'hidden'});
  await page.reload();
  await page.getByRole('button',{name:'Tắt chú thích',exact:true}).click();
  await page.getByRole('tab',{name:'Thông tin chung',exact:true}).click();
  await page.getByRole('button',{name:'Chú thích giao diện',exact:true}).click();
  await page.locator('[data-annotate="general-note"]').scrollIntoViewIfNeeded();
  await page.locator(`.mp-annotation-pin[title="${comment} (mobile)"]`).click();
  assert.equal(await page.getByLabel('Bạn muốn chỉnh sửa thế nào?').inputValue(),comment+' (mobile)');
  await page.getByRole('button',{name:'Đóng',exact:true}).click();
  if(remote) assert.equal((await remote.read()).feedback.find(r=>r.description===comment+' (mobile)').annotation.viewport_width,390);
  console.log('PASS real mobile viewport, no horizontal overflow, mobile navigation');
  assert.deepEqual(errors,[]);
  console.log('PASS browser QA; zero uncaught JavaScript errors');
} catch(error) { await page.screenshot({path:'outputs/qa/failure.png'}).catch(() => {}); console.log('FAILURE_URL',page.url()); throw error; } finally {
  // Clean only this run's fixtures, including after a failure.
  try {
    const list = await (await page.request.get(base + '/api/feedback')).json();
    for (const r of list.requests.filter(r => [comment,comment+' (cùng vị trí)',comment+' (mobile)'].includes(r.description))) {
      const response = await page.request.post(base + '/api/feedback', { headers: { Origin: base }, data: { ...r, status: 'done', resolution: 'Bình luận kiểm thử tự động.' } });
      assert.ok(response.ok(), 'QA comment cleanup');
    }
  } finally {
    await browser.close();
    if(remote) { await remote.cleanup(legacyPatientId); console.log('PASS isolated Supabase QA fixtures removed; owner records untouched'); }
  }
}
