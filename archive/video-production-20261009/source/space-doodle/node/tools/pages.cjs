// Load other pages from the HEAD build (8891) and the working-tree build (8890); console errors + screenshots + pixel diff.
// usage: node pages.cjs [pages comma list] [vps comma list] [reduce|no-preference]
const { launch, open, sleep, OUT, save, fs } = require('./lib.cjs');
const { PNG } = require('/tmp/space-video-prep/tools/node_modules/pngjs');
const SERVERS = { head: 'http://127.0.0.1:8891', now: 'http://127.0.0.1:8890' };
const PAGES = {
  avatar: { path: '/avatar/', ready: () => document.querySelector('#artboard')?.dataset.renderMode === '3d' || document.querySelector('canvas'), settle: 5000 },
  livehouse: { path: '/livehouse/', ready: () => window.__SPACE_LIVEHOUSE_QA__?.().ready === true, settle: 4000 },
  classic: { path: '/', ready: () => document.readyState === 'complete', settle: 4000 },
  character: { path: '/character-lab/', ready: () => document.readyState === 'complete', settle: 4000 },
  map: { path: '/music-map/', ready: () => document.readyState === 'complete', settle: 5000 },
};
const pages = (process.argv[2] || Object.keys(PAGES).join(',')).split(',');
const vps = (process.argv[3] || 'phone,desktop').split(',');
const motion = process.argv[4] || 'reduce';

function diff(a, b, out) {
  const A = PNG.sync.read(fs.readFileSync(a)), B = PNG.sync.read(fs.readFileSync(b));
  if (A.width !== B.width || A.height !== B.height) return { sizeMismatch: [A.width, A.height, B.width, B.height] };
  const D = new PNG({ width: A.width, height: A.height });
  let changed = 0;
  for (let i = 0; i < A.data.length; i += 4) {
    const d = Math.abs(A.data[i] - B.data[i]) + Math.abs(A.data[i + 1] - B.data[i + 1]) + Math.abs(A.data[i + 2] - B.data[i + 2]);
    const hit = d > 24;
    if (hit) changed++;
    const g = (A.data[i] + A.data[i + 1] + A.data[i + 2]) / 12;
    D.data[i] = hit ? 255 : g; D.data[i + 1] = hit ? 0 : g; D.data[i + 2] = hit ? 64 : g; D.data[i + 3] = 255;
  }
  fs.writeFileSync(out, PNG.sync.write(D));
  return { changedPct: +(100 * changed / (A.width * A.height)).toFixed(2) };
}

(async () => {
  const browser = await launch();
  const report = {};
  for (const name of pages) for (const vp of vps) {
    const files = {};
    for (const [tag, base] of Object.entries(SERVERS)) {
      const { ctx, page, log } = await open(browser, vp, { reducedMotion: motion });
      const t0 = Date.now();
      try {
        await page.goto(base + PAGES[name].path, { waitUntil: 'load', timeout: 60000 });
        await page.waitForFunction(PAGES[name].ready, null, { timeout: 40000 }).catch(e => log.console.push('[probe] ready wait timed out'));
        await sleep(PAGES[name].settle);
        const extra = await page.evaluate(() => ({ title: document.title, qa: window.__SPACE_LIVEHOUSE_QA__?.()?.camera?.scene?.renderStyle ?? null, canvases: document.querySelectorAll('canvas').length }));
        const file = `${OUT}/pages-${name}-${vp}-${motion}-${tag}.png`;
        await page.screenshot({ path: file });
        files[tag] = file;
        report[`${name}/${vp}/${tag}`] = { ms: Date.now() - t0, ...extra, console: log.console, pageerror: log.pageerror, bad: log.bad, failed: log.failed };
      } catch (e) { report[`${name}/${vp}/${tag}`] = { error: e.message.split('\n')[0], console: log.console, pageerror: log.pageerror }; }
      await ctx.close();
    }
    if (files.head && files.now) report[`${name}/${vp}/diff`] = diff(files.head, files.now, `${OUT}/pages-${name}-${vp}-${motion}-DIFF.png`);
    console.log(name, vp, JSON.stringify(report[`${name}/${vp}/diff`]), JSON.stringify(report[`${name}/${vp}/now`]).slice(0, 600));
  }
  save(`pages-${motion}-${pages.join('_')}.json`, report);
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
