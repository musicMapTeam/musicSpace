#!/usr/bin/env python3
"""Smoothness analysis for a video: decode to small gray frames, measure consecutive-frame differences.
usage: analyze-smooth.py video.mp4 [start_s end_s]
Outputs: frame count, fps, duplicate-frame fraction, motion regularity (CV of diffs) in the window, small ASCII plot.
"""
import subprocess, sys, json
import numpy as np

path = sys.argv[1]
t0 = float(sys.argv[2]) if len(sys.argv) > 2 else 0
t1 = float(sys.argv[3]) if len(sys.argv) > 3 else None

probe = json.loads(subprocess.check_output(['ffprobe', '-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=avg_frame_rate,width,height,codec_name', '-of', 'json', path]))
st = probe['streams'][0]
num, den = st['avg_frame_rate'].split('/')
fps = float(num) / float(den)
w, h = 480, 270
cmd = ['ffmpeg', '-v', 'error', '-i', path, '-vf', f'scale={w}:{h},format=gray', '-f', 'rawvideo', '-']
raw = subprocess.check_output(cmd)
n = len(raw) // (w * h)
a = np.frombuffer(raw[: n * w * h], dtype=np.uint8).reshape(n, h, w).astype(np.int16)
d = np.abs(a[1:] - a[:-1]).mean(axis=(1, 2))
i0 = int(t0 * fps)
i1 = int((t1 if t1 else n / fps) * fps)
win = d[i0:i1]
dup = (win < 0.02).sum()
print(f'{path}: {st["codec_name"]} {st["width"]}x{st["height"]} {fps:.2f} fps, {n} frames ({n/fps:.2f}s)')
print(f'window {t0}-{t1 if t1 else n/fps:.1f}s: {len(win)} frame pairs, near-duplicate pairs: {dup} ({100*dup/max(1,len(win)):.1f}%)')
act = win[win >= 0.02]
if len(act):
    print(f'active diffs: mean {act.mean():.3f}  std {act.std():.3f}  CV {act.std()/act.mean():.2f}  max {act.max():.2f}')
# ascii plot: 80 buckets
if len(win) > 0:
    k = max(1, len(win) // 80)
    b = [win[i:i + k].mean() for i in range(0, len(win) - k + 1, k)]
    mx = max(b) or 1
    chars = ' .:-=+*#%@'
    print('plot |' + ''.join(chars[min(9, int(9 * x / mx))] for x in b) + '|  (max bucket mean diff %.2f)' % mx)
