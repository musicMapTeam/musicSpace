#!/usr/bin/env node
// assemble.mjs : timeline.json -> final MP4 (H.264 yuv420p, 1920x1080, AAC 48k) with burned-in Chinese captions, music, optional SFX.
//
// usage:  node assemble.mjs timeline.json [--animatic] [--scale 0.5] [--fps 30] [--out file.mp4] [--only S05,S06] [--dry]
//   --rehearsal: same as --animatic (fallbacks + status tags) but full resolution / quality: a watchable cut of whatever exists, clearly tagged
//   --animatic : missing clips fall back to `fallback` (still image) or an auto-generated slate; every shot gets a small status tag; low-res fast preview
//                (use with --scale 0.5 --fps 30).  The same timeline.json drives the real cut: no code change between animatic and final.
//   --music f  : override tl.music.file (loudness is re-measured and normalised to tl.music.target_lufs)
//   --dry      : write the filtergraph + ffmpeg command, do not run
//
// Layouts:  "full" = the clip fills 1920x1080 (title cards, end card);  "band" = the clip is 1920x992 footage on top of an 88 px deep-green caption band
//           (all product footage; captions never cover the UI).  Captions: style "band" (inside the band), "glass"/"note" (floating, for full shots).
// Timing:   `dur` of each shot is its DESIGNED slot.  Transitions overlap the next shot's head with this shot's tail, so each shot is extended by the next
//           transition's length internally -> shot k always starts at the sum of the designed durations before it (captions/music cues stay aligned).
//
// Why PNG captions?  The Homebrew ffmpeg here has no libass / freetype (no `subtitles`, `ass`, `drawtext`); Chrome (PingFang SC, product style) renders
// transparent PNGs (render-subs.mjs) which are composited with overlay + alpha fades.
import fs from 'node:fs';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';

