// verify-21: independent repro of "1440x900: the tour/presence card hides the visitor's own avatar and tag".
// usage: node probe.cjs <width> <height> <tag> [route]
const { chromium } = require('/tmp/space-video-prep/tools/node_modules/playwright-core');
const fs = require('fs');
const OUT = '/tmp/space-doodle/verify-21';
const URL = process.env.SPACE_URL || 'http://127.0.0.1:5190/';
const [W, H, TAG, ROUTE] = [Number(process.argv[2] || 1440), Number(process.argv[3] || 900), process.argv[4] || 'w1440', process.argv[5] === 'route'];
const sleep = ms => new Promise(r => setTimeout(r, ms));
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

// everything measured in the page
const MEASURE = () => {
  const R = el => { if (!el) return null; const b = el.getBoundingClientRect(); return [Math.round(b.left), Math.round(b.top), Math.round(b.right), Math.round(b.bottom)]; };
  const pres = document.querySelector('.frame .presence');
  const cs = getComputedStyle(pres);
  const presVisible = cs.visibility !== 'hidden' && cs.display !== 'none' && pres.getClientRects().length > 0;
  const pr = pres.getBoundingClientRect();
  const cover = b => { const w = Math.max(0, Math.min(b.right, pr.right) - Math.max(b.left, pr.left)); const h = Math.max(0, Math.min(b.bottom, pr.bottom) - Math.max(b.top, pr.top)); return Math.round(100 * w * h / Math.max(1, b.width * b.height)); };
  const qa = window.__SPACE_EVENT_QA__?.();
  const tour = document.querySelector('.demo-tour');
  const tags = [...document.querySelectorAll('#hotspots .hotspot')].filter(n => !n.hidden && n.getClientRects().length).map(n => { const b = n.getBoundingClientRect(); return { label: n.textContent.trim(), rect: R(n), coveredPct: presVisible ? cover(b) : 0 }; });
  // project each avatar (feet y=0, head ~y=1.75, half-width ~0.35) with the live camera
  const cam = qa?.camera?.camera; const world = document.querySelector('#world'); const wr = world.getBoundingClientRect();
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]], norm = a => { const l = Math.hypot(...a); return a.map(v => v / l); };
  let avatars = [];
  if (cam && cam.fov) {
    const f = norm(sub(cam.target, cam.position)), r = norm(cross(f, [0, 1, 0])), u = cross(r, f), t = Math.tan(cam.fov * Math.PI / 360);
    const P = p => { const d = sub(p, cam.position); const x = dot(d, r), y = dot(d, u), z = dot(d, f); return [wr.left + (x / (z * t * cam.aspect) + 1) / 2 * wr.width, wr.top + (1 - y / (z * t)) / 2 * wr.height]; };
    const portrait = window.innerWidth < 700;
    const shown = qa.members.slice(0, portrait ? 4 : 8), n = shown.length;
    const right = portrait ? [.99015, .14] : [.87004, .493];
    const gap = portrait ? (n > 2 ? 1.15 : 1.9) : (n > 4 ? 1.45 : 2.15), centerZ = portrait ? 1.4 : 2;
    avatars = shown.map((m, i) => {
      const x = (i - (n - 1) / 2) * gap, depth = n > 2 ? (i % 2 ? .1 : -.1) : 0;
      const pos = [right[0] * x + right[1] * depth, 0, centerZ + right[1] * x - right[0] * depth];
      const pts = [[0, 0], [0, 1.75]].flatMap(([dx, y]) => [-.35, .35].map(s => P([pos[0] + s * right[0], y, pos[2] + s * right[1]])));
      const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
      const box = { left: Math.min(...xs), right: Math.max(...xs), top: Math.min(...ys), bottom: Math.max(...ys) };
      box.width = box.right - box.left; box.height = box.bottom - box.top;
      return { name: m.name, me: m.id === qa.actorId, box: [box.left, box.top, box.right, box.bottom].map(Math.round), coveredPct: presVisible ? cover(box) : 0 };
    });
  }
  const meTag=[...document.querySelectorAll('#hotspots .hotspot')].find(n=>!n.hidden&&/· 我/.test(n.textContent));
  let meTagHit=null; if(meTag){const b=meTag.getBoundingClientRect(); const e=document.elementFromPoint(b.left+b.width/2,b.top+b.height/2); meTagHit=e===meTag||meTag.contains(e)?'tag':(e?.closest('.presence')?'presence':(e?.id||e?.className||e?.tagName));}
  return {
    meTagHit,
    presence: R(pres), presVisible, presenceClass: pres.className, presenceWidth: Math.round(pr.width),
    tour: tour && !tour.hidden ? R(tour) : null, tourTitle: tour && !tour.hidden ? tour.querySelector('.demo-tour-title')?.textContent?.replace(/\s+/g, ' ').trim() : null,
    panelOpen: !document.querySelector('#panel')?.hidden, camView: qa?.camera?.view, view: null, camPos: cam?.position?.map(v=>+v.toFixed(2)),
    world: R(world), members: qa?.members?.length, tags, avatars,
  };
};

