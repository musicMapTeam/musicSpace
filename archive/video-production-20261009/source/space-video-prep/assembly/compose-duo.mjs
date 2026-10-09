// Compose a two-device split-screen clip (1920x992 footage area) from two lockstep phone recordings.
// usage: node compose-duo.mjs A.mp4 B.mp4 out.mp4 [labelA roleA labelB roleB]
import { spawnSync } from 'node:child_process';
const [A, B, out, ...labels] = process.argv.slice(2);
const mk = spawnSync('node', ['/tmp/space-video-prep/assembly/make-duo-frame.mjs', ...labels], { encoding: 'utf8' });
if (mk.status !== 0) { console.error(mk.stderr); process.exit(1); }
const g = JSON.parse(mk.stdout.trim().split('\n').pop());
const W = '/tmp/space-video-prep/assembly/work/';
const r = spawnSync('ffmpeg', ['-y', '-v', 'error', '-loop', '1', '-framerate', '60', '-i', W + 'duo-bg.png', '-i', A, '-i', B, '-loop', '1', '-framerate', '60', '-i', W + 'duo-bezel.png',
  '-filter_complex', `[1:v]scale=${g.phoneW}:${g.phoneH}:flags=lanczos,fps=60,setsar=1[a];[2:v]scale=${g.phoneW}:${g.phoneH}:flags=lanczos,fps=60,setsar=1[b];[0:v]format=yuv420p[bg];[bg][a]overlay=${g.ax}:${g.y}:shortest=1[t1];[t1][b]overlay=${g.bx}:${g.y}:shortest=1[t2];[t2][3:v]overlay=0:0:format=auto:shortest=1,format=yuv420p[v]`,
  '-map', '[v]', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '12', '-r', '60', '-pix_fmt', 'yuv420p', '-colorspace', 'bt709', '-color_range', 'tv', '-shortest', '-movflags', '+faststart', out], { stdio: 'inherit' });
process.exit(r.status || 0);
