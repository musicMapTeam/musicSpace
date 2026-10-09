// build-manifest.mjs : manifest.json for map-rc2 (and H1-host-rc2) from the take logs, the QC reports and the stills.
//   node build-manifest.mjs map | host
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const mode = process.argv[2];
const sha = f => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const sec = f => +(f / 60).toFixed(3);
const BUILD = JSON.parse(fs.readFileSync('/tmp/space-final/dist-pages/build.json', 'utf8'));
const build = { path: '/tmp/space-final/dist-pages', version: BUILD.version, commit: BUILD.commit, builtAt: BUILD.builtAt, content: '0.22.0-rc.2 (complete-product copy, Livehouse community, Doodle Music Map)', served: 'scripts/pages/serve-prefix.mjs /tmp/space-final/dist-pages /musicSpace/ 48613 (GitHub Pages emulation, root route /musicSpace/), stopped after capture' };
const rig = {
  browser: 'system Google Chrome (headless), --use-angle=metal --enable-gpu --ignore-gpu-blocklist --enable-gpu-rasterization (real GPU), --force-color-profile=srgb, --hide-scrollbars; locale zh-CN, Asia/Shanghai',
  clock: 'Playwright fake clock from 2026-10-09T22:40:00+08:00 (a Friday night); every captured frame advances virtual time by 16 ms; CSS/WAAPI animations pinned to the same virtual time; Math.random seeded 20261009',
  frames: 'one lossless CDP PNG screenshot per frame -> ffmpeg (libx264 High, CRF 15, preset slow, tune animation, yuv420p, BT.709 primaries/transfer/matrix, limited range, 60 fps CFR, +faststart, no audio); the desktop 1920x1080 copy is a Lanczos downscale of the same lossless frames in the same ffmpeg pass (not of the H.264 master)',
  speed: 'virtual time advances 16 ms per frame and the files are 60 fps: playback is 4 % slower than real time (62.5 -> 60), as in every clip of this rig; all times here are video times (frame / 60)',
  taps: 'no cursor; each UI tap shows the rig\'s doodle tap ring (yellow ring, ink outline, pink offset; 30 frames from the press; the DOM click fires 3 frames after the ring, 9 frames for 「音乐探索」); in the map the ring is a top-layer popover so it also shows over the map\'s modal papers',
  beat: 'taps on a 123 BPM grid (Flipping In; 29.268 frames per beat): see the grid marks',
};

function mapRecording(id, notes) {
  const tj = `/tmp/space-video-doodle/prod/capture/map-rc2/logs/${id}.take.json`;
  const t = JSON.parse(fs.readFileSync(tj, 'utf8'));
  const qcf = `/tmp/space-video-doodle/prod/capture/map-rc2/qc/${id}.qc.json`;
  const qc = fs.existsSync(qcf) ? JSON.parse(fs.readFileSync(qcf, 'utf8')) : [];
  const files = {};
  for (const [k, f] of Object.entries(t.files)) if (f && fs.existsSync(f)) files[k] = { file: f, bytes: fs.statSync(f).size, sha256: sha(f) };
  const actions = [
    ...t.marks.map(m => ({ t: m.t ?? sec(m.frame), frame: m.frame, kind: m.type || 'mark', what: m.label, ...(m.boxes ? { boxes_master_px: m.boxes } : {}), ...(m.rate ? { rate: m.rate } : {}) })),
    ...t.events.map(e => ({ t: e.t ?? sec(e.frame), frame: e.frame, kind: e.type, what: e.label, ...(e.type === 'tap' ? { xy_master_px: [e.x, e.y], box_master_px: e.box, clickFrame: e.clickFrame, onBeat: e.onBeat } : {}), ...(e.type === 'scroll' ? { axis: e.axis, from: e.from, to: e.to, frames: e.frames, snap: e.snap } : {}), ...(e.type === 'state' ? { waitedFrames: e.waited } : {}) })),
  ].sort((a, b) => a.frame - b.frame || (a.kind === 'grid' ? -1 : 0));
  return {
    id, files, frames: t.frames, seconds: t.seconds, viewport: t.viewport, notes,
    dup_exact: t.dup, wall_seconds: t.wall_seconds, msPerFrame: t.msPerFrame, font_waits: t.fontWaits || [],
    text_guard: t.guards.map(g => ({ at: g.label, t: g.t, hits: g.hits.length })),
    warnings: t.warnings, page_errors: t.errors, console: t.console,
    qc: qc.map(q => ({ file: q.file, video: q.video, colour: q.colour, duration_s: q.duration_s, frames: q.frames, same_frame_count_as_rig: q.same_count, MB: q.MB, bitrate_mbps: q.bitrate_mbps, audio_streams: q.audio_streams, longest_still: q.longest_still, still_over_1s: q.still_over_1s, motion_windows: q.motion_windows.length, motion_windows_bad: q.motion_windows.filter(w => !w.ok).map(w => [w.kind, w.label, w.longestRepeat]), exact_repeat_runs_over_9f: q.exact_repeat_runs_over_9f })),
    ...(t.cams && t.cams.length ? { push: { frames: [t.cams[0][0], t.cams[t.cams.length - 1][0]], seconds: [sec(t.cams[0][0]), sec(t.cams[t.cams.length - 1][0])], start: t.cams[0], end: t.cams[t.cams.length - 1], format: '[frame, cx CSS px, cy CSS px, zoom]' } } : {}),
    actions,
  };
}

