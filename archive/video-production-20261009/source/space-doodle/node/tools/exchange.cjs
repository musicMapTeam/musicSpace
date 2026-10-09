// Two-origin exchange on the Node room service: A (phone, 127.0.0.1) hosts, B (desktop, localhost) joins via the invite link.
// Both upload a pack photo; A requests an exchange; B accepts; both must show 「交换已接受」 with both photos.
// usage: node exchange.cjs <port> [label]
const { launch, open, sleep, OUT, save } = require('./lib.cjs');
const port = process.argv[2] || '8890';
const label = process.argv[3] || 'x';
const A_BASE = `http://127.0.0.1:${port}`;
const B_HOST = process.env.B_HOST || 'localhost';
const PHOTO = { stage: '/tmp/space-video-prep/photos/pack/demo-stage-2147.jpg', crowd: '/tmp/space-video-prep/photos/pack/demo-crowd-2148.jpg' };
const steps = [];
let n = 0;
async function shot(s, name) {
  const file = `${OUT}/${label}-${String(++n).padStart(2, '0')}-${s.who}-${name}.png`;
  await s.page.screenshot({ path: file });
  steps.push(file);
  console.log('shot', file);
}
const panelText = p => p.evaluate(() => (document.querySelector('#panel:not([hidden])')?.innerText || '').replace(/\n+/g, ' | ').slice(0, 600));
const buttons = p => p.evaluate(() => [...document.querySelectorAll('button,a[href]')].filter(b => { const r = b.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(b).visibility !== 'hidden'; }).map(b => (b.innerText || b.getAttribute('aria-label') || '').trim().replace(/\s+/g, ' ').slice(0, 30)).filter(Boolean));
const connected = p => p.waitForFunction(() => /已连接|同场/.test(document.querySelector('#render-status')?.innerText || ''), null, { timeout: 30000 });

async function step(s, name, fn) {
  try { await fn(); await sleep(400); await shot(s, name); }
  catch (e) {
    console.log(`STEP FAILED ${s.who} ${name}: ${e.message.split('\n')[0]}`);
    console.log('  panel:', await panelText(s.page).catch(() => ''));
    console.log('  buttons:', JSON.stringify(await buttons(s.page).catch(() => [])));
    await shot(s, name + '-FAILED');
    throw e;
  }
}

async function upload(s, file) {
  const p = s.page;
  await step(s, 'upload-open', async () => {
    const first = p.locator('#room-first-photo, #panel .primary:has-text("放上我的一张")').first();
    if (await first.isVisible().catch(() => false)) await first.click();
    else await p.getByRole('button', { name: '放上我的一张' }).first().click();
    await sleep(700);
  });
  await step(s, 'upload-picked', async () => {
    await p.locator('#panel input[type=file]').setInputFiles(file);
    // wait for the on-device suggestion to settle (or time out)
    await p.waitForFunction(() => !/正在|识别中|分析中/.test(document.querySelector('#panel')?.innerText || ''), null, { timeout: 25000 }).catch(() => console.log('  (suggestion still busy)'));
    await sleep(1500);
  });
  console.log(`  ${s.who} upload panel:`, await panelText(p));
  const sel = p.locator('#panel select[name=visibility]');
  if (await sel.count()) { const opts = await sel.evaluate(x => [...x.options].map(o => o.value)); await sel.selectOption(opts.includes('members') ? 'members' : opts[opts.length - 1]); }
  await step(s, 'upload-saved', async () => { await p.getByRole('button', { name: '保存这张照片' }).click(); await sleep(2500); });
  const x = p.locator('#panel-close'); if (await x.isVisible().catch(() => false)) { await x.click(); await sleep(500); }
}

async function openWall(s) {
  const p = s.page;
  const btn = p.locator('button:has-text("看照片")');
  if (!(await btn.first().isVisible().catch(() => false))) { await p.locator('nav button[data-view=photos]').first().click(); await sleep(2500); }
  await btn.first().click(); await sleep(1200);
}

