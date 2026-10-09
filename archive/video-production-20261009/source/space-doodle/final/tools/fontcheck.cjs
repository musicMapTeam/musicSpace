// Which Doodle font files a fresh first screen pulls, and crops of the glyph fixes. usage: node fontcheck.cjs <phone|desktop> [url]
const L = require('./lib.cjs');
L.watchdog(240);
const kind = process.argv[2] || 'phone';
(async () => {
  const browser = await L.launch();
  try {
    const run = await L.open(browser, kind);
    const { page } = run;
    await L.sleep(2500);
    const files = await page.evaluate(() => performance.getEntriesByType('resource').filter(e => /\.woff2|fonts\.css/.test(e.name)).map(e => [e.name.split('/').pop(), Math.round(e.transferSize / 1024), Math.round(e.startTime), Math.round(e.responseEnd)]));
    console.log(kind, 'lobby font files', JSON.stringify(files));
    await L.shot(page, `/tmp/space-doodle/final/fonts-work/fc-lobby-${kind}.png`);
    await L.press(run, '#join');
    await page.waitForSelector('form[data-form="demo-entry"]', { timeout: 30000 });
    await page.evaluate(() => document.fonts.ready); await L.sleep(1200);
    await L.shot(page, `/tmp/space-doodle/final/fonts-work/fc-join-${kind}.png`);
    const files2 = await page.evaluate(() => performance.getEntriesByType('resource').filter(e => /\.woff2/.test(e.name)).map(e => e.name.split('/').pop()));
    console.log(kind, 'after join sheet', JSON.stringify(files2));
    // the header marks in marker lettering: which face renders them
    const marks = await page.evaluate(async () => { const out = {}; for (const [sel, ch] of [['#music-map-entry span', '↗'], ['#social-inbox', '♡']]) { const el = document.querySelector(sel); out[sel] = el ? getComputedStyle(el).fontFamily.split(',')[0] : null; } out.symbolsLoaded = [...document.fonts].filter(f => f.status === 'loaded' && f.family.includes('Marker') && /2197/i.test(f.unicodeRange)).length; return out; });
    console.log(kind, 'marks', JSON.stringify(marks));
  } catch (e) { console.log('FAILED', e.message.split('\n')[0]); }
  finally { await browser.close(); }
})();
