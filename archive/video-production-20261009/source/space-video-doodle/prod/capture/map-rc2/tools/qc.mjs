// qc.mjs : frame-level QC of the map-rc2 and H1-host-rc2 clips (Node only: no numpy on this machine).
//   node qc.mjs map <take.json> [...]     map-rc2 takes (logs/<id>.take.json; continuous masters with marks/events)
//   node qc.mjs host <take.json>          H1-host-rc2 take (clips H-01..03 fed from one stepped world)
// For each file: container facts (ffprobe: codec/profile/size/fps/pix_fmt/colour/duration/frames), lossless-source duplicate runs (PNG md5
// recorded by the rig, exact), decoded picture change on a grey proxy (mean |dI|), still spans, stutters (a still frame between moving
// frames), and "motion windows": the frames where something must move (each tap ring = 30 frames, scrolls, camera flights, typing) are
// checked for repeated frames.  Sample frames for eyeballing are written by sheet.sh, not here.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const FF = '/opt/homebrew/bin/ffmpeg', FP = '/opt/homebrew/bin/ffprobe', FPS = 60;
const STILL = 0.12;         // mean |dI| (8-bit grey proxy) below this = no visible change
const MOV = 0.5;

function probe(file) {
  const r = spawnSync(FP, ['-v', 'error', '-count_frames', '-show_streams', '-show_format', '-of', 'json', file], { encoding: 'utf8', maxBuffer: 64 << 20 });
  const j = JSON.parse(r.stdout);
  const v = j.streams.find(s => s.codec_type === 'video');
  return { file, bytes: +j.format.size, MB: +(j.format.size / 1e6).toFixed(1), duration_s: +(+j.format.duration).toFixed(3), video: `${v.codec_name} ${v.profile} ${v.width}x${v.height} ${v.r_frame_rate} ${v.pix_fmt}`, colour: `${v.color_space}/${v.color_primaries}/${v.color_transfer}/${v.color_range}`, frames: +(v.nb_read_frames || v.nb_frames || 0), bitrate_mbps: +((+j.format.bit_rate) / 1e6).toFixed(1), audio_streams: j.streams.filter(s => s.codec_type === 'audio').length };
}
function diffs(file, w, h) {
  const r = spawnSync(FF, ['-v', 'error', '-i', file, '-vf', `scale=${w}:${h}:flags=area,format=gray`, '-f', 'rawvideo', '-'], { maxBuffer: 2 ** 31 - 1 });
  const buf = r.stdout; const n = Math.floor(buf.length / (w * h)); const d = new Float64Array(Math.max(0, n - 1));
  for (let i = 1; i < n; i++) { let s = 0; const a = (i - 1) * w * h, b = i * w * h; for (let k = 0; k < w * h; k++) s += Math.abs(buf[b + k] - buf[a + k]); d[i - 1] = s / (w * h); }
  return { n, d };
}
const runs = mask => { const out = []; let i = 0; while (i < mask.length) { if (mask[i]) { let j = i; while (j < mask.length && mask[j]) j++; out.push([i, j - i]); i = j; } else i++; } return out; };
function hashRuns(hashes) {
  const same = hashes.map((h, i) => i > 0 && h === hashes[i - 1]);
  return runs(same).map(([s, l]) => [s - 1, l + 1]);   // [first frame of the still picture, length incl. first]
}
function analyse({ file, hashes = [], windows = [], label }) {
  const pr = probe(file);
  const portrait = /x(\d+)/.exec(pr.video) && pr.video.includes('1080x2340');
  const [w, h] = portrait ? [135, 292] : [240, 135];
  const { n, d } = diffs(file, w, h);
  const still = [...d].map(x => x < STILL);
  const stillSpans = runs(still).map(([s, l]) => [s + 1, l + 1]);
  const longest = stillSpans.reduce((m, r) => r[1] > m[1] ? r : m, [0, 1]);
  const stutter = []; for (let i = 1; i < d.length - 1; i++) if (still[i] && d[i - 1] > MOV && d[i + 1] > MOV) stutter.push(i + 1);
  // exact duplicates from the lossless frames
  const hr = hashes.length ? hashRuns(hashes) : [];
  const winRep = windows.map(wd => {
    const a = Math.max(0, wd.from), b = Math.min(hashes.length - 1, wd.to);
    let dupe = 0, worst = 1, run = 1;
    for (let i = a + 1; i <= b; i++) { if (hashes[i] === hashes[i - 1]) { dupe++; run++; worst = Math.max(worst, run); } else run = 1; }
    const vis = []; for (let i = a; i < Math.min(b, d.length); i++) vis.push(d[i]);
    return { ...wd, frames: b - a + 1, exactRepeats: dupe, longestRepeat: worst, minChange: vis.length ? +Math.min(...vis).toFixed(3) : null, ok: worst <= (wd.allow || 1) };
  });
  return {
    label, ...pr, frames_decoded: n, frames_rig: hashes.length || null, same_count: hashes.length ? hashes.length === n : null,
    longest_still: { frames: longest[1], at_s: +(longest[0] / FPS).toFixed(3) },
    still_over_1s: stillSpans.filter(r => r[1] >= FPS).map(([s, l]) => `${(s / FPS).toFixed(2)}s+${(l / FPS).toFixed(2)}s`),
    stutters: { count: stutter.length, at_s: stutter.slice(0, 20).map(i => +(i / FPS).toFixed(3)) },
    exact_repeat_runs_over_9f: hr.filter(r => r[1] > 9).map(([s, l]) => `${(s / FPS).toFixed(2)}s+${l}f`),
    exact_unique: hashes.length ? new Set(hashes).size : null,
    motion_windows: winRep, motion_ok: winRep.every(w => w.ok),
  };
}

