// 10-second pipeline test clips: node test-clips.mjs live|rc4
import { launch, Session, sleep, OUT_FPS } from './rec.mjs';
import fs from 'node:fs';

const which = process.argv[2] || 'rc4';
const OUTDIR = '/tmp/space-video-prep/clips';
fs.mkdirSync(OUTDIR, { recursive: true });
const browser = await launch();
const t0 = Date.now();

if (which === 'live') {
  const s = await Session.open(browser, { url: 'https://musicmapteam.github.io/musicSpace/', name: 'live' });
  await sleep(4000);                       // real-time boot
  await s.freeze();
  s.startRecording(`${OUTDIR}/test-live-courtyard-10s.mp4`);
  await s.hold(2.0);                                         // idle courtyard (lights, camera breathing)
  await s.click('button:has-text("体验示例")', { move: 0.9 }); // real click -> demo route / camera glide
  await s.hold(6.0);
  await s.frames(Math.max(0, 600 - s.frame));      // pad to exactly 10.00 s (600 frames @60)
  const r = await s.stopRecording();
  console.log(JSON.stringify({ clip: 'live', ...r, wall_s: +((Date.now() - t0) / 1000).toFixed(1) }));
  await s.close();
} else {
  // RC4 event room: host creates a room in real time (UI flow), then 10 s of deterministic recording.
  const { hostCreatesRoom } = await import('./flows.mjs');
  const BASE = process.env.SPACE_BASE || 'http://127.0.0.1:8931';
  const s = await Session.open(browser, { url: `${BASE}/event-room/`, name: 'rc4' });
  // use the flows (they take a Playwright page and use real-time sleeps)
  await s.page.waitForFunction(() => /已连接/.test(document.querySelector('#render-status')?.innerText || ''), null, { timeout: 20000 });
  const { sleep: sl } = await import('./lib.mjs');
  await s.page.getByRole('button', { name: '带上小人，进入现场' }).click(); await sl(500);
  await s.page.getByRole('button', { name: /我是主办方/ }).click(); await sl(500);
  await s.page.locator('#panel input[name=name]').fill('阿遥');
  await s.page.getByRole('button', { name: '保存昵称，继续' }).click(); await sl(700);
  await s.page.locator('#panel input[name=title]').fill('返场夜');
  await s.page.locator('#panel input[name=venue]').fill('月台 Livehouse');
  await s.page.locator('#panel input[name=participation][value=open]').check();
  await s.page.locator('#panel input[name=consent]').check();
  await s.page.getByRole('button', { name: '开房并进入现场' }).click(); await sl(2500);
  await s.freeze();
  s.startRecording(`${OUTDIR}/test-rc4-eventroom-10s.mp4`);
  await s.hold(1.0);
  await s.click('nav.camera-nav button[data-view=photos]', { move: 0.8 });
  await s.hold(1.4);
  await s.click('nav.camera-nav button[data-view=person]', { move: 0.6 });
  await s.hold(1.6);
  await s.click('nav.camera-nav button[data-view=overview]', { move: 0.6 });
  await s.hold(2.2);
  await s.frames(Math.max(0, 600 - s.frame));      // pad to exactly 10.00 s (600 frames @60)
  const r = await s.stopRecording();
  console.log(JSON.stringify({ clip: 'rc4', ...r, wall_s: +((Date.now() - t0) / 1000).toFixed(1) }));
  await s.close();
}
await browser.close();
