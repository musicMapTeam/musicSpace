// Two-device lockstep proof: A (host) and B (guest) as phone-size sessions on one virtual clock; B joins while A watches; then A sends an exchange request.
import { launch, Session, Duo, sleep, OUT_FPS } from './rec.mjs';
import fs from 'node:fs';
const BASE = process.env.SPACE_BASE || 'http://127.0.0.1:8931';
const OUT = '/tmp/space-video-prep/clips';
const PHONE = { width: 390, height: 844, dpr: 3, cursor: 'touch' };       // 1170 x 2532 shots -> scaled down by ffmpeg (sink w/h set below)
const t0 = Date.now();
const browser = await launch();
const A = await Session.open(browser, { url: `${BASE}/event-room/`, name: 'A', ...PHONE });
await A.page.waitForFunction(() => /已连接/.test(document.querySelector('#render-status')?.innerText || ''), null, { timeout: 20000 });
// A hosts (real time, unfrozen)
await A.page.getByRole('button', { name: '带上小人，进入现场' }).click(); await sleep(400);
await A.page.getByRole('button', { name: /我是主办方/ }).click(); await sleep(400);
await A.page.locator('#panel input[name=name]').fill('阿遥');
await A.page.getByRole('button', { name: '保存昵称，继续' }).click(); await sleep(700);
await A.page.locator('#panel input[name=title]').fill('返场夜');
await A.page.locator('#panel input[name=venue]').fill('月台 Livehouse');
await A.page.locator('#panel input[name=participation][value=open]').check();
await A.page.locator('#panel input[name=consent]').check();
await A.page.getByRole('button', { name: '开房并进入现场' }).click(); await sleep(2200);
const room = new URL(A.page.url()).search;
const B = await Session.open(browser, { url: `${BASE}/event-room/${room}`, name: 'B', ...PHONE });
await B.page.waitForFunction(() => /已连接|同场/.test(document.querySelector('#render-status')?.innerText || ''), null, { timeout: 20000 });
await sleep(1200);
await A.freeze(); await B.freeze();
const duo = new Duo(A, B);          // lockstep: every frame of A or B advances both
// sinks: portrait 1170x2532 -> 480x1038 (fits a 1920x1080 composite with two phones)
const mk = (s, f) => s.startRecording(f, { w: 480, h: 1038 });
mk(A, `${OUT}/test-duo-A.mp4`); mk(B, `${OUT}/test-duo-B.mp4`);
await duo.hold(0.8);
// B joins through the real UI (clicks happen inside the lockstep frames so the cursor and animations are visible on B)
await B.click(B.page.getByRole('button', { name: '用默认小人，继续入场' }), { move: 0.5 });
await duo.hold(0.3);
await B.type(B.page.locator('#panel input[name=name]'), 'Lin', { cps: 6 });
await B.click(B.page.getByRole('button', { name: '保存昵称，继续' }), { move: 0.4 });
await duo.hold(0.4);
await B.page.locator('#panel input[name=participation][value=open]').check();
await B.page.locator('#panel input[name=consent]').check();
await B.click(B.page.getByRole('button', { name: '我愿意，进入这一场' }), { move: 0.5 });
await duo.hold(5.0);      // A's poll (4 s virtual) picks B up and shows the avatar
const [ra, rb] = await duo.stopRecording();
console.log(JSON.stringify({ A: ra, B: rb, wall_s: +((Date.now() - t0) / 1000).toFixed(1) }));
await A.close(); await B.close(); await browser.close();
