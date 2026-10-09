// print the decoded picture-change pattern (grey proxy mean |dI|) for a frame range: node diffpat.mjs <mp4> <from> <to> [w h]
import { spawnSync } from 'node:child_process';
const [file, a, b, W = 135, H = 292] = process.argv.slice(2);
const w = +W, h = +H, from = +a, to = +b;
const r = spawnSync('/opt/homebrew/bin/ffmpeg', ['-v', 'error', '-i', file, '-vf', `select='between(n\\,${from - 1}\\,${to})',scale=${w}:${h}:flags=area,format=gray`, '-fps_mode', 'passthrough', '-f', 'rawvideo', '-'], { maxBuffer: 2 ** 31 - 1 });
const buf = r.stdout, n = buf.length / (w * h);
const d = [];
for (let i = 1; i < n; i++) { let s = 0; for (let k = 0; k < w * h; k++) s += Math.abs(buf[i * w * h + k] - buf[(i - 1) * w * h + k]); d.push(s / (w * h)); }
console.log(d.map(x => x < 0.12 ? '_' : x < 0.5 ? 'o' : x < 2 ? 'O' : '#').join(''));
console.log(d.slice(0, 60).map(x => x.toFixed(2)).join(' '));
