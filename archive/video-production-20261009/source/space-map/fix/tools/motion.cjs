// Reduced motion vs normal: is the scene still, do CSS animations run, does travel jump. Plus ?doodle=0.
const { launch, open, audit, ORIGIN, MAP, mkdir } = require('./lib.cjs');
const crypto = require('crypto');
const OUT = mkdir('/tmp/space-map/shots/fix/motion');
const hash = b => crypto.createHash('sha1').update(b).digest('hex').slice(0, 10);
(async () => {
  const browser = await launch();
  for (const [label, extra, query] of [['reduced-phone', { reducedMotion: 'reduce' }, ''], ['normal-phone', {}, ''], ['reduced-desktop', { reducedMotion: 'reduce' }, ''], ['doodle0-desktop', {}, '?doodle=0'], ['doodle0-phone', {}, '?doodle=0']]) {
    const kind = label.endsWith('phone') ? 'phone' : 'desktop';
    const { ctx, page, rec } = await open(browser, kind, extra);
    await page.goto(MAP + query, { waitUntil: 'load' });
    await page.waitForSelector('#sakura-world canvas'); await page.waitForTimeout(5000);
    const canvas = page.locator('#sakura-world canvas');
    const frames = [];
    for (let i = 0; i < 4; i++) { frames.push(hash(await canvas.screenshot())); await page.waitForTimeout(250); }
    const anims = await page.evaluate(() => document.getAnimations().filter(a => a.playState === 'running').map(a => `${a.constructor.name}:${a.animationName || a.transitionProperty || ''}@${a.effect?.target?.className?.toString().split(' ')[0] || a.effect?.target?.tagName}`));
    const style = await page.evaluate(() => document.querySelector('#sakura-world')?.dataset.renderStyle);
    await page.screenshot({ path: `${OUT}/${label}-home.png` });
    // travel to the shop: sample the canvas right after the tap and later
    const pin = page.locator('.world-pin').first();
    if (kind === 'phone') await pin.tap(); else await pin.click();
    await page.waitForTimeout(120);
    const t1 = hash(await canvas.screenshot());
    await page.screenshot({ path: `${OUT}/${label}-travel-120ms.png` });
    await page.waitForTimeout(2500);
    const t2 = hash(await canvas.screenshot());
    await page.waitForTimeout(300);
    const t3 = hash(await canvas.screenshot());
    await page.screenshot({ path: `${OUT}/${label}-shop.png` });
    const anims2 = await page.evaluate(() => document.getAnimations().filter(a => a.playState === 'running').map(a => `${a.constructor.name}:${a.animationName || a.transitionProperty || ''}@${a.effect?.target?.className?.toString().split(' ')[0] || a.effect?.target?.tagName}`));
    // flip a card: is there a turn animation?
    await page.locator('[data-map-action="flip"]').first().click().catch(() => {});
    await page.waitForTimeout(60);
    const anims3 = await page.evaluate(() => document.getAnimations().filter(a => a.playState === 'running').map(a => `${a.constructor.name}:${a.animationName || a.transitionProperty || ''}@${a.effect?.target?.className?.toString().split(' ')[0] || a.effect?.target?.tagName}`));
    if (query) { await page.click('.world-compass [data-world-view="records"], [data-nav="records"]:not(.brand) >> visible=true').catch(() => {}); await page.waitForTimeout(3000); await page.screenshot({ path: `${OUT}/${label}-records.png` }); }
    console.log(label, 'style=' + style, 'home frames', frames.join(','), 'still=' + (new Set(frames).size === 1), '| travel@120ms', t1, 'settled', t2, t3, 'still-after=' + (t2 === t3));
    console.log('   running anims home:', anims.length, anims.slice(0, 8).join(' '), '| shop:', anims2.length, anims2.slice(0, 8).join(' '), '| after flip:', anims3.length, anims3.slice(0, 8).join(' '));
    console.log('   errors', JSON.stringify({ c: rec.console, p: rec.pageerrors, f: rec.failed, b: rec.bad }));
    await ctx.close();
  }
  await browser.close();
})().catch(e => { console.error('FATAL', e); process.exit(1); });
