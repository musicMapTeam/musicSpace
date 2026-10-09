// Verify-5: livehouse sample page, HEAD build vs working-tree build.
const { chromium } = require('/tmp/space-video-prep/tools/node_modules/playwright-core');
const fs = require('fs');
const OUT = '/tmp/space-doodle/verify-5/shots';
const VIEWPORTS = {
  phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  desktop: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 },
};
const TARGETS = [
  { label: 'head', url: 'http://127.0.0.1:8931/livehouse/' },
  { label: 'now', url: 'http://127.0.0.1:8932/livehouse/' },
  { label: 'now_doodle0', url: 'http://127.0.0.1:8932/livehouse/?doodle=0' },
];
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function waitReady(page) {
  await page.waitForFunction(() => window.__SPACE_LIVEHOUSE_QA__?.().ready === true, null, { timeout: 60000 });
  await sleep(1500);
}
async function waitSettled(page) {
  await page.waitForFunction(() => { const s = window.__SPACE_LIVEHOUSE_QA__?.(); return s && s.camera && !s.camera.moving; }, null, { timeout: 30000 });
  await sleep(1200);
}

(async () => {
  const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
  const report = {};
  const mode = process.argv[2] || 'reduce';
  try {
    for (const [vpName, vp] of Object.entries(VIEWPORTS)) {
      for (const t of TARGETS) {
        const ctx = await browser.newContext({ ...vp, reducedMotion: mode === 'reduce' ? 'reduce' : 'no-preference' });
        const page = await ctx.newPage();
        const consoleLines = [];
        page.on('console', m => consoleLines.push(`${m.type()}: ${m.text()}`.slice(0, 300)));
        page.on('pageerror', e => consoleLines.push(`pageerror: ${e.message}`.slice(0, 300)));
        await page.addInitScript(() => {
          window.__boilTimers = 0;
          const orig = window.setTimeout;
          window.setTimeout = function (fn, ms, ...rest) { if (Math.abs((ms || 0) - 1000 / 7) < 0.5) window.__boilTimers++; return orig.call(this, fn, ms, ...rest); };
        });
        await page.goto(t.url, { waitUntil: 'load' });
        await waitReady(page);
        const key = `${vpName}-${t.label}-${mode}`;
        const info = await page.evaluate(() => {
          const qa = window.__SPACE_LIVEHOUSE_QA__();
          const cs = sel => { const n = document.querySelector(sel); if (!n) return null; const s = getComputedStyle(n); return { color: s.color, font: s.fontFamily.slice(0, 60) }; };
          return {
            renderStyle: qa.camera?.scene?.renderStyle ?? null,
            mode: qa.mode,
            reducedMotion: qa.reducedMotion,
            fontsLogo: document.fonts.check('20px "Doodle Logo"'),
            fontFaces: [...document.fonts].map(f => f.family).slice(0, 10),
            dsPaperVar: getComputedStyle(document.documentElement).getPropertyValue('--ds-paper').trim(),
            heading: cs('.scene-heading small'), h1: cs('.scene-heading h1'), code: cs('.scene-code'),
          };
        });
        await page.screenshot({ path: `${OUT}/${key}-overview.png` });
        // sample the backdrop behind the scene heading for a contrast check
        info.backdrop = await page.evaluate(() => { const r = document.querySelector('.scene-heading').getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; });
        // boil timer activity during 2 seconds of idle
        const b0 = await page.evaluate(() => window.__boilTimers);
        await sleep(2000);
        const b1 = await page.evaluate(() => window.__boilTimers);
        info.boilTimersIn2s = b1 - b0;
        await page.click('nav.camera-nav button[data-view="person"]');
        await waitSettled(page);
        await page.screenshot({ path: `${OUT}/${key}-person.png` });
        await page.click('nav.camera-nav button[data-view="photos"]');
        await waitSettled(page);
        await page.screenshot({ path: `${OUT}/${key}-photos.png` });
        info.console = consoleLines.filter(l => !/DevTools|Download the/.test(l)).slice(0, 8);
        report[key] = info;
        await ctx.close();
      }
    }
  } finally {
    await browser.close();
  }
  fs.writeFileSync(`${OUT}/report-${mode}.json`, JSON.stringify(report, null, 1));
  console.log(JSON.stringify(report, null, 1));
})().catch(e => { console.error(e); process.exit(1); });