const args = process.argv.slice(2);
const tlFile = args.find(a => !a.startsWith('--') && a.endsWith('.json'));
const flag = n => args.includes('--' + n);
const opt = (n, d) => { const i = args.indexOf('--' + n); return i >= 0 ? args[i + 1] : d; };
if (!tlFile) { console.error('usage: node assemble.mjs timeline.json [--animatic] [--scale s] [--fps n] [--out f] [--only ids] [--dry]'); process.exit(2); }
const ROOT = path.dirname(path.resolve(tlFile));
const tl = JSON.parse(fs.readFileSync(tlFile, 'utf8'));
const rehearsal = flag('rehearsal');                               // --rehearsal : full-quality render that tolerates missing clips (slates/stills) and keeps the status tags, so it can never be mistaken for the final
const animatic = flag('animatic') || rehearsal;                    // tags + fallbacks for missing shots
const fastEncode = flag('animatic') && !rehearsal;
const scale = Number(opt('scale', 1));
const FPS = Number(opt('fps', tl.fps || 60));
const even = x => Math.round(x / 2) * 2;
const W = even((tl.size?.[0] || 1920) * scale), H = even((tl.size?.[1] || 1080) * scale);
const HB = even(H * 992 / 1080);                                  // footage height in "band" layout
const BAND = tl.band_color || '#182d26';
const outFile = path.resolve(opt('out', tl.output || path.join(ROOT, 'out', 'space-final.mp4')));
const musicOverride = opt('music', null);                         // --music file.wav : swap the soundtrack without editing the timeline (e.g. a CC0 candidate)
const only = opt('only', '') ? new Set(opt('only', '').split(',')) : null;
const R = p => (p && !path.isAbsolute(p)) ? path.resolve(ROOT, p) : p;
fs.mkdirSync(path.dirname(outFile), { recursive: true });
const work = path.join(ROOT, tl.workdir || 'work'); fs.mkdirSync(work, { recursive: true });   // tl.workdir: keep two timelines (Route B / Plan A) from sharing scratch files
const probe = f => Number(spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', f]).stdout.toString()) || 0;
const sh = (cmd, a) => spawnSync(cmd, a, { encoding: 'utf8', maxBuffer: 1 << 28 });

// ---------- 1. resolve shots (+ slates for missing ones in animatic mode) ----------
async function slate(shot) {
  const f = path.join(work, `slate-${shot.id}.png`);
  if (fs.existsSync(f)) return f;
  const { chromium } = await import('/tmp/space-video-prep/tools/node_modules/playwright-core/index.mjs');
  const b = await chromium.launch({ channel: 'chrome', headless: true });
  const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
  const esc = s => String(s || '').replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  await p.setContent(`<!doctype html><meta charset=utf-8><body style="margin:0;width:1920px;height:1080px;background:#182d26;color:#f0e9d8;font-family:'PingFang SC',sans-serif;display:grid;place-items:center">
   <div style="width:1500px;border:3px dashed rgba(219,232,115,.7);padding:70px 90px"><div style="font:600 30px ui-monospace,Menlo,monospace;letter-spacing:.2em;color:#dbe873">SHOT ${esc(shot.id)} · TO CAPTURE</div>
   <div style="font-size:64px;font-weight:600;margin:28px 0 22px;line-height:1.3">${esc(shot.title || shot.id)}</div>
   <div style="font-size:34px;line-height:1.6;color:rgba(240,233,216,.85)">${esc(shot.note || '')}</div>
   <div style="margin-top:40px;font:24px ui-monospace,Menlo,monospace;color:rgba(240,233,216,.6)">${esc(shot.mode || '')}</div></div>`);
  await p.screenshot({ path: f }); await b.close();
  return f;
}
const shots = [];
for (const s of tl.shots) {
  if (only && !only.has(s.id)) continue;
  let kind = s.kind || 'clip', src = R(s.src), status = s.status || 'FINAL';
  if (kind === 'clip' && !(src && fs.existsSync(src))) {
    if (!animatic) { console.error(`MISSING clip for ${s.id}: ${src}`); process.exit(1); }
    if (s.fallback && fs.existsSync(R(s.fallback))) { kind = 'still'; src = R(s.fallback); status = 'STILL (not captured yet)'; }
    else { kind = 'still'; src = await slate(s); status = 'SLATE (to capture)'; }
  }
  if (kind === 'still' && !(src && fs.existsSync(src))) { src = await slate(s); status = 'SLATE (to capture)'; }
  shots.push({ ...s, kind, src, status, layout: s.layout || (kind === 'slate' ? 'full' : (s.footage === false ? 'full' : 'band')) });
}
// ---------- 2. durations / transitions ----------
const tr = shots.map((s, k) => k === 0 ? { type: 'cut', dur: 0 } : (s.transition_in || { type: 'cut', dur: 0 }));
const dTr = tr.map(t => (!t.type || t.type === 'cut') ? 1 / FPS : Math.max(1 / FPS, t.dur || 0.4));
const slot = shots.map(s => s.dur ?? (s.kind === 'clip' ? Math.max(0.1, probe(s.src) / (s.speed || 1) - (s.in || 0)) : 4));
const starts = []; let acc = 0; for (const d of slot) { starts.push(acc); acc += d; }
const TOTAL = acc;

// ---------- 3. input + normalisation chains ----------
const inputs = [], chains = [];
const norm = layout => layout === 'band'
  ? `fps=${FPS},scale=${W}:${HB}:flags=lanczos:force_original_aspect_ratio=decrease,pad=${W}:${H}:(ow-iw)/2:0:color=${BAND},setsar=1,format=yuv420p`
  : `fps=${FPS},scale=${W}:${H}:flags=lanczos:force_original_aspect_ratio=decrease,pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2:color=${BAND},setsar=1,format=yuv420p`;
// "cinema" grade for establishing shots only: warm curves, highlight bloom, soft vignette.  RGB stage first (curves/lutrgb), YUV stage after (eq/vignette) - eq on planar RGB would tint.
const GRADES = {
  cinema: i => `[g${i}in]format=gbrp,split=2[g${i}a][g${i}b];[g${i}a]lutrgb=r='if(gt(val,170),(val-170)*3,0)':g='if(gt(val,170),(val-170)*3,0)':b='if(gt(val,170),(val-170)*3,0)',gblur=sigma=${Math.round(20 * scale)}:steps=2[g${i}bl];[g${i}b]curves=r='0/0 0.5/0.53 1/1':b='0/0 0.5/0.46 1/0.95'[g${i}c];[g${i}c][g${i}bl]blend=all_mode=screen:all_opacity=0.45,format=yuv420p,eq=contrast=1.04:saturation=1.08,vignette=a=PI/3.4[v${i}]`,
};
shots.forEach((s, i) => {
  const eff = slot[i] + (i < shots.length - 1 ? dTr[i + 1] : 0);          // tail extension that the next transition will overlap
  const speed = s.speed || 1;
  const gr = s.grade && GRADES[s.grade];
  const outLabel = gr ? `g${i}in` : `v${i}`;
  if (s.kind === 'clip') {
    inputs.push(['-ss', String(s.in || 0), '-t', String(eff * speed + 2), '-i', s.src]);
    chains.push(`[${i}:v]setpts=(PTS-STARTPTS)/${speed},tpad=stop_mode=clone:stop_duration=30,trim=duration=${eff.toFixed(4)},${norm(s.layout)},setpts=PTS-STARTPTS[${outLabel}]`);
    if (gr) chains.push(gr(i));
  } else {
    const kb = s.kenburns || { from: 1.0, to: 1.05 }, n = Math.max(1, Math.round(eff * FPS));
    inputs.push(['-loop', '1', '-framerate', String(FPS), '-t', String(eff + 0.5), '-i', s.src]);
    // band layout (product footage): the still is fitted into the 992 px footage area and the caption band is padded underneath, exactly like clips
    const oh = s.layout === 'band' ? HB : H, padBand = s.layout === 'band' ? `,pad=${W}:${H}:0:0:color=${BAND}` : '';
    chains.push(`[${i}:v]scale=${Math.round(W * 1.12)}:${Math.round(oh * 1.12)}:force_original_aspect_ratio=increase:flags=bicubic,crop=${Math.round(W * 1.12)}:${Math.round(oh * 1.12)},crop=w='iw/(${kb.from}+(${kb.to}-${kb.from})*n/${n})':h='ih/(${kb.from}+(${kb.to}-${kb.from})*n/${n})':x='(iw-ow)/2':y='(ih-oh)/2',scale=${W}:${oh}:flags=bicubic${padBand},fps=${FPS},trim=duration=${eff.toFixed(4)},format=yuv420p,setsar=1,setpts=PTS-STARTPTS[v${i}]`);
  }
});
// ---------- 4. xfade chain (a 'cut' is a 1-frame fade) ----------
let cur = 'v0'; const xf = [];
for (let k = 1; k < shots.length; k++) {
  const type = (!tr[k].type || tr[k].type === 'cut') ? 'fade' : tr[k].type;
  xf.push(`[${cur}][v${k}]xfade=transition=${type}:duration=${dTr[k].toFixed(4)}:offset=${starts[k].toFixed(4)}[x${k}]`);
  cur = `x${k}`;
}
// ---------- 4b. overlays: alpha .mov graphics (title lockup) or PNG stills (shade), placed on the programme timeline ----------
const ovInputs = [], ovf = []; let ovLast = cur;
(tl.overlays || []).forEach((o, j) => {
  if (only && o.shot && !only.has(o.shot)) return;
  const f = R(o.src); if (!fs.existsSync(f)) { console.warn('overlay missing, skipped:', o.id || f); return; }
  const idx = shots.length + ovInputs.length, st = (o.start ?? 0), d = o.dur ?? 3, fi = o.fade_in ?? 0, fo = o.fade_out ?? 0;
  if (o.kind === 'still') {
    ovInputs.push(['-loop', '1', '-framerate', String(FPS), '-t', String(d + 0.1), '-i', f]);
    ovf.push(`[${idx}:v]scale=${W}:${H},format=rgba${fi ? `,fade=t=in:st=0:d=${fi}:alpha=1` : ''}${fo ? `,fade=t=out:st=${(d - fo).toFixed(3)}:d=${fo}:alpha=1` : ''},setpts=PTS-STARTPTS+${st.toFixed(3)}/TB[ov${j}]`);
  } else {
    ovInputs.push(['-i', f]);
    ovf.push(`[${idx}:v]scale=${W}:${H}:flags=lanczos,format=rgba,setpts=PTS-STARTPTS+${st.toFixed(3)}/TB[ov${j}]`);
  }
  ovf.push(`[${ovLast}][ov${j}]overlay=x=0:y=0:eof_action=pass:format=auto[ovo${j}]`);
  ovLast = `ovo${j}`;
});
cur = ovLast;
// ---------- 5. captions (+ animatic status tags) ----------
const subs = [...(tl.subtitles || [])];
if (animatic) shots.forEach((s, i) => subs.push({ start: starts[i] + 0.05, end: starts[i] + slot[i] - 0.05, text: `${s.id} · ${s.status}`, style: 'shot' }));
const subTl = path.join(work, 'subs-timeline.json');
fs.writeFileSync(subTl, JSON.stringify({ subtitles: subs, theme: tl.theme }));
const subsDir = path.join(work, rehearsal ? 'subs-rehearsal' : animatic ? 'subs-animatic' : 'subs');
const rs = spawnSync('node', [path.join(ROOT, 'render-subs.mjs'), subTl, subsDir, '1'], { stdio: 'inherit' });
if (rs.status !== 0) { console.error('caption render failed'); process.exit(1); }
const subIdx = JSON.parse(fs.readFileSync(path.join(subsDir, 'index.json'), 'utf8'));
const subInputs = [], subf = []; let vlast = cur;
subIdx.forEach((s, j) => {
  if (s.start >= TOTAL) return;
  const end = Math.min(s.end, TOTAL), dur = end - s.start, fi = Math.min(0.22, dur / 3);
  const iidx = shots.length + ovInputs.length + subInputs.length;
  subInputs.push(['-loop', '1', '-framerate', String(FPS), '-t', String(dur + 0.1), '-i', s.file]);
  subf.push(`[${iidx}:v]scale=${W}:${H},format=rgba,fade=t=in:st=0:d=${fi.toFixed(3)}:alpha=1,fade=t=out:st=${(dur - fi).toFixed(3)}:d=${fi.toFixed(3)}:alpha=1,setpts=PTS-STARTPTS+${s.start.toFixed(3)}/TB[c${j}]`);
  subf.push(`[${vlast}][c${j}]overlay=x=0:y=0:eof_action=pass:format=auto[o${j}]`);
  vlast = `o${j}`;
});
// ---------- 6. audio ----------
const aIn = [], aChain = []; let audioLabel = null;
const m = tl.music && musicOverride ? { ...tl.music, file: path.resolve(musicOverride) } : tl.music;
if (m && fs.existsSync(R(m.file))) {
  const mstart = m.start || 0, mdelay = m.delay || 0, mi = shots.length + ovInputs.length + subInputs.length;
  aIn.push(['-ss', String(mstart), '-i', R(m.file)]);
  const meas = sh('ffmpeg', ['-hide_banner', '-nostats', '-ss', String(mstart), '-t', String(TOTAL), '-i', R(m.file), '-af', 'ebur128=peak=true', '-f', 'null', '-']);
  const mm = /Integrated loudness:\s+I:\s+(-?[\d.]+) LUFS/.exec(meas.stderr);
  const gain = (m.target_lufs ?? -16) - (mm ? Number(mm[1]) : -16) + (m.gain_db || 0);
  const fo = m.fade_out ?? 3, fiM = m.fade_in ?? 0.8;
  aChain.push(`[${mi}:a]atrim=duration=${(TOTAL - mdelay).toFixed(3)},asetpts=PTS-STARTPTS,aresample=48000,volume=${gain.toFixed(2)}dB,afade=t=in:st=0:d=${fiM},afade=t=out:st=${(TOTAL - mdelay - fo).toFixed(3)}:d=${fo}${mdelay ? `,adelay=${Math.round(mdelay * 1000)}|${Math.round(mdelay * 1000)}` : ''}[mus]`);
  console.log(`music gain ${gain.toFixed(2)} dB (measured ${mm ? mm[1] : '?'} LUFS over the used part -> target ${m.target_lufs ?? -16})`);
  const sfx = (tl.sfx || []).filter(x => fs.existsSync(R(x.file)));
  sfx.forEach((x, k) => { const si = mi + 1 + k; aIn.push(['-i', R(x.file)]); aChain.push(`[${si}:a]aresample=48000,volume=${x.gain_db ?? -8}dB,adelay=${Math.round(x.at * 1000)}|${Math.round(x.at * 1000)}[sx${k}]`); });
  // optional voice-over (tl.voice = [{file, at, gain_db}]): music ducks under it (sidechain compression), voice is mixed on top
  const voice = (tl.voice || []).filter(v => fs.existsSync(R(v.file)));
  const extra = sfx.map((_, k) => `sx${k}`); let bed = 'mus';
  if (voice.length) {
    voice.forEach((v, k) => { const vi = mi + 1 + sfx.length + k; aIn.push(['-i', R(v.file)]); aChain.push(`[${vi}:a]aresample=48000,volume=${v.gain_db ?? 0}dB,adelay=${Math.round(v.at * 1000)}|${Math.round(v.at * 1000)}[vo${k}]`); });
    aChain.push(`${voice.map((_, k) => `[vo${k}]`).join('')}amix=inputs=${voice.length}:normalize=0:duration=longest[voall]`, `[voall]asplit=2[vosc][vomix]`,
      `[mus][vosc]sidechaincompress=threshold=${tl.duck?.threshold ?? 0.02}:ratio=${tl.duck?.ratio ?? 10}:attack=${tl.duck?.attack_ms ?? 15}:release=${tl.duck?.release_ms ?? 450}:makeup=1[duck]`);
    bed = 'duck'; extra.push('vomix');
  }
  aChain.push(extra.length ? `[${bed}]${extra.map(l => `[${l}]`).join('')}amix=inputs=${1 + extra.length}:normalize=0:duration=first,alimiter=limit=0.84:level=disabled[mix]` : `[${bed}]alimiter=limit=0.84:level=disabled[mix]`);
  audioLabel = 'mix';
}
// ---------- 7. run ----------
const graph = [...chains, ...xf, ...ovf, ...subf, ...aChain].join(';\n');
const gfile = path.join(work, 'filtergraph.txt'); fs.writeFileSync(gfile, graph);
const cmd = ['-y', '-hide_banner', '-loglevel', 'error', '-stats', ...inputs.flat(), ...ovInputs.flat(), ...subInputs.flat(), ...aIn.flat(),
  '-/filter_complex', gfile, '-map', `[${vlast}]`, ...(audioLabel ? ['-map', `[${audioLabel}]`] : []),
  '-t', TOTAL.toFixed(3), '-r', String(FPS),
  '-c:v', 'libx264', '-preset', fastEncode ? 'veryfast' : (tl.preset || 'slow'), '-crf', String(fastEncode ? 25 : (tl.crf ?? 18)), '-pix_fmt', 'yuv420p', '-profile:v', 'high', '-level', '4.2',
  '-x264-params', 'colorprim=bt709:transfer=bt709:colormatrix=bt709:fullrange=off', '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv',
  ...(audioLabel ? ['-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-ac', '2'] : []),
  '-movflags', '+faststart', '-metadata', `title=${tl.title || 'Music Space'}`, outFile];
console.log(`shots ${shots.length}, captions ${subIdx.length}, designed total ${TOTAL.toFixed(2)} s, ${W}x${H}@${FPS} -> ${outFile}`);
fs.writeFileSync(path.join(work, 'ffmpeg-command.txt'), 'ffmpeg ' + cmd.map(a => /[\s;\[\]]/.test(a) ? JSON.stringify(a) : a).join(' ') + '\n');
fs.writeFileSync(path.join(work, 'shot-starts.json'), JSON.stringify(shots.map((s, i) => ({ id: s.id, start: +starts[i].toFixed(3), dur: slot[i], status: s.status })), null, 1));
if (flag('dry')) { console.log('dry run: filtergraph', gfile, ' command', path.join(work, 'ffmpeg-command.txt')); process.exit(0); }
const t0 = Date.now();
const p = spawn('ffmpeg', cmd, { stdio: ['ignore', 'inherit', 'inherit'] });
p.on('close', c => {
  if (c !== 0) { console.error('ffmpeg failed', c); process.exit(c); }
  const st = fs.statSync(outFile);
  console.log(`\ndone in ${((Date.now() - t0) / 1000).toFixed(0)} s: ${(st.size / 1e6).toFixed(1)} MB, ${probe(outFile).toFixed(2)} s`);
});