if (mode === 'map') {
  const ROOT = '/tmp/space-video-doodle/prod/capture/map-rc2';
  const recs = [];
  const N = {
    'MAP-P1-round': 'phone. Room 「回声现场」 (阿宁 in 失真 with 阿遥, 小满, 北屿 on stage; 林间 arrives later in rc2) -> tap 「音乐探索」 (header) -> hard cut while the page navigates (nothing recorded during the load) -> music-map/#/explore: the record table round 「寻声 · 费玉清 → 邓紫棋，隔着几首歌？」; the scene draws its ink in (0.7 s) while the paper fades in (0.4 s) -> 翻开《千里之外》 (× 周杰伦) -> 「来源」: the paper 共同演唱 周杰伦 × 费玉清 · 千里之外 with 来源 open (演唱 周杰伦官方频道 · MV 署名, 访问于 2026-09-27) for ~2.5 s -> × -> 前往 周杰伦 (第 1 步) -> hand swipe to 06 -> 翻开《稻香 / Stay With You》 (× 林俊杰) -> 前往 林俊杰 (第 2 步) -> hand swipe to 04 -> 翻开《手心的蔷薇》 (× 邓紫棋 终点, toast 是邓紫棋！前往即抵达) -> 前往 邓紫棋: 抵达 (toast 抵达邓紫棋！3 步, the closing ceremony turns the table\'s sleeves over) -> 连线歌单 「费玉清 与 邓紫棋，隔着 3 首歌 · 你的路线 3 首 · 一步不绕」 -> 「+ 留下」《千里之外》 -> ✓ 已留下 (the product re-renders the paper: it fades out and in for ~0.3 s right after the tap) -> the setlist scrolls to 《稻香 / Stay With You》, 林俊杰 第 2 站, 《手心的蔷薇》, 邓紫棋 终点.',
    'MAP-D1-round': 'desktop, same action as MAP-P1-round on the 1440x810 CSS layout (table centre, hand at the bottom, papers on the right).',
    'MAP-P2-courtyard': 'phone. music-map 小院 opened fresh with the clock paused from the start: the first frame is the scene\'s first frame (no ink), the ink draws in and the title/paper come in -> ~8 s untouched courtyard (idle petals, spinning record, 7 Hz ink boil; usable for an edit push) -> tap the 「唱片店」 pin: the product\'s own camera flight into the record shop, filmed at 1/3 speed (Date.now warp on GSAP; natural speed ~0.4 s) -> the record table (round untouched) -> tap 「小院」: the flight back out over the roof at 1/3 speed -> the courtyard.',
    'MAP-D2-courtyard': 'desktop, same action as MAP-P2-courtyard (courtyard on the right of the frame, the paper 「从喜欢，走向未知。 / 今天，从谁开始？」 on the left).',
    'MAP-P3-push': 'phone. A slow push over the paper courtyard: screen camera (CDP clip zoom, DOM re-rasterised crisp, the WebGL canvas scales as a bitmap), 0.6 s static, then 5.0 s quad in-out to zoom 1.3 on the shop pin, 1.5 s hold; the scene keeps living (petals, record, boil).',
    'MAP-D3-push': 'desktop. A slow push over the paper courtyard: screen camera (CDP clip zoom; DOM re-rasterised crisp, the WebGL canvas scales as its own bitmap: about 1.3x upscale in the 1080 copy at the end), 0.6 s static, then 5.0 s quad in-out to zoom 1.6 on the record shop (end frame CSS x 435..1335, y 227..733: the title, the paper, the header buttons and the bottom nav are out of frame), 1.5 s hold; the scene keeps living (petals, record, ink boil).',
  };
  for (const id of Object.keys(N)) if (fs.existsSync(`${ROOT}/logs/${id}.take.json`)) recs.push(mapRecording(id, N[id]));
  const stills = fs.existsSync(`${ROOT}/stills`) ? fs.readdirSync(`${ROOT}/stills`).filter(f => f.endsWith('.png')).map(f => `${ROOT}/stills/${f}`) : [];
  const manifest = {
    what: 'Music Space film v2 re-capture: the embedded Music Map 「音乐探索」 (Doodle) on the rc2 build — the record table round from the room, its 来源, the next singer, a found song; the paper courtyard (hold, product camera flights in slow motion, a slow push)',
    made: new Date().toISOString(), build, rig: { ...rig, fonts: 'the Doodle faces are sliced by character (font-display: swap); before every grabbed frame the rig forces layout and, if a slice is loading, waits (real time) until it has arrived, so no frame shows a fallback face (fontWaits per recording: frame, ms waited)', map_cadence: 'the map scene redraws at most 30 fps when idle and every frame while its camera moves (its own throttle on the rAF time); the rig\'s rAF warp 1.05 (16.8 ms per frame) reproduces that cadence on the 16 ms fake rAF: idle 3D changes every 2nd frame (product cadence, not a capture freeze), camera moves every frame', navigation: 'the room\'s 「音乐探索」 navigates the page to music-map/#/explore; the rig stops stepping during the load (real time), then re-arms in the new document; the clock carries over; the cut is a hard cut at the tap (frame of the cut in the actions)', slow_motion: 'MAP-x2: the product\'s camera flights are GSAP tweens timed on Date.now; Date.now is warped to 1/3 during the flights (timers, rAF and the ink boil untouched); the GSAP paper fades during the flights are slowed by the same factor. 1/3 is about the limit: GSAP keeps >= 4 ms of its own time between ticks, so slower than ~1/3.8 the camera would only move on every 2nd/3rd frame (a 1/8 test showed exactly that judder and was dropped)' },
    folders: { phone: `${ROOT}/phone`, desktop_master_3840x2160: `${ROOT}/desktop/master`, desktop_edit_1920x1080: `${ROOT}/desktop/1080`, stills: `${ROOT}/stills`, logs: `${ROOT}/logs`, qc: `${ROOT}/qc`, review_sheets: `${ROOT}/review`, tools: `${ROOT}/tools` },
    copy_check: 'before every shot the visible DOM text was searched for 示例 / 虚构 / 本页 (text_guard per recording; the take stops on a hit): 0 hits',
    honesty: 'singer names, songs, versions and 来源 exactly as the product shows them (real duets of its catalogue; 来源 cites 周杰伦官方频道 MV credit); no overlays added; nothing typed into the map',
    recordings: recs, stills,
  };
  fs.writeFileSync(`${ROOT}/manifest.json`, JSON.stringify(manifest, null, 1));
  console.log('wrote', `${ROOT}/manifest.json`, recs.map(r => `${r.id} ${r.seconds}s`).join(', '));
}

