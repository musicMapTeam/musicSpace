const { chromium } = require('/tmp/space-video-prep/tools/node_modules/playwright-core');
(async () => {
  for (const args of [[], ['--disable-gpu-vsync', '--disable-frame-rate-limit']]) {
    const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args });
    const page = await browser.newPage();
    await page.goto('about:blank');
    const info = await page.evaluate(() => {
      const c = document.createElement('canvas'); const gl = c.getContext('webgl2');
      if (!gl) return 'no webgl2';
      const d = gl.getExtension('WEBGL_debug_renderer_info');
      return { renderer: d ? gl.getParameter(d.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER), timer: !!gl.getExtension('EXT_disjoint_timer_query_webgl2'), cbf: !!gl.getExtension('EXT_color_buffer_float'), maxTex: gl.getParameter(gl.MAX_TEXTURE_SIZE) };
    });
    const raf = await page.evaluate(() => new Promise(r => { const t = []; let last = 0; const f = now => { if (last) t.push(now - last); last = now; if (t.length < 60) requestAnimationFrame(f); else r((t.reduce((a, b) => a + b) / t.length).toFixed(2)); }; requestAnimationFrame(f); }));
    console.log(JSON.stringify(args), JSON.stringify(info), 'raf ms', raf);
    await browser.close();
  }
})();
