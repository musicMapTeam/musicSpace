const { chromium } = require('/tmp/space-video-prep/tools/node_modules/playwright-core');
(async () => {
  const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.addInitScript(() => {
    const RO = window.ResizeObserver; window.__roHooks = [];
    window.ResizeObserver = class extends RO { constructor(cb) { super(cb); this.__cb = cb; } observe(el, o) { window.__roHooks.push({ el, cb: this.__cb }); return super.observe(el, o); } };
  });
  const page = await ctx.newPage();
  await page.goto('http://127.0.0.1:5190/');
  await page.waitForFunction(() => window.__SPACE_BOOT__ === 'ready', null, { timeout: 60000 });
  await page.waitForFunction(() => document.querySelector('#loading')?.hidden === true, null, { timeout: 60000 });
  await page.getByRole('button', { name: '进入示例现场' }).first().click();
  await page.waitForSelector('form[data-form=demo-entry]');
  await page.check('form[data-form=demo-entry] input[name=consent]');
  await page.waitForSelector('form[data-form=demo-entry] button[type=submit]:not([disabled])');
  await page.click('form[data-form=demo-entry] button[type=submit]');
  await page.waitForFunction(() => (window.__SPACE_EVENT_QA__?.()?.members || []).length > 1, null, { timeout: 30000 });
  await new Promise(r => setTimeout(r, 2500));
  const info = await page.evaluate(() => {
    const world = document.querySelector('#world').getBoundingClientRect();
    const tags = [...document.querySelectorAll('#hotspots .hotspot')].map(e => { const r = e.getBoundingClientRect(); return { text: (e.textContent || '').trim().slice(0, 20), x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), hidden: e.hidden }; });
    const panels = [...document.querySelectorAll('.presence, #panel, .demo-tour, [class*=tour], .hero')].map(e => { const r = e.getBoundingClientRect(); return { cls: String(e.className).slice(0, 40), id: e.id, x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height), hidden: e.hidden }; });
    return { world: [world.left, world.top, world.width, world.height].map(Math.round), members: window.__SPACE_EVENT_QA__().members, tags, panels };
  });
  console.log(JSON.stringify({ world: info.world, tags: info.tags, presence: info.panels[0] }));
  await browser.close();
})();
