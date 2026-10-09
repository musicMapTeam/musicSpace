#!/usr/bin/env python3
"""Decode the film to small frames and per-frame metrics (streaming).
out: data/gray160.npy (N,90,160) uint8, data/hist.npy (N,512) float32 colour histograms of 320x180,
     data/rgb80.npy (N,45,80,3) uint8
"""
import subprocess, sys, numpy as np, os
src = sys.argv[1]; out = sys.argv[2]
W, H = 320, 180
cmd = ['ffmpeg', '-v', 'error', '-i', src, '-an', '-vf', f'scale={W}:{H}:flags=area', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-']
p = subprocess.Popen(cmd, stdout=subprocess.PIPE, bufsize=10**8)
fs = W * H * 3
grays, hists, rgbs = [], [], []
n = 0
while True:
    b = p.stdout.read(fs)
    if len(b) < fs:
        break
    f = np.frombuffer(b, np.uint8).reshape(H, W, 3)
    g = (0.2126 * f[..., 0] + 0.7152 * f[..., 1] + 0.0722 * f[..., 2])
    g160 = g.reshape(90, 2, 160, 2).mean(axis=(1, 3))
    grays.append(g160.astype(np.uint8))
    q = (f // 32).astype(np.int32)
    idx = q[..., 0] * 64 + q[..., 1] * 8 + q[..., 2]
    h = np.bincount(idx.ravel(), minlength=512).astype(np.float32) / (W * H)
    hists.append(h)
    r80 = f.reshape(45, 4, 80, 4, 3).mean(axis=(1, 3)).astype(np.uint8)
    rgbs.append(r80)
    n += 1
    if n % 1000 == 0:
        print(n, flush=True)
p.wait()
np.save(os.path.join(out, 'gray160.npy'), np.stack(grays))
np.save(os.path.join(out, 'hist.npy'), np.stack(hists))
np.save(os.path.join(out, 'rgb80.npy'), np.stack(rgbs))
print('done', n)
