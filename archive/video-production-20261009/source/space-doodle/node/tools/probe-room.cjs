// Load /event-room/ from the Node server; report fonts, doodle styles, 3D render style, console errors; screenshot.
// usage: node probe-room.cjs <base> <label> [phone|desktop]
const { launch, open, sleep, OUT, save } = require('./lib.cjs');
const base = process.argv[2] || 'http://127.0.0.1:8890';
const label = process.argv[3] || 'node';
const vp = process.argv[4] || 'phone';
(async () => {
  const browser = await launch();
  const { ctx, page, log } = await open(browser, vp);
  const t0 = Date.now();
  await page.goto(`${base}/event-room/`, { waitUntil: 'load' });
  await page.waitForFunction(() => /已连接|同场|三维/.test(document.querySelector('#render-status')?.innerText || ''), null, { timeout: 30000 }).catch(e => console.log('status wait failed', e.message));
  await sleep(4000);
  const info = await page.evaluate(async () => {
    await document.fonts.ready;
    const fams = {};
    for (const f of document.fonts) { const k = `${f.family}`; fams[k] = fams[k] || { loaded: 0, unloaded: 0, error: 0 }; fams[k][f.status === 'loaded' ? 'loaded' : f.status === 'error' ? 'error' : 'unloaded']++; }
    const cs = el => el ? getComputedStyle(el) : null;
    const body = cs(document.body), html = cs(document.documentElement);
    const pick = sel => { const el = document.querySelector(sel); if (!el) return null; const s = getComputedStyle(el); return { sel, font: s.fontFamily.slice(0, 80), size: s.fontSize, color: s.color, bg: s.backgroundColor, bgImg: s.backgroundImage.slice(0, 80), shadow: s.boxShadow.slice(0, 60), border: s.borderTopWidth + ' ' + s.borderTopStyle + ' ' + s.borderTopColor }; };
    const qa = window.__SPACE_EVENT_QA__?.();
    const checkFont = fam => document.fonts.check(`16px "${fam}"`, '现场');
    return {
      status: document.querySelector('#render-status')?.innerText,
      rooms: !!document.querySelector('meta[name="space-rooms"]'),
      dsPaper: html.getPropertyValue('--ds-paper') || body.getPropertyValue('--ds-paper'),
      bodyBg: body.backgroundColor, bodyBgImg: body.backgroundImage.slice(0, 120), bodyFont: body.fontFamily,
      fams,
      check: Object.fromEntries(['Doodle Display', 'Doodle Marker', 'Doodle Hand', 'Doodle Logo', 'Doodle Digits', 'Doodle Note'].map(f => [f, checkFont(f)])),
      samples: ['header', '.brand', '#render-status', 'h1', 'h2', 'button.primary', '#join', 'nav button', '.presence', 'footer'].map(pick).filter(Boolean),
      renderStyle: qa?.camera?.scene?.renderStyle, venue: qa?.camera?.scene?.venueAsset, identity: qa?.identityStatus, ready: qa?.ready,
      canvas: (() => { const c = document.querySelector('canvas'); return c ? { w: c.width, h: c.height, cw: c.clientWidth, ch: c.clientHeight } : null; })(),
    };
  });
  info.ms = Date.now() - t0;
  const file = `${OUT}/${label}-room-${vp}.png`;
  await page.screenshot({ path: file });
  save(`${label}-room-${vp}.json`, { info, log });
  console.log(JSON.stringify({ info, log }, null, 1).slice(0, 6000));
  console.log('saved', file);
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
