#!/usr/bin/env python3
"""grab.py <listfile of frame numbers> <outdir> [prefix]  -> <outdir>/<prefix>_<frame>.png (accurate seeks, 6 in parallel)"""
import subprocess, sys, os
from concurrent.futures import ThreadPoolExecutor
V = '/tmp/space-video-doodle/prod/out/music-space-video-v1.mp4'
lst, out = sys.argv[1], sys.argv[2]; pre = sys.argv[3] if len(sys.argv) > 3 else 'st'
fr = [int(x) for x in open(lst).read().split()]
os.makedirs(out, exist_ok=True)
def one(f):
    p = os.path.join(out, f'{pre}_{f:06d}.png')
    if os.path.exists(p): return
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-ss', f'{f / 60 - 0.001:.4f}', '-i', V, '-frames:v', '1', p], check=True)
with ThreadPoolExecutor(6) as ex: list(ex.map(one, fr))
print(len(fr), 'frames')
