// Independent probe: room framing right after entering, per viewport. Usage: node probe.cjs WxH[,WxH...] [tag]
const { chromium } = require('/tmp/space-video-prep/tools/node_modules/playwright-core');
const fs = require('fs');
const OUT = '/tmp/space-doodle/verify-20';
const URL = process.env.SPACE_URL || 'http://127.0.0.1:5190/';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const vps = (process.argv[2] || '768x1024').split(',').map(s => s.split('x').map(Number));
const tag = process.argv[3] || 'dev';
(async () => {
  const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: ['--use-gl=angle', '--enable-webgl', '--ignore-gpu-blocklist', '--hide-scrollbars'] });
  console.log('browser pid', browser.process && browser.process() ? browser.process().pid : '?');
  const results = [];
  for (const [w, h] of vps) {
    const name = `${tag}-${w}x${h}`;
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: w <= 900 ? 2 : 1, isMobile: w < 1100, hasTouch: w < 1100 });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message.slice(0, 160)));
    const t0 = Date.now();
    await page.goto(URL, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__SPACE_BOOT__ === 'ready', null, { timeout: 90000 });
    await page.waitForFunction(() => document.querySelector('#loading')?.hidden, null, { timeout: 60000 }).catch(() => {});
    await page.evaluate(() => document.fonts.ready);
    await sleep(2500);
    const snap = async (label) => page.evaluate((label) => {
      const qa = window.__SPACE_EVENT_QA__?.();
      const c = document.querySelector('#world canvas').getBoundingClientRect();
      return { label, stage: document.querySelector('.frame')?.dataset.stage, members: qa?.members?.map(m => m.name), camera: qa?.camera?.camera, view: qa?.camera?.view, moving: qa?.camera?.moving,
        canvas: [Math.round(c.left), Math.round(c.top), Math.round(c.width), Math.round(c.height)], aspect: +(c.width / c.height).toFixed(3), innerWidth: innerWidth,
        tags: [...document.querySelectorAll('#hotspots .hotspot')].map(n => ({ label: n.textContent.trim(), hidden: n.hidden, x: n.hidden ? null : Math.round(n.getBoundingClientRect().left + n.getBoundingClientRect().width / 2) })) };
    }, label);
    const lobby = await snap('lobby');
    await page.screenshot({ path: `${OUT}/shots/${name}-lobby.png` });
    await page.locator('#join').click();
    await page.waitForSelector('form[data-form="demo-entry"]', { timeout: 30000 });
    await page.locator('form[data-form="demo-entry"] input[name=consent]').check();
    await page.waitForFunction(() => !document.querySelector('form[data-form="demo-entry"] button[type=submit]')?.disabled, null, { timeout: 60000 });
    await page.locator('form[data-form="demo-entry"] button[type=submit]').click();
    await page.waitForSelector(".frame[data-stage='room']", { timeout: 30000 });
    const tEnter = Date.now();
    const snaps = [lobby];
    let became5 = null;
    for (const at of [1500, 4000, 8000]) {
      await sleep(Math.max(0, at - (Date.now() - tEnter)));
      const s = await snap(`room+${at}ms`); s.ms = Date.now() - tEnter; snaps.push(s);
      if (s.members?.length >= 5 && became5 === null) became5 = s.ms;
      await page.screenshot({ path: `${OUT}/shots/${name}-room-${at}.png` });
    }
    // wait for the late arrival (5 people) and record when
    for (let i = 0; i < 40 && became5 === null; i++) {
      await sleep(500);
      const n = await page.evaluate(() => window.__SPACE_EVENT_QA__?.().members.length);
      if (n >= 5) became5 = Date.now() - tEnter;
    }
    await sleep(2000);
    const s5 = await snap('room-5people'); s5.ms = Date.now() - tEnter; snaps.push(s5);
    await page.screenshot({ path: `${OUT}/shots/${name}-room-5people.png` });
    results.push({ name, viewport: [w, h], became5ms: became5, bootMs: tEnter - t0, errors, snaps });
    console.log(JSON.stringify({ name, became5ms: became5, aspect: lobby.aspect, canvas: lobby.canvas }));
    await ctx.close();
  }
  fs.writeFileSync(`${OUT}/probe-${tag}-${Date.now()}.json`, JSON.stringify(results, null, 1));
  await browser.close();
  console.log('done');
})().catch(e => { console.error('ERR', e); process.exit(1); });
