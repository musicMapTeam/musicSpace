// Force every doodle fallback path and check what the live room renders.
// modes: normal, doodle0 (?doodle=0), celfault (doodle cel program fails to link), compfault (composite fails),
//        nofloat (no float colour buffers -> 8-bit doodle), mediump (no highp -> classic), smalltex (MAX_TEXTURE_SIZE 2048 -> classic)
const { chromium } = require('/tmp/space-video-prep/tools/node_modules/playwright-core');
const crypto = require('crypto');
const OUT = '/tmp/space-doodle/3d-tools/fallback';
require('fs').mkdirSync(OUT, { recursive: true });
const modes = (process.argv[2] || 'normal,doodle0,celfault,compfault,nofloat,mediump,smalltex').split(',');
(async () => {
  const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
  for (const mode of modes) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
    await ctx.addInitScript(mode => {
      const P = WebGL2RenderingContext.prototype;
      const failOn = mode === 'celfault' ? 'doodleKey' : mode === 'compfault' ? 'uHatchSpacing' : null;
      if (failOn) {
        const src = new WeakMap(), bad = new WeakSet();
        const ss = P.shaderSource; P.shaderSource = function (sh, s) { src.set(sh, s); return ss.call(this, sh, s); };
        const at = P.attachShader; P.attachShader = function (p, sh) { if ((src.get(sh) || '').includes(failOn)) bad.add(p); return at.call(this, p, sh); };
        const gp = P.getProgramParameter; P.getProgramParameter = function (p, n) { if (n === this.LINK_STATUS && bad.has(p)) return false; return gp.call(this, p, n); };
      } else if (mode === 'nofloat') {
        const ge = P.getExtension; P.getExtension = function (name) { if (/color_buffer_(half_)?float/i.test(name)) return null; return ge.call(this, name); };
        const gse = P.getSupportedExtensions; P.getSupportedExtensions = function () { return (gse.call(this) || []).filter(n => !/color_buffer_(half_)?float/i.test(n)); };
      } else if (mode === 'mediump') {
        const gp = P.getShaderPrecisionFormat; P.getShaderPrecisionFormat = function (type, prec) { const r = gp.call(this, type, prec); if (prec === this.HIGH_FLOAT) return { rangeMin: 0, rangeMax: 0, precision: 0 }; return r; };
      } else if (mode === 'smalltex') {
        const gp = P.getParameter; P.getParameter = function (n) { if (n === this.MAX_TEXTURE_SIZE) return 2048; return gp.call(this, n); };
      }
    }, mode);
    const page = await ctx.newPage(); const logs = [];
    page.on('console', m => { if (['error', 'warning'].includes(m.type())) logs.push(m.type() + ': ' + m.text().slice(0, 140).replace(/\n/g, ' | ')); });
    page.on('pageerror', e => logs.push('pageerror: ' + e.message));
    await page.goto('http://127.0.0.1:5190/' + (mode === 'doodle0' ? '?doodle=0' : ''));
    await page.waitForFunction(() => window.__SPACE_BOOT__ === 'ready', null, { timeout: 60000 });
    await page.waitForFunction(() => document.querySelector('#loading')?.hidden === true, null, { timeout: 60000 }).catch(() => logs.push('loading never hid'));
    await new Promise(r => setTimeout(r, 1800));
    const info = await page.evaluate(() => {
      const s = window.__SPACE_EVENT_QA__?.()?.camera?.scene; const c = document.querySelector('#world canvas.toon-scene-canvas');
      return { style: s?.renderStyle, venue: s?.venueAsset?.status, canvas: c ? [c.width, c.height] : null, renderMode: document.querySelector('#world')?.dataset?.renderMode || document.querySelector('[data-render-mode]')?.dataset?.renderMode };
    });
    const shot = await page.locator('#world canvas').first().screenshot({ path: `${OUT}/${mode}.png` });
    // How much of the canvas is non-background? (a blank canvas would be one colour)
    const colours = await page.evaluate(() => { const c = document.querySelector('#world canvas.toon-scene-canvas'); const o = document.createElement('canvas'); o.width = 64; o.height = 64; const x = o.getContext('2d'); x.drawImage(c, 0, 0, 64, 64); const d = x.getImageData(0, 0, 64, 64).data; const set = new Set(); for (let i = 0; i < d.length; i += 4) set.add((d[i] >> 4) + ',' + (d[i + 1] >> 4) + ',' + (d[i + 2] >> 4)); return set.size; });
    console.log(mode.padEnd(10), JSON.stringify(info), 'distinct-colours=' + colours, 'md5=' + crypto.createHash('md5').update(shot).digest('hex').slice(0, 8), JSON.stringify(logs.slice(0, 4)));
    await ctx.close();
  }
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
