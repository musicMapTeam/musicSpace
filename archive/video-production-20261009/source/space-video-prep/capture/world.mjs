// Shared world for shot scripts: ephemeral Node server (fresh DATA_DIR => no rate-limit history), demo photo pack, real-time setup helpers.
import { spawn } from 'node:child_process';
import net from 'node:net';
import fs from 'node:fs';
import path from 'node:path';
import { Session, sleep } from './rec.mjs';

export const REPO = process.env.SPACE_REPO || '/tmp/space-video-prep/repo-rc4';          // built copy (npm ci && npm run build:all) - never the working repo
export const PHOTO = {
  stage: '/tmp/space-video-prep/photos/pack/demo-stage-2147.jpg',      // EXIF 21:47:12, AI verdict: stage (sure)
  crowd: '/tmp/space-video-prep/photos/pack/demo-crowd-2148.jpg',      // EXIF 21:48:03, AI verdict: crowd (sure)
  unsure: '/tmp/space-video-prep/photos/pack/demo-unsure-2150.jpg',    // EXIF 21:50:20, AI verdict: unsure (honest case; 3 min 8 s later = "not the same moment")
};
const freePort = () => new Promise(res => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); }); });

/** Start `node server/index.js` from the built repo copy on a free port with a fresh data dir. Call stop() (also done on process exit). */
export async function startServer({ repo = REPO, base } = {}) {
  if (base) return { base, stop: async () => {} };                      // use an already running static/real server (e.g. SPACE_BASE=http://127.0.0.1:8931)
  const port = await freePort();
  const dataDir = fs.mkdtempSync('/tmp/space-video-prep/data-shot-');
  const p = spawn('node', ['server/index.js'], { cwd: repo, env: { ...process.env, HOST: '127.0.0.1', PORT: String(port), DATA_DIR: dataDir }, stdio: 'ignore' });
  const stop = async () => { try { p.kill('SIGTERM'); } catch {} await sleep(200); fs.rmSync(dataDir, { recursive: true, force: true }); };
  process.on('exit', () => { try { p.kill('SIGKILL'); } catch {} });
  const url = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 60; i++) { try { const r = await fetch(url + '/api/event/health'); if (r.ok) return { base: url, stop }; } catch {} await sleep(150); }
  await stop(); throw new Error('server did not start');
}

export const connected = page => page.waitForFunction(() => /已连接|同场/.test(document.querySelector('#render-status')?.innerText || ''), null, { timeout: 25000 });

/** Real-time (unfrozen) host flow, driven through the real UI. Returns the Session (clock still follows real time). */
export async function hostRoom(browser, base, opts = {}) {
  const { name = '阿遥', title = '返场夜', venue = '月台 Livehouse', song = 'late-train', participation = 'open', session = {} } = opts;
  const s = await Session.open(browser, { url: `${base}/event-room/`, name: 'host', ...session });
  const p = s.page; await connected(p); await sleep(500);
  await p.getByRole('button', { name: '带上小人，进入现场' }).click(); await sleep(350);
  await p.getByRole('button', { name: /我是主办方/ }).click(); await sleep(350);
  await p.locator('#panel input[name=name]').fill(name);
  await p.getByRole('button', { name: '保存昵称，继续' }).click(); await sleep(600);
  await p.locator('#panel input[name=title]').fill(title); await p.locator('#panel input[name=venue]').fill(venue);
  await p.locator('#panel select[name=songId]').selectOption(song);
  await p.locator(`#panel input[name=participation][value=${participation}]`).check();
  const c = p.locator('#panel input[name=consent]'); if (!(await c.isChecked())) await c.check();
  await p.getByRole('button', { name: '开房并进入现场' }).click(); await sleep(2000);
  s.room = new URL(p.url()).search;
  return s;
}
/** Real-time guest join through the invite link. */
export async function guestRoom(browser, base, room, opts = {}) {
  const { name = 'Lin', participation = 'open', session = {} } = opts;
  const s = await Session.open(browser, { url: `${base}/event-room/${room}`, name: 'guest', ...session });
  const p = s.page; await connected(p); await sleep(500);
  await p.getByRole('button', { name: '用默认小人，继续入场' }).click(); await sleep(400);
  await p.locator('#panel input[name=name]').fill(name);
  await p.getByRole('button', { name: '保存昵称，继续' }).click(); await sleep(600);
  await p.locator(`#panel input[name=participation][value=${participation}]`).check();
  const c = p.locator('#panel input[name=consent]'); if (!(await c.isChecked())) await c.check();
  await p.getByRole('button', { name: '我愿意，进入这一场' }).click(); await sleep(1800);
  return s;
}
/** Real-time photo upload (visibility 'members' = on the wall, 'private' = only me). */
export async function uploadReal(s, file, visibility = 'members') {
  const p = s.page;
  await p.locator('#room-first-photo, #panel .primary:has-text("放上我的一张")').first().click(); await sleep(500);
  const up = p.locator('#panel input[type=file]'); if (!(await up.count())) { await p.getByRole('button', { name: '放上我的一张' }).click(); await sleep(500); }
  await p.locator('#panel input[type=file]').setInputFiles(file); await sleep(900);
  await p.locator('#panel select[name=visibility]').selectOption(visibility);
  await p.getByRole('button', { name: '保存这张照片' }).click(); await sleep(1500);
  const x = p.locator('#panel-close'); if (await x.isVisible().catch(() => false)) { await x.click(); await sleep(400); }
}
export const outClip = id => `/tmp/space-video-prep/clips/final/${id}.mp4`;

