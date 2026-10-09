#!/usr/bin/env node
// qc.mjs : automated QC for the competition video (form field 06: <= 3:00, <= 500 MB, no watermark / noise, original & compliant).
// usage: node qc.mjs video.mp4 [--contact]       -> prints a PASS/WARN/FAIL table, writes <video>.qc.json and (with --contact) <video>.qc-contact.png
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';

const f = process.argv[2];
const linkArg = process.argv.indexOf('--link'); const LINK = linkArg > 0 ? process.argv[linkArg + 1] : 'https://musicmapteam.github.io/musicSpace/';
if (!f || !fs.existsSync(f)) { console.error('usage: node qc.mjs video.mp4 [--contact]'); process.exit(2); }
const run = (cmd, a) => spawnSync(cmd, a, { encoding: 'utf8', maxBuffer: 1 << 28 });
const pj = JSON.parse(run('ffprobe', ['-v', 'error', '-show_format', '-show_streams', '-of', 'json', f]).stdout);
const v = pj.streams.find(s => s.codec_type === 'video'), a = pj.streams.find(s => s.codec_type === 'audio');
const dur = Number(pj.format.duration), size = Number(pj.format.size);
const rows = [];
const add = (name, value, status, note = '') => rows.push({ name, value, status, note });

add('Duration', `${dur.toFixed(2)} s (${Math.floor(dur / 60)}:${String(Math.round(dur % 60)).padStart(2, '0')})`, dur <= 175 ? 'PASS' : dur <= 180 ? 'WARN' : 'FAIL', 'limit 3:00 (180 s); aim <= 2:55 so a player rounding cannot exceed it');
add('File size', `${(size / 1e6).toFixed(1)} MB`, size <= 350e6 ? 'PASS' : size <= 500e6 ? 'WARN' : 'FAIL', 'limit 500 MB; <= 350 MB keeps uploads comfortable');
add('Container', pj.format.format_name, /mp4/.test(pj.format.format_name) ? 'PASS' : 'WARN', 'mp4 recommended');
add('Video codec', `${v?.codec_name} ${v?.profile || ''} ${v?.pix_fmt}`, v?.codec_name === 'h264' && v?.pix_fmt === 'yuv420p' ? 'PASS' : 'FAIL', 'H.264 / yuv420p plays everywhere');
add('Resolution', `${v?.width}x${v?.height}`, v?.width === 1920 && v?.height === 1080 ? 'PASS' : 'WARN', '1920x1080 target');
const [n, d] = (v?.avg_frame_rate || '0/1').split('/').map(Number);
add('Frame rate', `${(n / d).toFixed(2)} fps`, [24, 25, 30, 50, 60].some(x => Math.abs(n / d - x) < 0.05) ? 'PASS' : 'WARN', 'constant rate expected');
add('Bitrate', `${(Number(pj.format.bit_rate) / 1e6).toFixed(2)} Mbps`, 'INFO');
add('Color tags', `${v?.color_space || '-'} / ${v?.color_range || '-'} / ${v?.color_transfer || '-'}`, v?.color_space === 'bt709' ? 'PASS' : 'WARN', 'bt709 tv-range expected');
add('Audio', a ? `${a.codec_name} ${a.sample_rate} Hz ${a.channels} ch` : 'none', a && a.codec_name === 'aac' ? 'PASS' : 'FAIL', 'form wants voice-over OR subtitles; here music + burned-in subtitles');