async function measure(page, label, shot = true) {
  const m = await page.evaluate(MEASURE);
  delete m.view;
  log(label, JSON.stringify(m));
  if (shot) await page.screenshot({ path: `${OUT}/${TAG}-${label}.png` });
  return m;
}
async function hiddenShot(page, label) {
  await page.addStyleTag({ content: '.frame .presence{visibility:hidden!important}' }).then(async h => {
    await sleep(150); await page.screenshot({ path: `${OUT}/${TAG}-${label}-presence-hidden.png` });
    await h.evaluate(n => n.remove());
  });
}
async function settle(page, ms = 2500) {
  await sleep(400);
  await page.waitForFunction(() => !window.__SPACE_EVENT_QA__?.()?.camera?.moving, null, { timeout: 15000 }).catch(() => {});
  await sleep(ms);
}
async function closePanels(page) {
  for (let i = 0; i < 4; i++) {
    const open = await page.evaluate(() => {
      const b = document.querySelector('.photo-exchanges:not([hidden]) [data-x-close]'); if (b && b.getClientRects().length) { b.click(); return 'x'; }
      const p = document.querySelector('#panel'); if (p && !p.hidden) { document.querySelector('#panel-close')?.click(); return 'panel'; }
      for (const c of document.querySelectorAll('.community-panel:not([hidden])>header>button')) if (c.getClientRects().length) { c.click(); return 'community'; }
      return null;
    });
    if (!open) break; await sleep(700);
  }
}

(async () => {
  const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: ['--use-gl=angle', '--enable-webgl', '--ignore-gpu-blocklist', '--hide-scrollbars'] });
  const results = {};
  try {
    const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    page.setDefaultTimeout(30000);
    page.on('pageerror', e => log('[pageerror]', e.message.slice(0, 160)));
    await page.goto(URL, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__SPACE_BOOT__ === 'ready', null, { timeout: 90000 });
    await page.evaluate(() => document.fonts.ready); await sleep(1000);
    // enter: 「进入示例现场」 -> consent -> 「进入示例现场」
    await page.locator('#join').click();
    await page.waitForSelector('form[data-form="demo-entry"]');
    await page.locator('form[data-form="demo-entry"] input[name=consent]').check();
    await page.waitForFunction(() => !document.querySelector('form[data-form="demo-entry"] button[type=submit]')?.disabled, null, { timeout: 60000 });
    await page.locator('form[data-form="demo-entry"] button[type=submit]').click();
    await page.waitForFunction(() => !document.querySelector('form[data-form="demo-entry"]'), null, { timeout: 60000 });
    const t0 = Date.now();
    await settle(page, 2500);
    results.enter = await measure(page, 'enter');
    await hiddenShot(page, 'enter');
    // the collapsed note (「收起」)
    const toggle = page.locator('.demo-tour [data-tour-toggle]');
    if (await toggle.count()) {
      await toggle.click(); await sleep(900);
      results.collapsed = await measure(page, 'collapsed');
      await toggle.click(); await sleep(900);
    }
    if (ROUTE) {
      // step 1: 「人海 · 示例照片」 -> upload form -> 「保存这张照片」
      await page.locator('.demo-tour .demo-tour-action.primary').first().click();
      await page.waitForSelector('#panel:not([hidden]) form button.primary[type=submit]:not([disabled])', { timeout: 60000 });
      await sleep(800);
      await page.locator('#panel:not([hidden]) form button.primary[type=submit]').click();
      await sleep(4000);
      log('after save: panel open?', await page.evaluate(() => !document.querySelector('#panel').hidden), 'members', await page.evaluate(() => window.__SPACE_EVENT_QA__().members.map(m => m.name).join('|')));
      await closePanels(page); await settle(page, 2500);
      results.step2 = await measure(page, 'step2');
      // step 2: 「去照片墙看看」 -> wall -> 「和 TA 交换这个视角」 -> consent -> send
      await page.locator('.demo-tour .demo-tour-action.primary').first().click();
      await page.waitForSelector('[data-exchange-offer]', { timeout: 60000 });
      await sleep(1200);
      await page.locator('[data-exchange-offer]').first().click();
      await page.waitForSelector('[data-x-consent]', { timeout: 30000 });
      await sleep(600);
      // pick a choice if one is needed, tick consent, send
      await page.evaluate(() => { const c = document.querySelector('[data-x-choice]:not(:checked)'); if (c && !document.querySelector('[data-x-choice]:checked')) c.click(); });
      await page.locator('[data-x-consent]').first().check();
      await sleep(400);
      await page.locator('[data-x-send]').first().click();
      log('sent; waiting for accept');
      await page.waitForFunction(() => /交换已接受/.test(document.body.innerText), null, { timeout: 60000 }).catch(() => log('no 交换已接受 within 60s'));
      await sleep(1500);
      await closePanels(page); await settle(page, 2500);
      results.step4 = await measure(page, 'step4');
      // step 4: 「回看这一晚」 (extra) -> close -> closing card
      const extra = page.locator('.demo-tour .demo-tour-action.quiet');
      if (await extra.count()) { await extra.first().click(); await sleep(2500); await closePanels(page); await settle(page, 2500); }
      results.done = await measure(page, 'done');
    }
    log('elapsed since enter (s)', Math.round((Date.now() - t0) / 1000));
    fs.writeFileSync(`${OUT}/${TAG}-results.json`, JSON.stringify(results, null, 1));
    await ctx.close();
  } catch (e) { log('ERROR', e.message); }
  finally { await browser.close(); }
})();
