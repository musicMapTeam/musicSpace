// Desktop takes for the Music Space Doodle video (SHOTS.md §4 + the desktop spares asked for by the capture brief).
// CSS 1440x810 @ DPR 8/3 -> 3840x2160 master + 1920x1080 Lanczos edit copy, 60 fps, frame-stepped on a fake clock (rig.mjs).
//   node takes.mjs D01 | D02 | D03 | D05 | D06        (D02 also records D04 in the same world, as SHOTS.md TAKE-D4 asks)
// Setup (entering, waiting for the cast, the AI warm-up, uploads that are not part of a take) runs in real time and is not recorded.
// UI taps show the rig's doodle tap ring; camera glides are triggered by a plain element.click() on the product's own button/label
// (no ring: the glide itself is the content).  Glides are recorded with the rAF time-warp 0.5 (the product's own ~1 s move at half
// speed); timers (line boil, the cast's reply delays) are never warped.  Actions that a person does in a row are placed on a
// 123 BPM grid (Flipping In, the working track): see `grid` in each take's rec.json.
import fs from 'node:fs';
import { launch, DESKTOP4K as DESKTOP4K_, DESKTOP1X, killSinks, OUT_FPS, sleep } from './rig.mjs';
import { openApp, enterAsAning, waitForCast, skipTour, viewNow, scrollNow, scrollTo, untilCameraSettled, SEL, qa, OUT, ROOT, CAM_PROBE, DRY, waitModel } from './flow4k.mjs';
const DESKTOP4K = DRY ? DESKTOP1X : DESKTOP4K_;

const BPM = 123;
const STILLS = DRY ? `${ROOT}/dry/stills` : `${ROOT}/stills`;
const which = process.argv[2];

/** beat grid in video frames from the current frame (60 fps output; 123 BPM -> 29.27 frames per beat) */
function grid(s, bpm = BPM) {
  const zero = s.sink.frames, fpb = 3600 / bpm;
  const g = {
    zero, bpm, fpb: +fpb.toFixed(4), beats: [],
    async at(k, label) {
      const target = zero + Math.round(k * fpb); const n = target - s.sink.frames;
      if (n < 0) console.warn(`  grid: beat ${k} (${label}) is ${-n} frames late`); else await s.frames(n);
      g.beats.push({ beat: k, frame: s.sink.frames, t: +(s.sink.frames / OUT_FPS).toFixed(3), label });
      return s.sink.frames;
    },
  };
  return g;
}
/** tap (ring) exactly on a beat of the grid: the ring appears on the beat frame, the DOM click fires 3 frames later (mouseup) */
async function tapAt(s, g, k, locator, label, opts = {}) { await g.at(k, label); return s.click(locator, { pre: 0, post: 0, label, scroll: false, ...opts }); }
/** click a product control without the pointer (no ring, no hover): used to start camera glides */
async function press(s, selector, label) {
  const ok = await s.page.evaluate(sel => { const e = document.querySelector(sel); if (!e) return false; e.click(); return true; }, selector);
  if (!ok) throw new Error('press: missing ' + selector);
  s.events.push({ t: s.sink ? s.sink.frames / OUT_FPS : 0, frame: s.sink ? s.sink.frames : 0, type: 'press (no ring)', label, selector });
}
/** person labels + their anchor dots + approximate figure boxes (master px).  Figure box = anchor dot -> feet, measured on this build's
 *  overview camera (approximate, +-10 px at 1080p; check against the still before drawing tight circles). */
async function people(s) {
  const k = s.dpr;
  return s.page.evaluate(k => [...document.querySelectorAll('#hotspots .hotspot[data-kind=person]')].map(e => {
    const b = e.getBoundingClientRect(), d = e.querySelector('.dot')?.getBoundingClientRect();
    const r = v => Math.round(v * k);
    return { name: e.getAttribute('title'), label: [r(b.left), r(b.top), r(b.width), r(b.height)], dot: d ? [r(d.left + d.width / 2), r(d.top + d.height / 2)] : null };
  }), k);
}
async function still(s, name) { const f = await s.still(`${STILLS}/${name}.png`); console.log('  still', f); return f; }
async function setupRoom(s, { skip = true } = {}) {
  await enterAsAning(s);
  const w = await waitForCast(s); console.log('  cast complete after', w, 'ms');
  if (skip) console.log('  tour skipped', await skipTour(s));
  await s.park(); await sleep(1500);
}
function report(r) { console.log(JSON.stringify({ file: r.file, frames: r.frames, seconds: r.seconds, MB: +(r.bytes / 1e6).toFixed(1), wallPerVideoSecond: r.wallPerVideoSecond, msPerFrame: r.msPerFrame, dup: r.dup, marks: r.marks.map(m => `${m.label}@${m.t}`).join(' '), events: r.events.length })); }

