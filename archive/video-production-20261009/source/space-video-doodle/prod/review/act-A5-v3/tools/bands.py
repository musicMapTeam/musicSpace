#!/usr/bin/env python3
"""Per-bar band levels of Flipping In (track bars) and of the flipping-in-b bed (storyboard bars), for the 65-72 decision."""
import json, subprocess, sys
import numpy as np
from scipy.signal import stft
FF = '/opt/homebrew/bin/ffmpeg'; SR = 22050
def decode(p):
    raw = subprocess.run([FF, '-v', 'error', '-i', p, '-f', 'f32le', '-ac', '1', '-ar', str(SR), '-'], capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.float32).astype(np.float64)
def bands(x, t0, t1):
    seg = x[int(t0 * SR):int(t1 * SR)]
    f, t, Z = stft(seg, SR, nperseg=2048, noverlap=1536)
    P = np.abs(Z) ** 2
    def b(lo, hi):
        m = (f >= lo) & (f < hi); return 10 * np.log10(P[m].mean() + 1e-20)
    rms = 20 * np.log10(np.sqrt((seg ** 2).mean()) + 1e-12)
    return dict(rms=rms, low=b(30, 150), lowmid=b(150, 300), mid=b(300, 1000), himid=b(1000, 3000), pres=b(3000, 6000), air=b(6000, 12000))
mode = sys.argv[1]
if mode == 'track':
    B = json.load(open('/tmp/space-video-doodle/music-cc0/02-flipping-in__Wax-Lyricist/beats.json'))
    x = decode('/tmp/space-video-doodle/music-cc0/02-flipping-in__Wax-Lyricist/Wax_Lyricist_-_Flipping_In.mp3')
    bs = B['bar_starts_s']; bar = B.get('bar_s') or (bs[1] - bs[0])
    lo, hi = int(sys.argv[2]), int(sys.argv[3])
    print('trk    rms   low lowmid   mid himid  pres   air')
    for k in range(lo, hi + 1):
        r = bands(x, bs[k - 1], bs[k - 1] + bar)
        print(f"{k:3d} " + ' '.join(f"{r[c]:6.1f}" for c in ['rms', 'low', 'lowmid', 'mid', 'himid', 'pres', 'air']))
else:
    C = json.load(open(sys.argv[2])); x = decode(sys.argv[3])
    lo, hi = int(sys.argv[4]), int(sys.argv[5])
    print(' sb trk    rms   low lowmid   mid himid  pres   air')
    for b in C['bars']:
        sb = str(b['sb'])
        if '+' in sb: continue
        if lo <= int(sb) <= hi:
            r = bands(x, b['t0'], b['t0'] + b['len'])
            print(f"{int(sb):3d} {b['trk']:3d} " + ' '.join(f"{r[c]:6.1f}" for c in ['rms', 'low', 'lowmid', 'mid', 'himid', 'pres', 'air']))
