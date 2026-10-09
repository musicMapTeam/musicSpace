// Event room (shared dev server): is --ds-paper set on :root when the 3D canvas mounts, and which render style runs?
const { chromium } = require('/tmp/space-video-prep/tools/node_modules/playwright-core');
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
  try {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    const page = await ctx.newPage();
    await page.addInitScript(() => {
      window.__dsAtMount = 'not-mounted';
      const obs = new MutationObserver(() => {
        const c = document.querySelector('#world canvas');
        if (c && window.__dsAtMount === 'not-mounted') { window.__dsAtMount = getComputedStyle(document.documentElement).getPropertyValue('--ds-paper').trim() || '(empty)'; obs.disconnect(); }
      });
      document.addEventListener('DOMContentLoaded', () => obs.observe(document.body, { childList: true, subtree: true }));
    });
    await page.goto('http://127.0.0.1:5190/', { waitUntil: 'load' });
    await page.waitForFunction(() => window.__SPACE_BOOT__ === 'ready', null, { timeout: 90000 });
    await sleep(3000);
    const out = await page.evaluate(() => ({ dsAtMount: window.__dsAtMount, renderStyle: window.__SPACE_EVENT_QA__?.().camera?.scene?.renderStyle ?? null, route: window.__SPACE_EVENT_QA__?.().route }));
    console.log(JSON.stringify(out));
    await ctx.close();
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