if (mode === 'host') {
  const DIR = '/tmp/space-video-doodle/prod/capture/H1-host-rc2';
  const t = JSON.parse(fs.readFileSync(`${DIR}/take.json`, 'utf8'));
  const qc = fs.existsSync(`${DIR}/qc/qc.json`) ? JSON.parse(fs.readFileSync(`${DIR}/qc/qc.json`, 'utf8')) : [];
  const clips = t.clips.map(c => {
    const q = qc.find(q => q.label === c.id) || {};
    const ev = t.events.filter(e => e['f_' + c.id] != null && e.type !== 'key').map(e => ({ t: sec(e['f_' + c.id]), frame: e['f_' + c.id], kind: e.type, what: e.label, ...(e.type === 'tap' ? { xy_px: [e.x, e.y], note: 'frame = mouse up (the ring starts 3 frames earlier)' } : {}), ...(e.type === 'grid' ? { beat0_frame: e['f_' + c.id] } : {}), ...(e.px ? { boxes_px: e.px } : {}) }));
    const keys = t.events.filter(e => e['f_' + c.id] != null && e.type === 'key');
    const typing = []; for (const k of keys) { const name = k.label.replace(/ key .*/, ''); let g = typing.find(x => x.field === name); if (!g) typing.push(g = { field: name, text: '', first: { t: sec(k['f_' + c.id]), frame: k['f_' + c.id] } }); g.text += k.label.slice(k.label.indexOf(' key ') + 5); g.last = { t: sec(k['f_' + c.id]), frame: k['f_' + c.id] }; }
    const grids = t.grids.filter(g => g.clips[c.id] != null).map(g => ({ name: g.name, beat0_frame: g.clips[c.id], beat0_t: sec(g.clips[c.id]), bpm: g.bpm, fpb: g.fpb }));
    return { id: c.id, file: c.file, bytes: c.bytes, sha256: c.file ? sha(c.file) : null, frames: c.frames, seconds: sec(c.frames), what: c.meta.what, feeds_v2: c.meta.feeds, grids, typing, actions: ev, text_guard: t.guards.filter(g => g['f_' + c.id] != null).map(g => ({ at: g.label, t: sec(g['f_' + c.id]), hits: g.hits.length })), qc: { video: q.video, colour: q.colour, duration_s: q.duration_s, frames: q.frames, same_frame_count_as_rig: q.same_count, MB: q.MB, longest_still: q.longest_still, still_over_1s: q.still_over_1s, motion_windows: q.motion_windows?.length, motion_windows_bad: (q.motion_windows || []).filter(w => !w.ok).map(w => [w.kind, w.label, w.longestRepeat]) } };
  });
  const manifest = {
    what: 'Music Space film v2 re-capture: TAKE-H (host / venue side) on the rc2 build — create-room form with 场地 「月台 Livehouse」, the venue\'s 乐迷社群 「月台 Livehouse 乐迷社群」, publishing a 下一场预告; same ids, structure and beat grids as /tmp/space-video-doodle/prod/capture/H1-host (v2)',
    made: new Date().toISOString(), build, rig: { ...rig, script: `${DIR}/take-h-rc2.mjs`, rig_files: `${DIR}/rig/rec2.mjs, ${DIR}/rig/p1lib.mjs (byte copies of ../P1/rig/rec2.mjs and ../P1/p1lib.mjs; p1lib import path adjusted)`, viewport: 'phone CSS 390x845 @ DPR 36/13 = 1080x2340, isMobile, hasTouch' },
    differences_from_v2: [
      'all copy is the rc2 product copy: entry 「我是 Livehouse / 主办方，开个房」 -> 「开一个房间」; sheet eyebrow 「Livehouse / 为这一场开房」; room panel 「Livehouse 乐迷社群」; create form 社群名称 / 「创建社群，向成员展示我的昵称、小人和发言」 / 「创建 Livehouse 乐迷社群」; community menu 「设置与管理 ···」 -> 「下一场预告」; panel 「LIVEHOUSE / 下一场见」, form 「发布下一场预告」 演出名称 / 场地 / 时间 / 给乐迷的话, consent 「发布给社群成员」, button 「发布预告」, card 「下一场预告」 under 「下一场」',
      'the community is named 「月台 Livehouse 乐迷社群」 (v2: 「月台 Livehouse」): the 3D header sign reads 「月台 Livehouse / 乐迷社群」, the chip 「1 位乐迷」; typing runs beats 0..2 (17 characters on 32nds), the tick is on beat 3, 「创建 Livehouse 乐迷社群」 on beat 4, the list entry on beat 4.5 (v2: tick 2, create 3, open 3.5)',
      'H-02 no longer swipes the chip row (v2 hid the old 「Music Map」 chip; rc2 shows 「音乐探索 ↗」 in the room\'s chip row)',
      'H-01 starts after the setup toast 「小人已保存…」 has gone; the consent scroll is quantised to whole CSS px (every captured scroll frame moves)',
      'the new room shows the rc2 first-visit card 「第一次来 1/4 · 放一张今晚的照片 · 用我自己的照片 · 跳过路线」 and the footer 「关于 Music Space」',
    ],
    clips, stills: t.stills, warnings: t.warnings, page_errors: t.errors, font_waits: t.fontWaits || [], fonts: 'before every grabbed frame the take forces layout and waits while a Doodle font slice is loading (font-display: swap), so no frame shows a fallback face; font_waits = [stepped frame, ms waited]',
    copy_check: 'before each clip and at each state the visible DOM text was searched for 示例 / 虚构 / 本页 (the take stops on a hit): 0 hits',
  };
  fs.writeFileSync(`${DIR}/manifest.json`, JSON.stringify(manifest, null, 1));
  console.log('wrote', `${DIR}/manifest.json`, clips.map(c => `${c.id} ${c.seconds}s`).join(', '));
}