export const PHONE = { width: 390, height: 844, dpr: 3, cursor: 'touch' };
export const PHONE_SINK = { w: 416, h: 900 };         // composed by assembly/compose-duo.mjs into the two-device split screen

/** Host + guest as phone-size sessions, both in the room, photos uploaded (real time). */
export async function twoPhones(browser, base, { upload = true, names = ['阿遥', 'Lin'] } = {}) {
  const A = await hostRoom(browser, base, { name: names[0], session: PHONE });
  const B = await guestRoom(browser, base, A.room, { name: names[1], session: PHONE });
  if (upload) { await uploadReal(A, PHOTO.stage); await uploadReal(B, PHOTO.crowd); }
  return { A, B };
}
/** Real-time exchange request from A to B's wall photo (no recording). */
export async function sendExchangeReal(A, otherName = 'Lin') {
  const p = A.page;
  await openWallReal(A);
  await p.getByRole('button', { name: /刷新照片/ }).click().catch(() => {}); await sleep(900);
  await p.locator('#panel button.photo-item', { hasText: otherName }).first().click(); await sleep(1200);
  await p.getByRole('button', { name: /用我的照片，交换这个视角/ }).click(); await sleep(1500);
  await p.locator('section.photo-exchanges select').selectOption({ index: 1 }); await sleep(600);
  await p.locator('section.photo-exchanges input[type=checkbox]').check();
  await p.locator('button.exchange-primary').click(); await sleep(1800);
}

/** Real-time: bring the wall list panel up (hotspot -> camera to the wall -> 看照片). */
export async function openWallReal(s) {
  const p = s.page;
  const btn = p.locator('button:has-text("看照片")');
  if (!(await btn.first().isVisible().catch(() => false))) { await p.locator('nav.camera-nav button[data-view=photos]').click(); await sleep(1800); }
  await btn.first().click(); await sleep(1000);
}

/** Real-time: B accepts A's pending request (both on desktop or phone sessions). */
export async function acceptExchangeReal(B) {
  const p = B.page;
  await openWallReal(B).catch(() => {});
  await p.locator('#panel button:has-text("照片交换")').first().click(); await sleep(1400);
  await p.locator('section.photo-exchanges button', { hasText: '阿遥' }).first().click(); await sleep(1500);
  await p.locator('section.photo-exchanges input[type=checkbox]').check();
  await p.locator('button.exchange-primary').click(); await sleep(2200);
}

/** Real-time: open the wardrobe, pick one of the six look presets (留白 断拍 循迹 回声 失真 脉冲 = 0..5) and save.  Gives every guest a distinct illustrated avatar. */
export async function dress(s, preset) {
  const p = s.page;
  await p.locator('#my-look').click(); await sleep(700);
  await p.locator('.wardrobe-examples summary').click(); await sleep(300);
  const b = p.locator(`.wardrobe button[data-preset="${preset}"]`);
  if (!(await b.count())) { console.log('WARN: preset button not found', preset); }
  else { await b.first().click(); await sleep(400); }
  await p.getByRole('button', { name: /保存这个我/ }).click();
  await p.waitForFunction(() => !document.querySelector('.wardrobe') || document.querySelector('.wardrobe')?.hidden, null, { timeout: 15000 }).catch(() => {});
  await sleep(900);
}