if (a) {
  const e = run('ffmpeg', ['-hide_banner', '-nostats', '-i', f, '-af', 'ebur128=peak=true', '-f', 'null', '-']).stderr;
  const I = Number((/Integrated loudness:\s+I:\s+(-?[\d.]+) LUFS/.exec(e) || [])[1]);
  const LRA = Number((/Loudness range:\s+LRA:\s+([\d.]+) LU/.exec(e) || [])[1]);
  const TP = Number((/True peak:\s+Peak:\s+(-?[\d.]+) dBFS/.exec(e) || [])[1]);
  add('Integrated loudness', `${I} LUFS`, I >= -18 && I <= -14 ? 'PASS' : 'WARN', 'target -16 LUFS (music-only bed; -14..-18 accepted)');
  add('True peak', `${TP} dBFS`, TP <= -1 ? 'PASS' : 'FAIL', '<= -1 dBTP to avoid inter-sample clipping');
  add('Loudness range', `${LRA} LU`, LRA <= 12 ? 'PASS' : 'WARN');
  const sil = run('ffmpeg', ['-hide_banner', '-nostats', '-i', f, '-af', 'silencedetect=n=-50dB:d=0.8', '-f', 'null', '-']).stderr;
  const silences = [...sil.matchAll(/silence_start: ([\d.]+)[\s\S]*?silence_end: ([\d.]+)/g)].map(m => [Number(m[1]), Number(m[2])]);
  const tailSil = /silence_start: ([\d.]+)/g; // trailing silence is expected only in the last 1.5 s
  const bad = silences.filter(([s, e2]) => s > 0.5 && s < dur - 2);
  add('Silent gaps (>0.8 s, -50 dB)', bad.length ? JSON.stringify(bad) : 'none', bad.length ? 'WARN' : 'PASS', 'unexpected dead air / noise gate');
}
const bl = run('ffmpeg', ['-hide_banner', '-nostats', '-i', f, '-vf', 'blackdetect=d=0.4:pix_th=0.06', '-an', '-f', 'null', '-']).stderr;
const blacks = [...bl.matchAll(/black_start:([\d.]+) black_end:([\d.]+)/g)].map(m => [Number(m[1]), Number(m[2])]).filter(([s]) => s > 0.4 && s < dur - 1.0);
add('Black frames (>0.4 s inside)', blacks.length ? JSON.stringify(blacks) : 'none', blacks.length ? 'WARN' : 'PASS', 'accidental black gaps between shots');
const fz = run('ffmpeg', ['-hide_banner', '-nostats', '-i', f, '-vf', 'freezedetect=n=-55dB:d=3', '-an', '-f', 'null', '-']).stderr;
const freezes = [...fz.matchAll(/freeze_start: ([\d.]+)[\s\S]*?freeze_duration: ([\d.]+)/g)].map(m => [Number(m[1]), Number(m[2])]);
add('Frozen picture (>3 s)', freezes.length ? JSON.stringify(freezes.map(([s, dd]) => `${s.toFixed(1)}s +${dd.toFixed(1)}s`)) : 'none', freezes.length ? 'WARN' : 'PASS', 'holds >3 s are expected only on the end card; anything else = stuck recording');
// end-card QR must decode to the judged link (sample 2 s before the end; the card holds still there)
{
  const png = `/tmp/_qc_qr_${process.pid}.png`;
  run('ffmpeg', ['-y', '-v', 'error', '-ss', String(Math.max(0, dur - 2.5)), '-i', f, '-frames:v', '1', png]);
  const r = run('node', [new URL('./decode-qr.mjs', import.meta.url).pathname, png]);
  const got = (r.stdout || '').trim();
  add('End-card QR', got || 'not found', got === LINK ? 'PASS' : 'FAIL', `must decode to ${LINK}`);
  try { fs.unlinkSync(png); } catch {}
}
{
  const h = run('shasum', ['-a', '256', f]).stdout.split(' ')[0];
  add('SHA-256', h.slice(0, 16) + '…', 'INFO', h);
}
add('Watermark / overlays', 'manual', 'MANUAL', 'open the contact sheet: no browser chrome, no Playwright/Tabbit tray, no recorder logos, no third-party marks. Our pipeline adds none.');
add('Music provenance', 'manual', 'MANUAL', 'music/*/LICENCE-PROOF.md present for the chosen track (or original generated score); no commercial recording, no lyrics.');
add('Subtitles legible', 'manual', 'MANUAL', 'play at 100 % on a phone-size window: every caption readable, none over a control that matters, none cut off.');
add('Disclosure', 'manual', 'MANUAL', '"示例角色、场次与照片均为虚构（AI 生成）" visible; no claim of real-phone/real-audience validation; AI described as on-device viewpoint suggestion only.');

if (process.argv.includes('--contact')) {
  const out = f.replace(/\.mp4$/, '') + '.qc-contact.png';
  run('ffmpeg', ['-y', '-v', 'error', '-i', f, '-vf', `fps=${(24 / dur).toFixed(5)},scale=480:-1,tile=6x4`, '-frames:v', '1', out]);
  add('Contact sheet', out, 'INFO');
}
const W = Math.max(...rows.map(r => r.name.length));
for (const r of rows) console.log(`${r.status.padEnd(6)} ${r.name.padEnd(W)}  ${String(r.value).slice(0, 80)}${r.note ? '   - ' + r.note : ''}`);
const fails = rows.filter(r => r.status === 'FAIL').length, warns = rows.filter(r => r.status === 'WARN').length;
console.log(`\nresult: ${fails ? 'FAIL' : 'OK'} (${fails} fail, ${warns} warn, ${rows.filter(r => r.status === 'MANUAL').length} manual checks)`);
fs.writeFileSync(f.replace(/\.mp4$/, '') + '.qc.json', JSON.stringify({ file: f, rows }, null, 1));
process.exit(fails ? 1 : 0);
