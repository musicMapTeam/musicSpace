const { chromium } = require('/tmp/space-video-prep/tools/node_modules/playwright-core');
(async () => {
  const out = {};
  for (const soft of [true, false]) {
    const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: soft ? ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-gpu'] : [] });
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
    const page = await ctx.newPage();
    await page.addInitScript(() => { const st = window.setTimeout; window.__t = []; window.setTimeout = (f, ms, ...a) => { window.__t.push(Math.round(ms || 0)); return st(f, ms, ...a); }; });
    await page.goto('http://127.0.0.1:5190/', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__SPACE_BOOT__ === 'ready', null, { timeout: 90000 });
    await page.waitForFunction(() => document.querySelector('#loading')?.hidden === true, null, { timeout: 90000 });
    await new Promise(r => setTimeout(r, 3000));
    out[soft ? 'swiftshader' : 'gpu'] = await page.evaluate(() => {
      const c = document.querySelector('#world canvas'), gl = c.getContext('webgl2');
      const info = gl?.getExtension('WEBGL_debug_renderer_info');
      return { style: window.__SPACE_EVENT_QA__?.()?.camera?.scene?.renderStyle, renderer: info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : gl?.getParameter(gl.RENDERER), canvas: [c.width, c.height, Math.round(c.getBoundingClientRect().width)], boils: window.__t.filter(t => t === 143).length, cores: navigator.hardwareConcurrency };
    });
    await page.screenshot({ path: `/tmp/space-doodle/fix/3d/soft-${soft ? 'swiftshader' : 'gpu'}-lobby-phone.png` });
    await browser.close();
  }
  console.log(JSON.stringify(out, null, 1));
})().catch(e => { console.error(e); process.exit(1); });
