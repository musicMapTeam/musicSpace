import { launch, newPage, sleep, ensureDir } from './lib.mjs';
import { hostCreatesRoom, guestJoins, uploadPhoto } from './flows.mjs';
const browser = await launch();
const cfgs = [['1920x1080@1', 1920, 1080, 1], ['1440x810@2.6667', 1440, 810, 3840 / 1440], ['1280x720@3', 1280, 720, 3]];
const A = await newPage(browser, { width: 1440, height: 810, dpr: 3840 / 1440 });
await hostCreatesRoom(A.page, { name: '阿遥', title: '返场夜', venue: '月台 Livehouse' });
const url = A.page.url();
await uploadPhoto(A.page, '/tmp/space-video-prep/repo-rc4/web/assets/stage-scene.png', { visibility: 'room' });
await A.page.locator('#panel-close').click(); await sleep(600);
await A.page.screenshot({ path: '/tmp/space-video-prep/stills/vp-1440-dpr2667-raw.png' });
await A.ctx.close();
for (const [name, w, h, dpr] of cfgs) {
  const B = await newPage(browser, { width: w, height: h, dpr });
  await B.page.goto(url, { waitUntil: 'load' });
  await sleep(2500);
  await B.page.screenshot({ path: `/tmp/space-video-prep/stills/vp-${name}-raw.png` });
  await B.ctx.close();
}
await browser.close();
