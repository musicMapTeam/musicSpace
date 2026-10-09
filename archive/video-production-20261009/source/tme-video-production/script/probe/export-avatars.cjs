// Exports the illustrated-avatar SVGs from the running build (CUT-10): the three seeded cast members from the after-show chat room
// (exact looks) and the visitor's wardrobe looks (presets 留白 0 and 失真 4, front + quarter). Output: probe/avatars/*.svg
const fs = require('fs');
const L = require('./lib.cjs');
const OUT = '/tmp/space-video-doodle/script/probe/avatars';
fs.mkdirSync(OUT, { recursive: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));
setTimeout(() => { console.error('watchdog'); process.exit(2); }, 280000).unref();
(async () => {
  const browser = await L.launch();
  try {
    const { ctx, page } = await L.open(browser, 'phone');
    await page.locator('#join').click();
    await page.waitForSelector('form[data-form="demo-entry"] button.primary:not([disabled])', { timeout: 60000 });
    await page.locator('form[data-form="demo-entry"] input[name=name]').fill('阿宁');
    await page.locator('form[data-form="demo-entry"] input[name=consent]').check();
    await page.locator('form[data-form="demo-entry"] button.primary').click();
    await page.waitForFunction(() => !document.querySelector('form[data-form="demo-entry"]'), null, { timeout: 60000 });
    await sleep(1500);
    const skip = page.locator('button:visible', { hasText: '跳过路线' });
    if (await skip.count()) await skip.first().click();
    // cast, from the after-show chat room (their exact avatars)
    await page.locator('#scene-details').click(); await sleep(1200);
    await page.locator('#panel [data-open="conversation"]').first().click(); await sleep(2500);
    const join = page.locator('.community-panel form[data-group-join]');
    if (await join.count()) { await join.locator('input[name=consent]').check(); await join.locator('button[type=submit]').click(); await sleep(2500); }
    const cast = await page.evaluate(() => [...document.querySelectorAll('.community-panel article')].map(a => {
      const svg = a.querySelector('svg'); const name = (a.innerText || '').split('\n')[0].trim();
      return svg ? { name, svg: svg.outerHTML } : null;
    }).filter(Boolean));
    const seen = new Set();
    for (const c of cast) {
      const key = c.name.replace(/·示例.*/, '');
      if (seen.has(key)) continue; seen.add(key);
      const file = { '阿遥': 'cast-yao', '小满': 'cast-man', '北屿': 'cast-bei' }[key] || `cast-${seen.size}`;
      fs.writeFileSync(`${OUT}/${file}.svg`, c.svg.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"'));
      console.log('saved', file, c.name);
    }
    for (let i = 0; i < 3; i++) { await page.keyboard.press('Escape').catch(() => {}); await sleep(200); }
    await page.locator('[data-group="close"]').first().click().catch(() => {}); await sleep(800);
    // visitor looks from the wardrobe
    await page.locator('#my-look').click(); await sleep(2000);
    const sum = page.locator('.wardrobe summary', { hasText: '试试组合示例' }).first();
    await sum.scrollIntoViewIfNeeded(); await sum.click(); await sleep(500);
    for (const [preset, name] of [[0, 'liubai'], [4, 'shizhen'], [5, 'maichong']]) {
      const b = page.locator(`[data-preset="${preset}"]`); await b.scrollIntoViewIfNeeded(); await b.click(); await sleep(500);
      for (const angle of ['front', 'quarter']) {
        await page.locator(`[data-angle="${angle}"]`).click(); await sleep(400);
        const svg = await page.evaluate(() => document.querySelector('.wardrobe .wardrobe-figure svg').outerHTML);
        fs.writeFileSync(`${OUT}/look-${preset}-${name}-${angle}.svg`, svg.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"'));
      }
      console.log('saved look', preset, name);
    }
    await ctx.close();
  } finally {
    await browser.close();
  }
})();
