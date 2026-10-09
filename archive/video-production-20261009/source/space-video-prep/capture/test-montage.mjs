// De-risk heavier pages under the virtual clock: Music Map (Three.js record table), wardrobe overlay, my-space panel.
import { launch, Session, sleep, OUT_FPS } from './rec.mjs';
import fs from 'node:fs';
const BASE = process.env.SPACE_BASE || 'http://127.0.0.1:8931';
const OUT = '/tmp/space-video-prep/clips/';
const browser = await launch();
const t0 = Date.now();
// 1) Music Map explore: record 4 s while clicking the "翻开" button and moving the camera via the dock
{
  const s = await Session.open(browser, { url: `${BASE}/music-map/#/explore`, name: 'map' });
  await sleep(4500);
  await s.freeze();
  s.startRecording(OUT + 'test-musicmap-4s.mp4');
  await s.hold(1.0);
  await s.click('button:has-text("翻开")', { move: 0.8 });
  await s.hold(2.2);
  const r = await s.stopRecording();
  console.log(JSON.stringify({ clip: 'musicmap', ...r, wall_s: +((Date.now() - t0) / 1000).toFixed(1) }));
  await s.close();
}
// 2) Wardrobe: host room then open wardrobe, switch hairstyle and a garment colour
{
  const s = await Session.open(browser, { url: `${BASE}/event-room/`, name: 'wardrobe' });
  await s.page.waitForFunction(() => /已连接/.test(document.querySelector('#render-status')?.innerText || ''), null, { timeout: 20000 });
  const p = s.page;
  await p.getByRole('button', { name: '带上小人，进入现场' }).click(); await sleep(400);
  await p.getByRole('button', { name: /我是主办方/ }).click(); await sleep(400);
  await p.locator('#panel input[name=name]').fill('阿遥');
  await p.getByRole('button', { name: '保存昵称，继续' }).click(); await sleep(700);
  await p.locator('#panel input[name=title]').fill('返场夜'); await p.locator('#panel input[name=venue]').fill('月台 Livehouse');
  await p.locator('#panel input[name=participation][value=open]').check(); await p.locator('#panel input[name=consent]').check();
  await p.getByRole('button', { name: '开房并进入现场' }).click(); await sleep(2500);
  await s.freeze();
  s.startRecording(OUT + 'test-wardrobe-6s.mp4');
  await s.hold(0.5);
  await s.click('#my-look', { move: 0.8 });
  await s.hold(1.2);
  await s.click('.wardrobe button:has-text("高马尾")', { move: 0.7 });
  await s.hold(0.8);
  await s.click('.wardrobe button:has-text("眼镜")', { move: 0.5 });
  await s.hold(0.4);
  await s.click('.wardrobe button:has-text("厚方框")', { move: 0.5 });
  await s.hold(1.0);
  const r = await s.stopRecording();
  console.log(JSON.stringify({ clip: 'wardrobe', ...r, wall_s: +((Date.now() - t0) / 1000).toFixed(1) }));
  await s.close();
}
await browser.close();
