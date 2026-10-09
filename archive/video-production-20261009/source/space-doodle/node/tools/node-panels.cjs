// Node-only panels after hosting a room: room (full scroll), moderation, rooms, leave, close, identity-backup, my-feedback.
const { launch, open, sleep, OUT, save } = require('./lib.cjs');
const vp = process.argv[2] || 'phone';
const port = process.argv[3] || '8890';
const label = process.argv[4] || 'np';
async function host(page) {
  await page.goto(`http://127.0.0.1:${port}/event-room/`, { waitUntil: 'load' });
  await page.waitForFunction(() => /已连接/.test(document.querySelector('#render-status')?.innerText || ''), null, { timeout: 30000 }); await sleep(1500);
  await page.getByRole('button', { name: '带上小人，进入现场' }).click(); await sleep(800);
  await page.getByRole('button', { name: /我是主办方/ }).click(); await sleep(700);
  await page.locator('#panel input[name=name]').fill('阿遥'); await page.getByRole('button', { name: '保存昵称，继续' }).click(); await sleep(900);
  await page.locator('#panel input[name=title]').fill('返场夜'); await page.locator('#panel input[name=venue]').fill('月台 Livehouse');
  await page.locator('#panel input[name=participation][value=open]').check(); const c = page.locator('#panel input[name=consent]'); if (!(await c.isChecked())) await c.check();
  await page.getByRole('button', { name: '开房并进入现场' }).click(); await sleep(3000);
}
// scroll the panel body through its height and shoot each page
async function shootPanel(page, name) {
  const files = [];
  const scroller = await page.evaluateHandle(() => { const p = document.querySelector('#panel:not([hidden])'); if (!p) return null; let best = p; for (const el of p.querySelectorAll('*')) if (el.scrollHeight > el.clientHeight + 4 && /(auto|scroll)/.test(getComputedStyle(el).overflowY)) { best = el; break; } return best; });
  const info = await page.evaluate(s => s ? { sh: s.scrollHeight, ch: s.clientHeight } : null, scroller);
  if (!info) { console.log(name, 'no panel'); return files; }
  const pages = Math.min(4, Math.ceil(info.sh / Math.max(1, info.ch - 80)));
  for (let i = 0; i < pages; i++) {
    await page.evaluate(([s, i]) => { s.scrollTop = i * (s.clientHeight - 80); }, [scroller, i]); await sleep(350);
    const f = `${OUT}/${label}-${vp}-${name}-${i}.png`; await page.screenshot({ path: f }); files.push(f);
  }
  return files;
}
(async () => {
  const browser = await launch(); const { page, log } = await open(browser, vp);
  await host(page);
  const out = {};
  const opens = [['room', '[data-open=room]'], ['moderation', null, '管理这一场'], ['rooms', null, '我的现场'], ['leave', '[data-open=leave]'], ['close', '[data-open=close]']];
  for (const [name, sel, text] of opens) {
    try {
      // always start from the room panel
      await page.keyboard.press('Escape'); await sleep(400);
      await page.locator('[data-open=room]').first().click(); await sleep(1200);
      if (name !== 'room') {
        const loc = sel ? page.locator(`#panel ${sel}`).first() : page.locator('#panel button', { hasText: text }).first();
        await loc.scrollIntoViewIfNeeded(); await loc.click(); await sleep(1500);
      }
      out[name] = await shootPanel(page, name);
      out[name + ':text'] = await page.evaluate(() => (document.querySelector('#panel:not([hidden])')?.innerText || '').replace(/\n+/g, ' | ').slice(0, 300));
    } catch (e) { out[name] = 'ERR ' + e.message.split('\n')[0]; }
  }
  out.console = log.console; out.pageerror = log.pageerror;
  save(`${label}-${vp}-panels.json`, out); console.log(JSON.stringify(out, null, 1).slice(0, 4000));
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
