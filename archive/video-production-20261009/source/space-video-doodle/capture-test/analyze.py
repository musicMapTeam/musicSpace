#!/usr/bin/env python3
"""Frame-level QC of a captured clip.
- decodes the mp4 (grey, downscaled) and measures the mean absolute difference between consecutive frames
- frozen spans: runs of frames whose difference is ~0 (compressed video: threshold 0.15 grey levels)
- boil cadence: inside 3D holds, the frame changes in short steps; reports the median gap between change frames
- optional region (x,y,w,h in output px) to look only at the 3D canvas
usage: analyze.py clip.mp4 [x y w h]
"""
import json, subprocess, sys
import numpy as np

FF = '/opt/homebrew/bin/ffmpeg'
src = sys.argv[1]
probe = json.loads(subprocess.run(['/opt/homebrew/bin/ffprobe', '-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'json', src], capture_output=True, text=True).stdout)['streams'][0]
W, H = probe['width'], probe['height']
crop = ''
if len(sys.argv) >= 6:
    x, y, w, h = map(int, sys.argv[2:6]); crop = f'crop={w}:{h}:{x}:{y},'; W, H = w, h
sw, sh = W // 4, H // 4
raw = subprocess.run([FF, '-v', 'error', '-i', src, '-vf', f'{crop}scale={sw}:{sh}:flags=area,format=gray', '-f', 'rawvideo', '-'], capture_output=True).stdout
f = np.frombuffer(raw, np.uint8).reshape(-1, sh, sw).astype(np.int16)
d = np.abs(np.diff(f, axis=0)).mean(axis=(1, 2))
n = len(f); fps = 60
still = d < 0.15
runs, i = [], 0
while i < len(still):
    if still[i]:
        j = i
        while j < len(still) and still[j]: j += 1
        runs.append((i + 1, j - i + 1)); i = j
    else: i += 1
longest = max([r[1] for r in runs], default=1)
changes = np.where(~still)[0] + 1
gaps = np.diff(changes)
out = {
    'file': src.split('/')[-1], 'frames': n, 'seconds': round(n / fps, 3), 'region': crop or 'full',
    'changedFrames': int((~still).sum()), 'longestFrozen': f'{longest} f = {longest / fps:.2f} s',
    'frozenOver1s': [f'{s / fps:.2f}s+{l / fps:.2f}s' for s, l in runs if l >= fps],
    'frozenOver3s': [f'{s / fps:.2f}s+{l / fps:.2f}s' for s, l in runs if l >= 3 * fps],
    'gapHistogram(frames between changes)': {int(k): int(v) for k, v in zip(*np.unique(gaps, return_counts=True))} if len(gaps) else {},
    'meanDiff': round(float(d.mean()), 3),
}
print(json.dumps(out, ensure_ascii=False, indent=1))
np.save(src.replace('.mp4', '.diff.npy'), d)
