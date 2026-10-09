// Simulate a doodle shader link failure and check the page falls back to the classic renderer.
const { chromium } = require('/tmp/space-video-prep/tools/node_modules/playwright-core');
(async () => {
  const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
  for (const mode of ['fault', 'nofloat']) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
    await ctx.addInitScript(mode => {
      const P = WebGL2RenderingContext.prototype;
      if (mode === 'fault') {
        const src = new WeakMap(), bad = new WeakSet();
        const ss = P.shaderSource; P.shaderSource = function (sh, s) { src.set(sh, s); return ss.call(this, sh, s); };
        const at = P.attachShader; P.attachShader = function (p, sh) { if ((src.get(sh) || '').includes('doodleKey')) bad.add(p); return at.call(this, p, sh); };
        const gp = P.getProgramParameter; P.getProgramParameter = function (p, n) { if (n === this.LINK_STATUS && bad.has(p)) return false; return gp.call(this, p, n); };
      } else {
        const ge = P.getExtension; P.getExtension = function (name) { if (/color_buffer_(half_)?float/i.test(name)) return null; return ge.call(this, name); };
      }
    }, mode);
    const page = await ctx.newPage(); const logs = [];
    page.on('console', m => { if (['error', 'warning'].includes(m.type())) logs.push(m.type() + ': ' + m.text().slice(0, 160)); });
    page.on('pageerror', e => logs.push('pageerror: ' + e.message));
    await page.goto('http://127.0.0.1:5190/');
    await page.waitForFunction(() => window.__SPACE_BOOT__ === 'ready', null, { timeout: 60000 });
    await page.waitForFunction(() => document.querySelector('#loading')?.hidden === true, null, { timeout: 60000 }).catch(() => logs.push('loading never hid'));
    await new Promise(r => setTimeout(r, 1500));
    const style = await page.evaluate(() => { try { const q = window.__SPACE_EVENT_QA__?.(); return q?.camera?.scene?.renderStyle; } catch (e) { return 'threw ' + e.message; } });
    await page.screenshot({ path: `/tmp/space-doodle/3d-tools/${mode}.png` });
    console.log(mode, '->', style, JSON.stringify(logs.slice(0, 6)));
    await ctx.close();
  }
  await browser.close();
})();
