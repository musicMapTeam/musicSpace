// explore: what does the RC4 room look like full-bleed (cinematic.css) in each camera view, with 3 guests present?
import fs from 'node:fs';
import { launch, Session, sleep } from './rec.mjs';
import { startServer, hostRoom, guestRoom, uploadReal, PHOTO, dress } from './world.mjs';
const css = fs.readFileSync(new URL('./cinematic.css', import.meta.url), 'utf8');
const server = await startServer();
const browser = await launch();
try {
  const A = await hostRoom(browser, server.base, { name: '阿遥', session: { width: 1920, height: 1080, dpr: 1, cursor: false } });
  const guests = [];
  let k = 1;
  for (const [n, f] of [['小满', PHOTO.crowd], ['北屿', PHOTO.stage], ['Lin', null]]) {
    const g = await guestRoom(browser, server.base, A.room, { name: n, session: { width: 1000, height: 700 } });
    await dress(g, k++ + 1);
    if (f) await uploadReal(g, f);
    guests.push(g);
  }
  await dress(A, 0);
  await uploadReal(A, PHOTO.stage);
  await sleep(6000);
  const P = A.page;
  const x = P.locator('#panel-close'); if (await x.isVisible().catch(() => false)) await x.click();
  await sleep(2500);
  await A.addCss(css); await sleep(1500);
  await A.still('/tmp/space-video-prep/stills/hook/ov.png');
  const hs = await P.locator('.hotspot').evaluateAll(els => els.map(e => ({ cls: e.className, text: e.textContent.trim(), kind: e.dataset.kind, target: e.dataset.sceneTarget })));
  console.log(JSON.stringify(hs));
  // the camera nav buttons are hidden by css; use evaluate click
  for (const n of ['阿遥', '小满', '北屿', 'Lin']) {
    await P.evaluate(n => [...document.querySelectorAll('.hotspot')].find(e => e.textContent.includes(n)).click(), n);
    await sleep(2200);
    await A.still(`/tmp/space-video-prep/stills/hook/person-${n}.png`);
  }
  await P.evaluate(() => document.querySelector('.hotspot.photo').click()); await sleep(2200);
  await A.still('/tmp/space-video-prep/stills/hook/photos.png');
  await P.evaluate(() => document.querySelector('nav.camera-nav button[data-view=overview]').click()); await sleep(2200);
  await A.still('/tmp/space-video-prep/stills/hook/overview2.png');
  for (const g of guests) await g.close();
  await A.close();
} finally { await browser.close(); await server.stop(); }
