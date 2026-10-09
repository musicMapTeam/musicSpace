const L = require('./lib.cjs');
L.watchdog(150);
(async () => {
  const b = await L.launch();
  const { page } = await L.open(b, process.argv[2] || 'desktop');
  try {
    const m = () => page.evaluate(() => { const j = document.querySelector('#join'), r = j.getBoundingClientRect(); return [j.textContent, Math.round(r.width), Math.round(r.height), getComputedStyle(j).gridColumnStart + '/' + getComputedStyle(j).gridColumnEnd]; });
    console.log('static label', JSON.stringify(await m()));
    await page.evaluate(() => { document.querySelector('#join').textContent = '带上小人，进入现场'; });
    await L.sleep(200);
    console.log('node label  ', JSON.stringify(await m()));
    await L.shot(page, `v3-node-join-${process.argv[2] || 'desktop'}`, { clip: { x: 900, y: 400, width: 540, height: 400 } });
    // quiet link hover (desktop): the About link in the room panel note
    await L.enter(page);
    await page.click('#room-info'); await L.sleep(900);
    const q = page.locator('#panel .quiet').first();
    await q.hover(); await L.sleep(300);
    console.log('quiet hover', JSON.stringify(await q.evaluate(n => { const cs = getComputedStyle(n); return [n.textContent.trim(), cs.color, cs.textDecorationColor, cs.textDecorationThickness]; })));
    const box = await q.boundingBox();
    await page.screenshot({ path: '/tmp/space-doodle/fix/shell/v3-quiet-hover-desktop.png', clip: { x: box.x - 20, y: box.y - 15, width: box.width + 40, height: box.height + 30 } });
  } catch (e) { console.error('ERR', e.message.split('\n')[0]); }
  await b.close();
})();
