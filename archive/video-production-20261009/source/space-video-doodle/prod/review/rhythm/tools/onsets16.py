import sys, numpy as np, json
sys.path.insert(0, 'tools'); sys.path.insert(0, '/tmp/space-video-doodle/prod/tools')
from grid import *
from audiolib import onset_env, ONSET_BIAS_MS
SR = 48000
bed = np.load('data/bed.npy').astype(np.float64)
env, tt = onset_env(bed)
tt = tt + 0  # frame centres
np.savez('data/bed_onset.npz', env=env, t=tt)
def strength(t, w=0.035):
    # bias: detector peaks ~10 ms early
    tc = t + ONSET_BIAS_MS / 1000
    m = (tt >= tc - w) & (tt <= tc + w)
    return env[m].max() if m.any() else 0
bars = [int(x) for x in sys.argv[1].split(',')]
for b in bars:
    sb, t0, ln, trk = [x for x in BARS if int(x[0]) == b][0]
    s = [strength(t0 + k * ln / 16) for k in range(16)]
    print(f'sb {b:2d} FI {trk:3d} ' + ' '.join(('|' if k % 4 == 0 else '') + f'{v:.2f}' for k, v in enumerate(s)))
