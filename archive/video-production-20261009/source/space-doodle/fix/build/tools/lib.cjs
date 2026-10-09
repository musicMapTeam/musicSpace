// Shared helpers for the node-lens critique (playwright-core + system Chrome).
const { chromium } = require('/tmp/space-video-prep/tools/node_modules/playwright-core');
const fs = require('fs');
const path = require('path');

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const VP = {
  phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  desktop: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 },
};
const sleep = ms => new Promise(r => setTimeout(r, ms));
const OUT = '/tmp/space-doodle/fix/build';
fs.mkdirSync(OUT, { recursive: true });

async function launch() {
  return chromium.launch({ executablePath: CHROME, headless: true, args: ['--ignore-gpu-blocklist', '--use-angle=metal', '--enable-gpu-rasterization', '--hide-scrollbars', '--mute-audio', '--force-color-profile=srgb'] });
}

/** New context + page that records console errors/warnings, page errors and failed/4xx requests. */
async function open(browser, vp = 'phone', opts = {}) {
  const ctx = await browser.newContext({ ...VP[vp], locale: 'zh-CN', timezoneId: 'Asia/Shanghai', reducedMotion: opts.reducedMotion || 'no-preference', ...(opts.ctx || {}) });
  const page = await ctx.newPage();
  const log = { console: [], pageerror: [], failed: [], bad: [], fonts: [] };
  page.on('console', m => { if (['error', 'warning'].includes(m.type())) log.console.push(`[${m.type()}] ${m.text().slice(0, 400)}`); });
  page.on('pageerror', e => log.pageerror.push(String(e && e.stack || e).slice(0, 600)));
  page.on('requestfailed', r => log.failed.push(`${r.failure()?.errorText} ${r.url().slice(0, 200)}`));
  page.on('response', r => {
    const u = r.url();
    if (r.status() >= 400) log.bad.push(`${r.status()} ${u.slice(0, 200)}`);
    if (/\.woff2(\?|$)|fonts\.css/.test(u)) log.fonts.push(`${r.status()} ${r.headers()['content-type']} ${u.replace(/^https?:\/\/[^/]+/, '')}`);
  });
  return { ctx, page, log };
}

function save(name, data) { fs.writeFileSync(path.join(OUT, name), typeof data === 'string' ? data : JSON.stringify(data, null, 2)); }

module.exports = { launch, open, sleep, OUT, VP, save, fs, path };
