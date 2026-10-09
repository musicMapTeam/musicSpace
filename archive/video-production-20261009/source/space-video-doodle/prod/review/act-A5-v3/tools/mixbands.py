#!/usr/bin/env python3
"""band levels per storyboard bar of a mix wav starting at film time t0, relative to the mean of bars 61-64 (same music in v2 and v3)"""
import json, subprocess, sys
import numpy as np
from scipy.signal import stft
FF = '/opt/homebrew/bin/ffmpeg'; SR = 22050
wav, t0 = sys.argv[1], float(sys.argv[2])
C = json.load(open('/tmp/space-video-doodle/prod/tools/tempo-maps/compiled/flipping-in-b.json'))
raw = subprocess.run([FF, '-v', 'error', '-i', wav, '-f', 'f32le', '-ac', '1', '-ar', str(SR), '-'], capture_output=True, check=True).stdout
x = np.frombuffer(raw, np.float32).astype(np.float64)
B = {int(b['sb']): b for b in C['bars'] if '+' not in str(b['sb'])}
def bands(sb):
    b = B[sb]; seg = x[int((b['t0'] - t0) * SR):int((b['t0'] + b['len'] - t0) * SR)]
    f, t, Z = stft(seg, SR, nperseg=2048, noverlap=1536); P = np.abs(Z) ** 2
    out = [20 * np.log10(np.sqrt((seg ** 2).mean()) + 1e-12)]
    for lo, hi in [(30, 150), (300, 1000), (1000, 3000), (3000, 6000)]:
        m = (f >= lo) & (f < hi); out.append(10 * np.log10(P[m].mean() + 1e-20))
    return np.array(out)
ref = np.mean([bands(k) for k in range(61, 65)], axis=0)
print(' sb   rms   low  mid300-1k  1k-3k  3k-6k   (dB vs bars 61-64)')
for sb in range(int(sys.argv[3]), int(sys.argv[4]) + 1):
    d = bands(sb) - ref
    print(f'{sb:3d} ' + ' '.join(f'{v:+6.1f}' for v in d))
