// Avatar studio: same click path on HEAD (8891) and now (8890); screenshot each state + pixel diff; also export PNG (capture()).
const { launch, open, sleep, OUT, save, fs } = require('./lib.cjs');
const { PNG } = require('/tmp/space-video-prep/tools/node_modules/pngjs');
const vp = process.argv[2] || 'desktop';
const STEPS = [
  ['landing', null],
  ['pose-wave', 'button[data-action=pose][data-value=wave]'],
  ['scene-sakura', 'button[data-action=scene][data-value=sakura-night]'],
  ['scene-stage', 'button[data-action=scene][data-value=fan-stage]'],
  ['tab-tune', 'button[data-action=tab][data-value=tune]'],
  ['tab-together', 'button[data-action=tab][data-value=together]'],
  ['preview', 'button[data-action=preview]'],
];
function diff(a, b) {
  const A = PNG.sync.read(fs.readFileSync(a)), B = PNG.sync.read(fs.readFileSync(b));
  if (A.width !== B.width || A.height !== B.height) return 'size';
  let c = 0; for (let i = 0; i < A.data.length; i += 4) if (Math.abs(A.data[i] - B.data[i]) + Math.abs(A.data[i + 1] - B.data[i + 1]) + Math.abs(A.data[i + 2] - B.data[i + 2]) > 24) c++;
  return +(100 * c / (A.width * A.height)).toFixed(2);
}
(async () => {
  const browser = await launch(); const out = {};
  for (const [tag, base] of [['head', 'http://127.0.0.1:8891'], ['now', 'http://127.0.0.1:8890']]) {
    const { ctx, page, log } = await open(browser, vp, { reducedMotion: 'reduce' });
    await page.goto(base + '/avatar/', { waitUntil: 'load' }); await sleep(5000);
    for (const [name, sel] of STEPS) {
      if (sel) { const el = page.locator(sel).first(); if (await el.isVisible().catch(() => false)) await el.click(); else console.log(tag, 'missing', sel); await sleep(2500); }
      await page.screenshot({ path: `${OUT}/avatar-${vp}-${name}-${tag}.png` });
      if (name === 'preview') { await page.keyboard.press('Escape'); await sleep(800); }
    }
    // export: capture()
    const dl = page.waitForEvent('download', { timeout: 15000 }).catch(() => null);
    const ex = page.locator('button[data-action=export-solo]').first(); if (await ex.isVisible().catch(() => false)) await ex.click();
    const d = await dl; if (d) { const f = `${OUT}/avatar-${vp}-export-${tag}.png`; await d.saveAs(f); out[tag + ':export'] = fs.statSync(f).size; } else out[tag + ':export'] = 'no download';
    await sleep(1500); await page.screenshot({ path: `${OUT}/avatar-${vp}-after-export-${tag}.png` });
    out[tag] = { console: [...new Set(log.console)], pageerror: log.pageerror, bad: log.bad };
    await ctx.close();
  }
  for (const [name] of [...STEPS, ['after-export']]) out['diff:' + name] = diff(`${OUT}/avatar-${vp}-${name}-head.png`, `${OUT}/avatar-${vp}-${name}-now.png`);
  if (fs.existsSync(`${OUT}/avatar-${vp}-export-head.png`) && fs.existsSync(`${OUT}/avatar-${vp}-export-now.png`)) out['diff:export'] = diff(`${OUT}/avatar-${vp}-export-head.png`, `${OUT}/avatar-${vp}-export-now.png`);
  save(`avatar-cmp-${vp}.json`, out); console.log(JSON.stringify(out, null, 1));
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