const mode = process.argv[2];
const out = [];
if (mode === 'map') {
  for (const tj of process.argv.slice(3)) {
    const t = JSON.parse(fs.readFileSync(tj, 'utf8'));
    const windows = [];
    for (const e of t.events || []) {
      if (e.type === 'tap') windows.push({ kind: 'tap ring', label: e.label, from: e.frame, to: e.frame + 22, allow: 1 });   // ring: 30 frames, the last ~6 fade under 8-bit
      if (e.type === 'scroll' && !e.noop && e.frames) windows.push({ kind: 'scroll', label: e.label, from: e.frame, to: e.frame + e.frames - 1, allow: 1 });
    }
    // camera flights: frames where the probe says data-spatial-travelling (index 2); the scene draws every frame while its camera moves
    const pr = t.probe || [];
    const trav = pr.map(p => Array.isArray(p) && p[2] === 1);
    for (const [s0, l] of runs(trav)) windows.push({ kind: 'camera flight', label: `travelling ${l} f`, from: s0 + 1, to: s0 + l - 2, allow: 1 });
    // the screen push (P3/D3): every frame of the push must move
    // (from the first frame where the zoom has moved >= 0.002, i.e. >= ~1 device px at the frame's edge: the ease starts from rest)
    if (t.cams && t.cams.length) { const s0 = t.cams.find(c => c[3] >= 1.002) || t.cams[0]; windows.push({ kind: 'push', label: `push ${t.cams.length} f (moving from f${s0[0]})`, from: s0[0], to: t.cams[t.cams.length - 1][0], allow: 1 }); }
    const files = [t.files.master, t.files.edit].filter(Boolean);
    for (const f of files) out.push(analyse({ file: f, hashes: t.hashes, windows, label: `${t.id} ${f.includes('/1080/') ? 'edit 1080' : 'master'}` }));
  }
} else if (mode === 'host') {
  const t = JSON.parse(fs.readFileSync(process.argv[3], 'utf8'));
  for (const c of t.clips) {
    const windows = [];
    for (const e of t.events) {
      const f = e['f_' + c.id]; if (f == null) continue;
      if (e.type === 'tap') windows.push({ kind: 'tap ring', label: e.label, from: f - 3, to: f + 19, allow: 1 });   // f = mouse up (down + 3)
      if (e.type === 'scroll' && e.frames && e.from !== e.to) windows.push({ kind: 'scroll', label: e.label, from: f, to: f + e.frames - 1, allow: 1 });
      if (e.type === 'key' && !/ $/.test(e.label)) windows.push({ kind: 'key', label: e.label, from: f - 1, to: f, allow: 1 });   // (a typed space shows nothing until the next character)            // the typed character shows in frame f
    }
    out.push(analyse({ file: c.file, hashes: c.hashes || [], windows, label: c.id }));
  }
}
for (const r of out) {
  const bad = r.motion_windows.filter(w => !w.ok);
  console.log(`${r.label}: ${r.video} ${r.colour} ${r.duration_s}s ${r.frames}f (rig ${r.frames_rig}, same ${r.same_count}) ${r.MB} MB ${r.bitrate_mbps} Mb/s audio ${r.audio_streams} | longest still ${r.longest_still.frames}f @${r.longest_still.at_s}s | still>1s ${JSON.stringify(r.still_over_1s)} | stutters ${r.stutters.count} | windows ${r.motion_windows.length} bad ${bad.length}${bad.length ? ' ' + JSON.stringify(bad.map(b => [b.kind, b.label, b.longestRepeat]).slice(0, 8)) : ''}`);
}
const dest = process.env.QC_OUT;
if (dest) { fs.mkdirSync(path.dirname(dest), { recursive: true }); fs.writeFileSync(dest, JSON.stringify(out, null, 1)); }
