const { launch, open, audit, ORIGIN, mkdir } = require('./lib.cjs');
const OUT = mkdir('/tmp/space-map/shots/verify/details');
(async () => {
  const browser = await launch();
  const { ctx, page, rec } = await open(browser, 'desktop', { deviceScaleFactor: 2 });
  await page.goto(ORIGIN + '/musicSpace/music-map/#/explore', { waitUntil: 'load' });
  await page.waitForSelector('#sakura-world canvas'); await page.waitForTimeout(4000);
  // reveal the default round
  await page.click('.map-shop-menu > summary'); await page.waitForTimeout(400);
  await page.click('.map-shop-menu [data-map-action="reveal"]'); await page.waitForSelector('dialog[open]');
  await page.click('dialog[open] [data-map-action="reveal-confirm"]'); await page.waitForTimeout(3000);
  const head = page.locator('dialog[open] .map-setlist-head');
  await head.screenshot({ path: `${OUT}/setlist-head.png` });
  const info = await page.evaluate(() => {
    const out = [];
    const f = el => { const s = getComputedStyle(el); return `${s.fontFamily.split(',')[0]} ${s.fontSize} w${s.fontWeight}`; };
    const and = document.querySelector('.map-setlist-head__and'); if (and) out.push(`and: "${and.textContent}" ${f(and)}`);
    for (const el of document.querySelectorAll('dialog[open] *')) {
      const own = [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.nodeValue).join('').trim();
      if (!own) continue;
      const fam = getComputedStyle(el).fontFamily;
      if (/Doodle Digits/.test(fam.split(',')[0]) && /[一-鿿]/.test(own)) out.push(`DIGITS+CJK <${el.tagName.toLowerCase()} class="${el.className}"> "${own}" parent=${el.parentElement.className}`);
    }
    return out;
  });
  console.log(info.join('\n'));
  // scan the whole app for Doodle Digits elements holding CJK text, and Doodle Logo elements holding CJK
  await page.click('dialog[open] [data-map-action="close"]'); await page.waitForTimeout(800);
  await page.locator('[data-map-action="return-roam"]').filter({ visible: true }).first().click(); await page.waitForTimeout(2500);
  await page.locator('.map-network-index > summary').first().click(); await page.waitForTimeout(400);
  await page.locator('.map-network-connection').first().click(); await page.waitForSelector('dialog[open]'); await page.waitForTimeout(800);
  const info2 = await page.evaluate(() => {
    const out = [];
    for (const el of document.querySelectorAll('dialog[open] *')) {
      const own = [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.nodeValue).join('').trim();
      if (!own) continue;
      const fam = getComputedStyle(el).fontFamily.split(',')[0];
      if (/Doodle (Digits|Logo)/.test(fam) && /[一-鿿]/.test(own)) out.push(`${fam} <${el.tagName.toLowerCase()} class="${el.className}"> "${own}" parent=${el.parentElement.tagName}.${el.parentElement.className}`);
    }
    return out;
  });
  console.log(info2.join('\n'));
  const credits = page.locator('dialog[open] details.map-credits > summary').first();
  if (await credits.count()) await credits.screenshot({ path: `${OUT}/credits-summary.png` });
  await ctx.close(); await browser.close();
})().catch(e => { console.error('FATAL', e); process.exit(1); });
