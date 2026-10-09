#!/usr/bin/env python3
"""downbeat hits and per-bar band levels of a mix wav that starts at film time t0, on the compiled flipping-in-b grid."""
import json, subprocess, sys
import numpy as np
FF = '/opt/homebrew/bin/ffmpeg'; SR = 48000
wav, t0 = sys.argv[1], float(sys.argv[2])
C = json.load(open('/tmp/space-video-doodle/prod/tools/tempo-maps/compiled/flipping-in-b.json'))
raw = subprocess.run([FF, '-v', 'error', '-i', wav, '-f', 'f32le', '-ac', '1', '-ar', str(SR), '-'], capture_output=True, check=True).stdout
x = np.frombuffer(raw, np.float32).astype(np.float64)
beat = C['beat_s']
def lev(a, b):
    s = x[max(0, int((a - t0) * SR)):max(0, int((b - t0) * SR))]
    return 20 * np.log10(np.sqrt((s ** 2).mean()) + 1e-12) if len(s) else float('nan')
def hit(t):  # same definition as the release notes: peak of 50 ms RMS 0-250 ms after minus mean 50-600 ms before
    w = int(0.05 * SR); a = int((t - t0) * SR)
    post = x[a:a + int(0.25 * SR)]; e = np.convolve(post ** 2, np.ones(w) / w, mode='valid')
    pre = x[a - int(0.6 * SR):a - int(0.05 * SR)]
    return 10 * np.log10(e.max() + 1e-20) - 20 * np.log10(np.sqrt((pre ** 2).mean()) + 1e-12)
bars = {b['sb']: b for b in C['bars']}
for sb in sys.argv[3].split(','):
    b = bars[sb]
    print(f"{sb}:1  t {b['t0']:.3f}  trk {b['trk']:3d}  hit {hit(b['t0']):+5.1f} dB  bar level {lev(b['t0'], b['t0'] + b['len']):6.1f} dB")
