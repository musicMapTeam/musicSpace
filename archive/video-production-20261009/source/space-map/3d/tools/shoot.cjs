// 3D camera-stop and record-table states, phone + desktop, real GPU Chrome.
// Usage: BASE=<map url ending in /> LABEL=<label> [PAPER=1] [QUERY='?doodle=0'] [ONLY=phone|desktop] [STATES=a,b] [SCENE_ONLY=1] [REDUCED=1] node shoot.cjs
const { chromium } = require('/tmp/space-video-prep/tools/node_modules/playwright-core');
const fs = require('fs');
const BASE = process.env.BASE; const LABEL = process.env.LABEL || 'x'; const QUERY = process.env.QUERY || '';
const OUT = `/tmp/space-map/shots/${LABEL}`; fs.mkdirSync(OUT, { recursive: true });
const VPS = {
  phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  desktop: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: Number(process.env.DPR || 1) },
};
if (process.env.VPX) { for (const key of Object.keys(VPS)) delete VPS[key]; for (const item of process.env.VPX.split(',')) { const [name, size] = item.split('='); const [width, height] = size.split('x').map(Number); VPS[name] = width < 700 ? { viewport: { width, height }, deviceScaleFactor: 2, isMobile: true, hasTouch: true } : { viewport: { width, height } }; } }
const CLIPS = process.env.CLIP ? Object.fromEntries(process.env.CLIP.split(';').map(item => { const [state, box] = item.split(':'); const [x, y, width, height] = box.split(',').map(Number); return [state, { x, y, width, height }]; })) : {};
const sleep = ms => new Promise(r => setTimeout(r, ms));
const wanted = (process.env.STATES || 'home,round,moved,reveal,roam,records').split(',');
(async () => {
  const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: ['--use-angle=metal', '--enable-gpu'] });
  for (const [name, opts] of Object.entries(VPS)) {
    if (process.env.ONLY && process.env.ONLY !== name) continue;
    const ctx = await browser.newContext({ ...opts, reducedMotion: process.env.REDUCED ? 'reduce' : 'no-preference' });
    if (process.env.PAPER) await ctx.addInitScript(() => { const apply = () => document.documentElement?.style.setProperty('--ds-paper', '#f7efdf'); apply(); document.addEventListener('readystatechange', apply); });
    const page = await ctx.newPage(); const errs = [];
    page.on('pageerror', e => errs.push('pageerror ' + String(e).slice(0, 300)));
    page.on('console', m => { if ((m.type() === 'error' || m.type() === 'warning') && !m.text().includes('flatShading')) errs.push(m.type() + ' ' + m.text().slice(0, 300)); });
    const shot = async (state) => {
      const file = `${OUT}/${state}-${name}.png`;
      const hide = process.env.SCENE_ONLY ? await page.addStyleTag({ content: 'body * { visibility: hidden !important; } #sakura-world canvas, #sakura-world .world-hotspots, #sakura-world .world-hotspots * { visibility: visible !important; } #sakura-world .world-music-hit { visibility: hidden !important; }' }) : null;
      await page.screenshot({ path: file, clip: CLIPS[state] || CLIPS['*'] });
      if (hide) await hide.evaluate(node => node.remove());
      const style = await page.evaluate(() => document.querySelector('#sakura-world')?.dataset.renderStyle || '-');
      console.log(name, state, 'style=' + style);
    };
    const open = async (hash, wait = 4500) => { await page.goto(`${BASE}${QUERY}#/${hash}`, { waitUntil: 'load' }); await page.waitForSelector('canvas.sakura-scene__canvas', { timeout: 20000 }); await sleep(wait); };
    const click = async (sel, i = 0) => { const el = page.locator(sel).nth(i); await el.click({ timeout: 5000 }); };
    const run = async (state, fn) => { if (!wanted.includes(state)) return; try { await fn(); await shot(state); } catch (e) { console.log('FAIL', name, state, String(e).slice(0, 200)); } };
    await run('home', () => open('home'));
    await run('round', () => open('explore'));
    await run('moved', async () => { await open('explore'); await click('[data-map-action="flip"]'); await sleep(1300); await click('.map-round-card.is-open [data-map-action="move"]'); await sleep(2600); });
    await run('reveal', async () => {
      await open('explore'); await page.evaluate(() => { const d = document.querySelector('.map-shop-menu'); if (d) d.open = true; });
      await click('[data-map-action="reveal"]'); await sleep(400); await click('[data-map-action="reveal-confirm"]'); await sleep(5200);
      await page.keyboard.press('Escape'); await sleep(300);
      const close = page.locator('.map-dialog [data-map-action="close"]'); if (await close.count()) { await close.first().click({ timeout: 2000 }).catch(() => {}); }
      await sleep(1600);
    });
    await run('hint', async () => { await open('explore'); await click('[data-map-action="hint"]'); await sleep(900); await click('[data-map-action="hint"]'); await sleep(1800); });
    await run('roam', async () => { await open('home', 3500); await click('[data-home-start]'); await sleep(3800); });
    await run('records', () => open('records'));
    console.log(name, 'errors:', errs.length ? errs.join(' || ') : 'none');
    await ctx.close();
  }
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
