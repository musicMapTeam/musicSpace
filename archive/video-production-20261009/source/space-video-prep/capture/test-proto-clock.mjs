// Does the frame-stepped virtual clock work with an IN-PAGE room service (sql.js + IndexedDB + replaced fetch)?  Uses the lead's prototype site (RC4 UI + in-browser runtime).
// usage: SPACE_BASE=http://127.0.0.1:47931/musicSpace/ node test-proto-clock.mjs
import { launch, Session, sleep, killSinks } from './rec.mjs';
const base = process.env.SPACE_BASE || 'http://127.0.0.1:47931/musicSpace/';
const browser = await launch();
const s = await Session.open(browser, { url: base, name: 'proto' });
const p = s.page;
const errs = []; p.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 160)); });
const t = label => console.log(`[${((Date.now() - T0) / 1000).toFixed(1)}s] ${label}`);
const T0 = Date.now();
await p.waitForFunction(() => /房间服务已连接/.test(document.querySelector('#render-status')?.innerText || ''), null, { timeout: 30000 }); t('connected (real time)');
// ---- real-time setup: host a room through the real UI
await p.getByRole('button', { name: '带上小人，进入现场' }).click(); await sleep(350);
await p.getByRole('button', { name: /我是主办方/ }).click(); await sleep(350);
await p.locator('#panel input[name=name]').fill('阿宁');
await p.getByRole('button', { name: '保存昵称，继续' }).click(); await sleep(600);
await p.locator('#panel input[name=title]').fill('返场夜'); await p.locator('#panel input[name=venue]').fill('月台 Livehouse');
const c = p.locator('#panel input[name=consent]'); if (!(await c.isChecked())) await c.check();
await p.locator('#panel input[name=participation][value=open]').check().catch(() => {});
await p.getByRole('button', { name: '开房并进入现场' }).click(); await sleep(2500); t('room created (real time)');
console.log('url now', p.url());
// ---- frozen, recorded part
await s.hideCursor(); await s.freeze(); await s.directorOn({ k: 5 }); s.startRecording('/tmp/space-video-prep/clips/test-proto-clock.mp4');
await s.hold(1.0); t('held 1s');
await s.showCursor();
const first = p.locator('#room-first-photo, #panel .primary:has-text("放上我的一张")').first();
await s.click(first, { move: 0.7, post: 0.5 }); t('clicked first-photo');
const file = p.locator('#panel input[type=file]');
await s.ready(file, 200);
await file.setInputFiles('/tmp/space-video-prep/photos/pack/demo-stage-2147.jpg'); t('file set');
const ok1 = await s.until(() => !!document.querySelector('#panel .photo-review, #panel img.photo-review') || /保存这张照片/.test(document.body.innerText), { max: 300 }); t('review shown: ' + ok1);
await s.hold(1.0);
await s.click(p.getByRole('button', { name: '保存这张照片' }), { move: 0.6, post: 0.4 }); t('clicked save');
const ok2 = await s.until(() => /已分享|已保存|照片墙|同一晚/.test(document.body.innerText) && !/正在保存/.test(document.body.innerText), { max: 400 }); t('saved: ' + ok2);
await s.hold(2.0);
const r = await s.stopRecording(); console.log(JSON.stringify(r)); console.log('frames', s.frame, 'wall', ((Date.now() - T0) / 1000).toFixed(1), 's; console errors:', errs.slice(0, 5));
await s.still('/tmp/space-video-prep/stills/test-proto-clock-end.png');
await s.close(); await browser.close(); killSinks();
