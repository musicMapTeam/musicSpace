import sys, numpy as np, subprocess, json
sys.path.insert(0, 'tools'); sys.path.insert(0, '/tmp/space-video-doodle/prod/tools')
from grid import *
from audiolib import decode, onset_env, ONSET_BIAS_MS
SR = 48000
mp4 = decode('/tmp/space-video-doodle/prod/out/music-space-video-v1.mp4')
mix = decode('/tmp/space-video-doodle/prod/out/music-space-video-v1.mix.wav')
bed = decode('/tmp/space-video-doodle/prod/audio/beds/flipping-in.wav')
print('lens', len(mp4)/SR, len(mix)/SR, len(bed)/SR)
np.save('data/mp4audio.npy', mp4.astype(np.float32)); np.save('data/mix.npy', mix.astype(np.float32)); np.save('data/bed.npy', bed.astype(np.float32))
# offset mp4 vs mix: cross-correlate envelopes in several windows
from scipy.signal import correlate
def lag(a, b, t0, dur=6.0, maxlag=0.1):
    i0 = int(t0 * SR); n = int(dur * SR); L = int(maxlag * SR)
    x = a[i0:i0 + n, 0]; y = b[i0 - L:i0 + n + L, 0]
    c = correlate(y, x, mode='valid')
    k = np.argmax(c) - L
    return k / SR * 1000
for t0 in (5, 40, 97, 140, 165):
    print('mp4 vs mix lag ms at', t0, round(lag(mix, mp4, t0), 2))