const TAKES = {
  // ---------------------------------------------------------------- D-01 landing (H3 match cut) ----------------------------------------------
  async D01(browser) {
    const s = await openApp(browser, DESKTOP4K, { name: 'D-01' });
    try {
      await s.park(); await sleep(1500);
      const titleLines = await s.page.evaluate(k => { const st = document.querySelector('#presence-title'); const r = document.createRange(); r.selectNodeContents(st); return [...r.getClientRects()].map(b => [b.left, b.top, b.width, b.height].map(v => Math.round(v * k))); }, s.dpr);
      await s.freeze(); await s.step(2);
      await still(s, 'D-01-landing');
      const o = OUT('D-01-landing'); s.startRecording(o.master, o.edit);
      await s.mark('landing', { title: '#presence-title', titleCard: 'section.presence.welcome', captionNote: '.caption-note', enterButton: '#join', leftTitle: 'text=另一个视角', stage3D: 'canvas', footer: '[data-open="about"]', headerPill: 'text=在本页运行' }, { titleLines, note: 'titleLines = the two lines of 「同一刻，另一面。」 (#presence-title) for the H2 -> H3 match cut' });
      await s.hold(8.0);
      await s.mark('end');
      report(await s.stopRecording({ take: 'TAKE-D1', id: 'D-01', storyboard: ['H3'], what: 'landing page, untouched (no pointer); only the product line boil moves (6.7 steps/s on the 3D stage); the push is left to the edit' }));
    } finally { await s.ctx.close(); }
  },

  // ---------------------------------------------------------------- D-02 room hero + D-04 the quiet one ---------------------------------------
  async D02(browser) {
    const s = await openApp(browser, DESKTOP4K, { name: 'D-02' });
    try {
      await setupRoom(s);
      console.log('  room', JSON.stringify(await qa(s)));
      await s.freeze(); await s.step(2);
      s.frameProbe = CAM_PROBE;
      await still(s, 'CUT-01-room-overview');
      let o = OUT('D-02-room-hero'); s.startRecording(o.master, o.edit);
      const roomBoxes = { roomTitle: 'text=回声现场 · 示例场', joined: 'text=位已加入', venue: 'text=Livehouse', presenceCard: 'text=同一晚，各自的视角', songCard: 'text=晚班列车', footer: '[data-open="about"]', nav: 'nav.camera-nav', photosHotspot: '#hotspots .hotspot[data-kind=photos]', world: '#world', headerMusicMap: 'text=音乐探索' };
      await s.mark('overview', roomBoxes, { people: await people(s) });
      await s.hold(8.0);
      // glide 1: overview -> photo wall
      await s.setWarp(0.5); await s.mark('glide-photos-start');
      await press(s, SEL.nav('photos'), '照片墙 (nav)');
      await untilCameraSettled(s, 600); await s.setWarp(1);
      await s.mark('photos', { contextBar: '#context-actions', nav: 'nav.camera-nav' });
      await s.hold(3.0);
      // glide 2: back to the overview
      await s.setWarp(0.5); await s.mark('glide-overview-start');
      await press(s, SEL.nav('overview'), '全景 (nav)');
      await untilCameraSettled(s, 600); await s.setWarp(1);
      await s.mark('overview-2', null, { people: await people(s) });
      await s.hold(2.0);
      // glide 3: close-up of 阿遥·示例 (her own label in the scene)
      await s.setWarp(0.5); await s.mark('glide-yao-start');
      await press(s, '#hotspots .hotspot[data-kind=person][title^="阿遥"]', '阿遥·示例 label');
      await untilCameraSettled(s, 600); await s.setWarp(1);
      await s.mark('yao-close-up', { contextBar: '#context-actions', meetButton: '#context-actions button' });
      await s.hold(3.0);
      // glide 4: back to the overview
      await s.setWarp(0.5); await s.mark('glide-overview2-start');
      await press(s, SEL.nav('overview'), '全景 (nav)');
      await untilCameraSettled(s, 600); await s.setWarp(1);
      await s.mark('overview-3');
      await s.hold(2.0);
      await s.mark('end');
      report(await s.stopRecording({ take: 'TAKE-D2', id: 'D-02', storyboard: ['E4', 'W5', 'H1 (CUT-01)', '+2 glide'], what: 'room overview, all five present (林间 included), route card skipped; 8 s overview hold, then four product camera glides at half speed: wall, overview, 阿遥 close-up, overview', warp: 0.5 }));

      // ---------------- D-04: the quiet one (same world) ----------------
      await s.step(30);
      console.log('  before D-04', JSON.stringify(await qa(s)));
      o = OUT('D-04-linjian-quiet'); s.startRecording(o.master, o.edit);
      await s.mark('overview', null, { people: await people(s) });
      await s.hold(1.0);
      await s.setWarp(0.5); await s.mark('glide-linjian-start');
      await press(s, '#hotspots .hotspot[data-kind=person][title^="林间"]', '林间·示例 label');
      await untilCameraSettled(s, 600); await s.setWarp(1);
      await s.mark('linjian-close-up', { contextBar: '#context-actions', meetButton: '#context-actions button' });
      await s.hold(2.5);
      const g = grid(s);
      await tapAt(s, g, 0, s.page.getByRole('button', { name: '认识一下' }).first(), '认识一下');
      await s.until(() => /TA 选择安静参与/.test(document.querySelector('#panel:not([hidden])')?.innerText || ''), { max: 120 });
      await s.mark('card-in', { card: '#panel', quietLine: 'text=TA 选择安静参与，不接收新招呼', name: '#panel h2' });
      await s.hold(1.2);
      await s.mark('card-settled', { card: '#panel', quietLine: 'text=TA 选择安静参与，不接收新招呼', name: '#panel h2' });
      await s.hold(2.6);
      await s.mark('end');
      await still(s, 'D-04-linjian-card');
      report(await s.stopRecording({ take: 'TAKE-D4', id: 'D-04', storyboard: ['S3'], what: 'overview -> glide (half speed) to the 3D close-up 「林间·示例 · 近景 / 认识一下」 -> tap 认识一下 -> her card 「TA 选择安静参与，不接收新招呼。仍可查看 TA 已分享给本场的照片。」', warp: 0.5, grid: { bpm: g.bpm, zero: g.zero, beats: g.beats } }));
    } finally { await s.ctx.close(); }
  },

  // ---------------------------------------------------------------- D-03 photo wall before / save / after ---------------------------------------
  async D03(browser) {
    const s = await openApp(browser, DESKTOP4K, { name: 'D-03' });
    try {
      await setupRoom(s);
      // no warm-up upload (it would leave the stage sample as a draft in the sheet): wait for the model download instead
      console.log('  model', JSON.stringify(await waitModel(s)));
      await viewNow(s, 'photos');
      await s.park(); await sleep(1500);
      console.log('  wall before', JSON.stringify(await qa(s)));
      await s.freeze(); await s.step(2);
      s.frameProbe = CAM_PROBE;
      await still(s, 'D-03a-wall-4-photos');
      // D-03a: the 3D wall with the cast's 4 photos
      let o = OUT('D-03a-wall-before'); s.startRecording(o.master, o.edit);
      await s.mark('wall-4', { contextBar: '#context-actions', viewPhotos: '#context-actions button' });
      await s.hold(4.0);
      await s.mark('end');
      report(await s.stopRecording({ take: 'TAKE-D3', id: 'D-03a', storyboard: ['A4 36:1'], what: '3D photo wall (photos view) with the four example photos, panel closed' }));
      // D-03s (spare): 放一张 -> 人海 sample -> AI chip -> save -> toast + wall panel; the 3D wall re-frames for five photos
      o = OUT('D-03s-wall-save'); s.startRecording(o.master, o.edit);
      await s.mark('wall-4');
      await s.hold(0.6);
      const g = grid(s);
      await tapAt(s, g, 0, s.page.locator('#context-actions [data-open="upload"]').first(), '放一张');
      await s.until(() => !!document.querySelector('#panel:not([hidden]) [data-sample-photo="sample-crowd"]'), { max: 120 });
      await s.mark('upload-sheet', { panel: '#panel', samples: '[data-sample-photo]' });
      await tapAt(s, g, 4, s.page.locator('[data-sample-photo="sample-crowd"]').first(), '人海 · 示例照片');
      const n0 = s.sink.frames;
      await s.until(() => !!document.querySelector('.moment-ai-tag') && /AI 判断：/.test(document.querySelector('.moment-ai-tag').innerText), { max: 240 });
      await s.mark('ai-chip', { aiTag: '.moment-ai-tag', chips: '[data-moment-viewpoint]', takenAt: 'text=拍摄于' }, { framesAfterTap: s.sink.frames - n0, aiText: await s.page.evaluate(() => document.querySelector('.moment-ai-tag')?.innerText) });
      await s.hold(0.4);
      await scrollTo(s, '.moment-ai-tag', { block: 'center', seconds: 0.7 });
      await s.mark('ai-chip-centred', { aiTag: '.moment-ai-tag', chips: '[data-moment-viewpoint]', hint: 'text=AI 在本机判断' });
      await s.hold(1.2);
      await scrollTo(s, SEL.save, { block: 'end', offset: 24, seconds: 0.8 });
      await tapAt(s, g, 12, s.page.locator(SEL.save), '保存这张照片');
      await s.until(() => !!document.querySelector('[data-moment-badge="other-side"]'), { max: 240 });
      await s.mark('saved-wall-panel', { toast: 'text=已分享给本场成员', panel: '#panel', badge: SEL.badge, groupTime: 'text=21:47' });
      const mv = await s.until(() => !window.__SPACE_EVENT_QA__().camera.moving, { max: 300 });
      await s.mark('camera-settled', null, { framesWaited: mv });
      await s.hold(2.5);
      await s.mark('end');
      await still(s, 'D-03s-saved-wall-panel');
      report(await s.stopRecording({ take: 'TAKE-D3', id: 'D-03s', storyboard: ['A4 (desktop alternative)', 'spare'], what: 'desktop upload of the 人海 sample from the wall: sheet, 「✦ AI 判断：人海」, save, toast 「已分享给本场成员」, wall panel with the badge; the 3D wall re-frames to five photos', grid: { bpm: g.bpm, zero: g.zero, beats: g.beats } }));
      // close the panel off-camera, back to the plain photos view
      await s.page.evaluate(() => document.querySelector('#panel-close')?.click());
      await s.step(60);
      if (!(await s.page.evaluate(() => window.__SPACE_EVENT_QA__().camera.view === 'photos'))) { await press(s, SEL.nav('photos'), 'nav'); await s.step(120); }
      await s.step(60);
      console.log('  wall after', JSON.stringify(await qa(s)));
      await still(s, 'CUT-03-wall-5-photos');
      o = OUT('D-03b-wall-after'); s.startRecording(o.master, o.edit);
      await s.mark('wall-5', { contextBar: '#context-actions', viewPhotos: '#context-actions button' });
      await s.hold(4.0);
      await s.mark('end');
      report(await s.stopRecording({ take: 'TAKE-D3', id: 'D-03b', storyboard: ['A4 36:3', 'H1 (CUT-03)'], what: 'the same photos view after the upload: five photos (yours included, 人海 sample); the product frames five photos wider than four' }));
    } finally { await s.ctx.close(); }
  },

  // ---------------------------------------------------------------- D-03b alone (clean: the save toast has gone) ---------------------------------
  // Same world as D-03 up to the save, done in real time; then the panel is closed and the take waits for the 5 s toast
  // 「已分享给本场成员」 to leave before CUT-03 and the D-03b hold are recorded.
  async D03B(browser) {
    const s = await openApp(browser, DESKTOP4K, { name: 'D-03b' });
    try {
      await setupRoom(s);
      const p = s.page;
      await viewNow(s, 'photos');
      await p.locator('#context-actions [data-open="upload"]').first().click(); await sleep(900);
      await p.locator('[data-sample-photo="sample-crowd"]').first().click();
      await p.waitForFunction(() => /AI 判断：|不确定，请选择/.test(document.querySelector('#panel')?.innerText || ''), null, { timeout: 90000 });
      console.log('  AI:', await p.evaluate(() => document.querySelector('.moment-ai-tag')?.innerText));
      await sleep(500);
      await p.locator(SEL.save).click();
      await p.waitForFunction(sel => !!document.querySelector(sel), SEL.badge, { timeout: 30000 });
      await sleep(800);
      await p.locator(SEL.panelClose).click();
      await p.waitForFunction(() => document.querySelector('#panel')?.hidden, null, { timeout: 15000 });
      await p.waitForFunction(() => !document.querySelector('#toast.visible'), null, { timeout: 15000 });
      if (!(await p.evaluate(() => window.__SPACE_EVENT_QA__().camera.view === 'photos'))) await viewNow(s, 'photos');
      await s.park(); await sleep(1500);
      console.log('  wall after', JSON.stringify(await qa(s)), 'toast visible:', await p.evaluate(() => !!document.querySelector('#toast.visible')));
      await s.freeze(); await s.step(2);
      s.frameProbe = CAM_PROBE;
      await still(s, 'CUT-03-wall-5-photos');
      const o = OUT('D-03b-wall-after'); s.startRecording(o.master, o.edit);
      await s.mark('wall-5', { contextBar: '#context-actions', viewPhotos: '#context-actions button' });
      await s.hold(4.0);
      await s.mark('end');
      report(await s.stopRecording({ take: 'TAKE-D3', id: 'D-03b', storyboard: ['A4 36:3', 'H1 (CUT-03)'], what: 'the photos view after the upload: five photos (yours included, 人海 sample); the product frames five photos wider than four; recorded after the save toast had gone' }));
    } finally { await s.ctx.close(); }
  },

  // ---------------------------------------------------------------- D-05 exchange (desktop spare) ---------------------------------------------
  async D05(browser) {
    const s = await openApp(browser, DESKTOP4K, { name: 'D-05' });
    try {
      await setupRoom(s, { skip: false });       // the upload goes through the route card, so the 3D room behind the panel stays on the overview
      const p = s.page;
      await p.locator(SEL.tourSample('sample-crowd')).click();
      await p.waitForFunction(() => /AI 判断：|不确定，请选择/.test(document.querySelector('#panel')?.innerText || ''), null, { timeout: 90000 });
      console.log('  AI:', await p.evaluate(() => document.querySelector('.moment-ai-tag')?.innerText));
      await sleep(500);
      await p.locator(SEL.save).click();
      await p.waitForFunction(sel => !!document.querySelector(sel), SEL.badge, { timeout: 30000 });
      await p.waitForFunction(() => !document.querySelector('#toast.visible'), null, { timeout: 15000 });   // the save toast lives 5 s
      await sleep(900);
      await scrollNow(s, SEL.badge, { block: 'center', offset: 60 }); await sleep(400);
      await s.park(); await sleep(600);
      console.log('  wall', JSON.stringify(await qa(s)));
      await s.freeze(); await s.step(2);
      const o = OUT('D-05-exchange'); s.startRecording(o.master, o.edit);
      await s.mark('wall-badge', { badge: SEL.badge, offer: SEL.offer, panel: '#panel', reason: 'text=你拍人海' });
      await s.hold(1.5);
      const g = grid(s);
      await tapAt(s, g, 0, p.locator(SEL.offer), '和 TA 交换这个视角');
      await s.until(() => !!document.querySelector('[data-x-send]') && /（推荐）/.test(document.querySelector('select[data-x-choice]')?.selectedOptions?.[0]?.textContent || ''), { max: 300 });
      await s.mark('compose', { pair: '.exchange-pair', intro: 'text=用我拍下的', select: SEL.xChoice, body: '.exchange-body' });
      await g.at(4, 'scroll to the reason');
      await scrollTo(s, SEL.xChoice, { block: 'start', offset: -20, seconds: 0.7 });
      await s.mark('reason', { select: SEL.xChoice, reason: 'text=规则判断，不是 AI。要不要交换', recommended: 'text=推荐 · 同一刻的另一面' });
      await g.at(8, 'scroll to the consent');
      await scrollTo(s, SEL.xSend, { block: 'end', offset: 18, seconds: 0.44 });
      await s.mark('consent', { agreement: 'text=发送后，', consent: 'label:has([data-x-consent])', send: SEL.xSend, fine: '.exchange-fine' });
      await tapAt(s, g, 9, p.locator(SEL.xConsent), '勾选同意');
      await tapAt(s, g, 10, p.locator(SEL.xSend), '把这两张交给对方确认 ↗');
      const t1 = s.sink.frames;
      await s.until(() => !!document.querySelector('.exchange-status'), { max: 200 });
      await s.hold(0.15);
      await scrollTo(s, '.exchange-status', { block: 'start', offset: -24, seconds: 0.6 });
      await s.mark('pending', { status: '.exchange-status', pair: '.exchange-pair', waitingLine: 'text=对方尚未同意' });
      await s.until(() => /交换已接受/.test(document.querySelector('.exchange-status')?.innerText || ''), { max: 900 });
      const waitFrames = s.sink.frames - t1;
      await s.mark('accepted', { status: '.exchange-status', pair: '.exchange-pair', title: 'text=的两张照片' }, { framesAfterSend: waitFrames, secondsAfterSend: +(waitFrames / OUT_FPS).toFixed(3) });
      await s.hold(0.1);
      await scrollTo(s, '.exchange-status', { block: 'start', offset: -24, seconds: 0.5 });
      await s.mark('accepted-top', { status: '.exchange-status', pair: '.exchange-pair' });
      await s.hold(2.4);
      await still(s, 'D-05-exchange-accepted');
      await scrollTo(s, '[data-x-action="revoke"]', { block: 'end', offset: 90, seconds: 1.0 });
      await s.mark('revoke', { agreed: 'text=双方已明确同意', revoke: '[data-x-action="revoke"]', fine: '.exchange-fine' });
      await s.hold(2.5);
      await s.mark('end');
      report(await s.stopRecording({ take: 'TAKE-D5 (desktop spare)', id: 'D-05', storyboard: ['M3-M7 desktop alternative', 'spare'], what: 'wall badge -> 「和 TA 交换这个视角」 -> compose (two polaroids, recommended pick, reason card) -> consent tick -> 「把这两张交给对方确认 ↗」 -> 「等待本人回应」 (the real wait, uncut) -> 「交换已接受」 -> revoke button + fine print', grid: { bpm: g.bpm, zero: g.zero, beats: g.beats } }));
    } finally { await s.ctx.close(); }
  },

  // ---------------------------------------------------------------- D-06 greet + chat with a reply (desktop spare) ------------------------------
  async D06(browser) {
    const s = await openApp(browser, DESKTOP4K, { name: 'D-06' });
    try {
      await setupRoom(s);
      const p = s.page;
      await p.locator(SEL.person('小满')).first().click();
      await sleep(300); await p.waitForFunction(() => !window.__SPACE_EVENT_QA__().camera.moving, null, { timeout: 15000 }); await sleep(500);
      await p.getByRole('button', { name: '认识一下' }).first().click();
      await p.waitForSelector('[data-social-send]', { timeout: 15000 }); await sleep(1200);
      await s.park(); await sleep(400);
      await s.freeze(); await s.step(2);
      const o = OUT('D-06-greet-chat'); s.startRecording(o.master, o.edit);
      await s.mark('person-card', { card: '#panel', greet: '[data-social-send]', rule: 'text=先招个手', name: '#panel h2', contextBar: '#context-actions' });
      await s.hold(1.5);
      const g = grid(s);
      await tapAt(s, g, 0, p.locator('[data-social-send]'), '向 小满·示例 招个手');
      await s.until(() => /招呼已送达|等待本人回应/.test(document.body.innerText), { max: 120 });
      await s.mark('greet-sent', { toast: 'text=招呼已送达', state: 'text=已招手' });
      const t1 = s.sink.frames;
      await s.until(() => /你们已经认识了/.test(document.querySelector('#panel')?.innerText || ''), { max: 900 });
      await s.mark('friends', { eyebrow: 'text=你们已经认识了', chat: '#panel [data-open="chats"]', corner: '#panel [data-open="corners"]', heart: 'header' }, { framesAfterGreet: s.sink.frames - t1, secondsAfterGreet: +((s.sink.frames - t1) / OUT_FPS).toFixed(3) });
      await s.hold(1.6);
      const g2 = grid(s);
      await tapAt(s, g2, 0, p.locator('#panel [data-open="chats"]'), '和 小满·示例 私聊 ↗');
      await s.until(() => !!document.querySelector('.private-chat textarea') && document.querySelector('.private-chat').getBoundingClientRect().width > 0, { max: 120 });
      await s.mark('chat-open', { chat: '.private-chat', messages: '.chat-messages', welcome: 'text=我是示例角色', composer: '.chat-composer' });
      await g2.at(4, 'tap the composer');
      await s.click(p.locator('.private-chat textarea'), { pre: 0, post: 0, label: 'composer', scroll: false });
      const text = '返场那首我在人海里，手都举酸了！';
      for (let i = 0; i < text.length; i++) { await g2.at(5 + i / 4, i === 0 ? 'type (16ths)' : undefined); await p.keyboard.insertText(text[i]); }
      g2.beats = g2.beats.filter(b => b.label);
      await s.mark('typed', { composer: '.chat-composer', textarea: '#chat-text' });
      const sendBeat = Math.ceil(5 + text.length / 4) + 1;
      await tapAt(s, g2, sendBeat, p.locator('.private-chat .chat-composer button[type=submit]'), '发送 ↗');
      await s.until(() => /手都举酸了/.test(document.querySelector('.chat-messages')?.innerText || ''), { max: 120 });
      await s.mark('sent', { mine: 'text=返场那首我在人海里', messages: '.chat-messages' });
      const t2 = s.sink.frames;
      await s.until(() => /今晚的返场太好听了/.test(document.querySelector('.chat-messages')?.innerText || ''), { max: 900 });
      await s.mark('reply', { reply: 'text=今晚的返场太好听了', mine: 'text=返场那首我在人海里', chat: '.private-chat' }, { framesAfterSend: s.sink.frames - t2, secondsAfterSend: +((s.sink.frames - t2) / OUT_FPS).toFixed(3) });
      await s.hold(1.0);
      await s.mark('reply-settled', { reply: 'text=今晚的返场太好听了', mine: 'text=返场那首我在人海里', chat: '.private-chat' });
      await s.hold(2.0);
      await s.mark('end');
      await still(s, 'D-06-chat-reply');
      report(await s.stopRecording({ take: 'TAKE-D6 (desktop spare)', id: 'D-06', storyboard: ['S1-S2 desktop alternative', 'spare'], what: '小满·示例 close-up + card -> 「向 小满·示例 招个手」 -> toast, the real wait (uncut) -> 「你们已经认识了」 -> 「和 小满·示例 私聊 ↗」 -> ONE TO ONE chat: welcome bubbles, typing (16ths), send, the real wait (uncut) -> reply 「今晚的返场太好听了。」', grid: [{ bpm: g.bpm, zero: g.zero, beats: g.beats }, { bpm: g2.bpm, zero: g2.zero, beats: g2.beats }] }));
    } finally { await s.ctx.close(); }
  },
};

if (!TAKES[which]) { console.error('usage: node takes.mjs ' + Object.keys(TAKES).join('|')); process.exit(2); }
const browser = await launch();
const t0 = Date.now();
try { console.log(`== ${which}`); await TAKES[which](browser); }
catch (e) { console.error('FAILED', e); killSinks(); process.exitCode = 1; }
finally { await browser.close(); console.log(`== ${which} done in ${((Date.now() - t0) / 1000).toFixed(0)} s`); }