(async () => {
  const browser = await launch();
  const A = { who: 'A', ...(await open(browser, 'phone')) };
  const B = { who: 'B', ...(await open(browser, 'desktop')) };
  const result = {};
  try {
    // ---- A hosts
    await step(A, 'landing', async () => { await A.page.goto(`${A_BASE}/event-room/`, { waitUntil: 'load' }); await connected(A.page); await sleep(2500); });
    await step(A, 'enter-choice', async () => { await A.page.getByRole('button', { name: '带上小人，进入现场' }).click(); await sleep(700); });
    await step(A, 'host-name', async () => { await A.page.getByRole('button', { name: /我是主办方/ }).click(); await sleep(700); await A.page.locator('#panel input[name=name]').fill('阿遥'); });
    await step(A, 'host-form', async () => {
      await A.page.getByRole('button', { name: '保存昵称，继续' }).click(); await sleep(900);
      await A.page.locator('#panel input[name=title]').fill('返场夜');
      await A.page.locator('#panel input[name=venue]').fill('月台 Livehouse');
      const song = A.page.locator('#panel select[name=songId]'); if (await song.count()) await song.selectOption({ index: 1 }).catch(() => {});
      await A.page.locator('#panel input[name=participation][value=open]').check();
      const c = A.page.locator('#panel input[name=consent]'); if (!(await c.isChecked())) await c.check();
    });
    await step(A, 'host-room', async () => { await A.page.getByRole('button', { name: '开房并进入现场' }).click(); await sleep(3500); });
    result.roomSearch = new URL(A.page.url()).search;
    // invite block (room panel)
    await step(A, 'invite', async () => {
      const room = A.page.locator('[data-open=room], button:has-text("这一场")').first();
      if (await room.isVisible().catch(() => false)) await room.click();
      else { await A.page.locator('#room-info, .menu, button[aria-label*="房间"]').first().click(); }
      await sleep(1200);
      await A.page.locator('.invite-address').first().waitFor({ timeout: 8000 });
    });
    result.invite = (await A.page.locator('.invite-address').first().innerText()).trim();
    console.log('invite', result.invite, 'search', result.roomSearch);
    await A.page.evaluate(() => { const el = document.querySelector('.invite-code'); el?.scrollIntoView({ block: 'center' }); });
    await sleep(500); await shot(A, 'invite-scrolled');
    const close = A.page.locator('#panel-close'); if (await close.isVisible().catch(() => false)) { await close.click(); await sleep(500); }

    // ---- B joins through the invite link on another origin
    const inviteForB = result.invite.replace('127.0.0.1', B_HOST);
    await step(B, 'invite-landing', async () => { await B.page.goto(inviteForB, { waitUntil: 'load' }); await connected(B.page); await sleep(2500); });
    await step(B, 'guest-name', async () => { await B.page.getByRole('button', { name: '用默认小人，继续入场' }).click(); await sleep(700); await B.page.locator('#panel input[name=name]').fill('Lin'); });
    await step(B, 'guest-consent', async () => {
      await B.page.getByRole('button', { name: '保存昵称，继续' }).click(); await sleep(900);
      await B.page.locator('#panel input[name=participation][value=open]').check();
      const c = B.page.locator('#panel input[name=consent]'); if (!(await c.isChecked())) await c.check();
    });
    await step(B, 'guest-room', async () => { await B.page.getByRole('button', { name: '我愿意，进入这一场' }).click(); await sleep(3500); });

    // ---- uploads
    await upload(A, PHOTO.stage);
    await upload(B, PHOTO.crowd);
    await sleep(6000); // a poll on each side

    // ---- A requests the exchange from B's photo
    await step(A, 'wall', async () => { await openWall(A); const r = A.page.getByRole('button', { name: /刷新照片/ }); if (await r.isVisible().catch(() => false)) { await r.click(); await sleep(1200); } });
    await step(A, 'wall-photo-B', async () => { await A.page.locator('#panel button.photo-item', { hasText: 'Lin' }).first().click(); await sleep(1500); });
    await step(A, 'exchange-compose', async () => { await A.page.getByRole('button', { name: /用我的照片，交换这个视角/ }).click(); await sleep(1800); });
    await step(A, 'exchange-ready', async () => {
      const sel = A.page.locator('section.photo-exchanges select'); if (await sel.count()) await sel.selectOption({ index: 1 }).catch(() => {});
      await sleep(600); await A.page.locator('section.photo-exchanges input[type=checkbox]').first().check();
    });
    await step(A, 'exchange-sent', async () => { await A.page.locator('button.exchange-primary').click(); await sleep(2500); });

    // ---- B accepts
    await sleep(6000);
    await step(B, 'wall', async () => { await openWall(B).catch(() => {}); });
    await step(B, 'exchanges', async () => { await B.page.locator('#panel button:has-text("照片交换")').first().click(); await sleep(1600); });
    await step(B, 'incoming', async () => { await B.page.locator('section.photo-exchanges button', { hasText: '阿遥' }).first().click(); await sleep(1600); });
    await step(B, 'accept-ready', async () => { await B.page.locator('section.photo-exchanges input[type=checkbox]').first().check(); });
    await step(B, 'accepted', async () => { await B.page.locator('button.exchange-primary').click(); await sleep(3000); });
    result.B = await B.page.evaluate(() => { const s = document.querySelector('section.photo-exchanges'); return { text: (s?.innerText || '').replace(/\n+/g, ' | ').slice(0, 500), imgs: [...(s?.querySelectorAll('img') || [])].map(i => ({ ok: i.complete && i.naturalWidth > 0, w: i.naturalWidth, alt: i.alt })) }; });

    // ---- A sees it accepted
    await sleep(7000);
    await step(A, 'after-accept', async () => {
      const ex = A.page.locator('section.photo-exchanges:not([hidden])');
      if (!(await ex.isVisible().catch(() => false))) { await openWall(A).catch(() => {}); await A.page.locator('#panel button:has-text("照片交换")').first().click(); await sleep(1500); }
      const item = A.page.locator('section.photo-exchanges button', { hasText: 'Lin' }).first(); if (await item.isVisible().catch(() => false)) { await item.click(); await sleep(1500); }
    });
    result.A = await A.page.evaluate(() => { const s = document.querySelector('section.photo-exchanges'); return { text: (s?.innerText || '').replace(/\n+/g, ' | ').slice(0, 500), imgs: [...(s?.querySelectorAll('img') || [])].map(i => ({ ok: i.complete && i.naturalWidth > 0, w: i.naturalWidth, alt: i.alt })) }; });
    result.accepted = { A: /交换已接受/.test(result.A.text), B: /交换已接受/.test(result.B.text) };
  } catch (e) {
    result.error = e.message.split('\n')[0];
  } finally {
    result.logs = { A: A.log, B: B.log };
    result.qa = { A: await A.page.evaluate(() => window.__SPACE_EVENT_QA__?.()).catch(() => null), B: await B.page.evaluate(() => window.__SPACE_EVENT_QA__?.()).catch(() => null) };
    save(`${label}-exchange.json`, result);
    console.log(JSON.stringify({ ...result, qa: { A: { renderStyle: result.qa.A?.camera?.scene?.renderStyle, photos: result.qa.A?.photos?.length }, B: { renderStyle: result.qa.B?.camera?.scene?.renderStyle, photos: result.qa.B?.photos?.length } } }, null, 1).slice(0, 5000));
    await browser.close();
  }
})();
