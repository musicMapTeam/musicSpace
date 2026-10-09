// node lh-compare.cjs -> screenshots HEAD (:5601) and now (:5602) livehouse at phone and desktop, reduced motion; diffs them.
const { chromium } = require('/tmp/space-video-prep/tools/node_modules/playwright-core');
const { execFileSync } = require('child_process');
const OUT = '/tmp/space-doodle/fix/3d/lh';
require('fs').mkdirSync(OUT, { recursive: true });
const VP = { phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 }, desktop: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 } };
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: ['--hide-scrollbars'] });
  const report = {};
  for (const vp of ['phone', 'desktop']) for (const [label, port] of [['head', 5601], ['now', 5602]]) {
    const ctx = await browser.newContext({ ...VP[vp], reducedMotion: 'reduce' });
    const page = await ctx.newPage(); const logs = [];
    page.on('console', m => { if (['error', 'warning'].includes(m.type())) logs.push(m.type() + ': ' + m.text().slice(0, 160)); });
    page.on('pageerror', e => logs.push('pageerror: ' + e.message.slice(0, 160)));
    await page.addInitScript(() => { const st = window.setTimeout; window.__timers = []; window.setTimeout = (f, ms, ...a) => { window.__timers.push(Math.round(ms || 0)); return st(f, ms, ...a); }; });
    await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'load' });
    await page.waitForFunction(() => window.__SPACE_LIVEHOUSE_QA__?.().ready === true, null, { timeout: 30000 });
    await sleep(2000);
    const q = await page.evaluate(() => { const s = window.__SPACE_LIVEHOUSE_QA__(); return { style: s.camera?.scene?.renderStyle ?? null, cam: s.camera?.camera?.position?.map(n => +n.toFixed(3)), aspect: s.camera?.camera?.aspect, boil143: window.__timers.filter(t => t === 143).length }; });
    report[`${vp}-${label}`] = { ...q, logs: logs.slice(0, 5) };
    for (const view of ['overview', 'person', 'photos']) {
      if (view !== 'overview') { await page.click(`[data-view=${view}]`); await sleep(1800); }
      await page.screenshot({ path: `${OUT}/${vp}-${view}-${label}.png` });
    }
    await ctx.close();
  }
  await browser.close();
  for (const vp of ['phone', 'desktop']) for (const view of ['overview', 'person', 'photos'])
    report[`diff-${vp}-${view}`] = JSON.parse(execFileSync('node', ['/tmp/space-doodle/3d-tools/pngdiff.js', `${OUT}/${vp}-${view}-head.png`, `${OUT}/${vp}-${view}-now.png`, `${OUT}/${vp}-${view}-DIFF.png`]).toString());
  console.log(JSON.stringify(report, null, 1));
})().catch(e => { console.error(e); process.exit(1); });
