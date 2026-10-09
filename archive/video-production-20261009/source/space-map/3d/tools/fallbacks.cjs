// Fallback paths in a real browser: a doodle shader that fails to compile, a GPU without the pass's features,
// WebGL off, and the software renderer (low-end path). BASE=.. node fallbacks.cjs
const { chromium } = require('/tmp/space-video-prep/tools/node_modules/playwright-core');
const fs = require('fs');
const BASE = process.env.BASE; const OUT = '/tmp/space-map/shots/3d-fallbacks'; fs.mkdirSync(OUT, { recursive: true });
const paperInit = () => { const apply = () => document.documentElement?.style.setProperty('--ds-paper', '#f7efdf'); apply(); document.addEventListener('readystatechange', apply); };
const cases = {
  // Every fragment shader that carries the doodle cel patch fails to compile.
  'shader-error': { args: ['--use-angle=metal', '--enable-gpu'], init: () => {
    for (const proto of [WebGL2RenderingContext.prototype]) {
      const original = proto.shaderSource;
      proto.shaderSource = function (shader, source) { return original.call(this, shader, source.includes('uDoodleTerminator') ? source.replace('void main()', 'void main() { this is not glsl; }\nvoid unused()') : source); };
    }
  } },
  // A GPU whose largest texture is below the pass's 4096 floor.
  'small-gpu': { args: ['--use-angle=metal', '--enable-gpu'], init: () => {
    const original = WebGL2RenderingContext.prototype.getParameter;
    WebGL2RenderingContext.prototype.getParameter = function (name) { return name === this.MAX_TEXTURE_SIZE ? 2048 : original.call(this, name); };
  } },
  'webgl-off': { args: ['--disable-webgl', '--disable-3d-apis'] },
  'software': { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] },
};
(async () => {
  for (const [name, spec] of Object.entries(cases)) {
    const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: spec.args });
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await ctx.addInitScript(paperInit); if (spec.init) await ctx.addInitScript(spec.init);
    const page = await ctx.newPage(); const errs = []; const consoleErrors = [];
    page.on('pageerror', e => errs.push(String(e).slice(0, 200)));
    page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 120)); });
    await page.goto(BASE + '#/home', { waitUntil: 'load' }); await page.waitForTimeout(name === 'software' ? 9000 : 4500);
    const r = await page.evaluate(() => ({ style: document.querySelector('#sakura-world')?.dataset.renderStyle ?? '-', fallback: document.body.classList.contains('spatial-fallback'), canvas: Boolean(document.querySelector('canvas.sakura-scene__canvas')) }));
    await page.screenshot({ path: `${OUT}/${name}-home.png` });
    if (r.canvas) { await page.goto(BASE + '#/explore', { waitUntil: 'load' }); await page.waitForTimeout(name === 'software' ? 9000 : 4000); await page.screenshot({ path: `${OUT}/${name}-explore.png` }); r.exploreStyle = await page.evaluate(() => document.querySelector('#sakura-world')?.dataset.renderStyle); }
    console.log(name, JSON.stringify(r), '| page errors:', errs.length ? errs.join(' | ') : 'none', '| console errors:', consoleErrors.length, consoleErrors.slice(0, 2).join(' | '));
    await browser.close();
  }
})().catch(e => { console.error(e); process.exit(1); });
