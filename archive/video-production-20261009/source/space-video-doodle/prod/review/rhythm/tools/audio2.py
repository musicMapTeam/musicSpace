import sys, numpy as np, json
sys.path.insert(0, 'tools'); sys.path.insert(0, '/tmp/space-video-doodle/prod/tools')
from grid import *
from scipy.signal import butter, sosfiltfilt
SR = 48000
bed = np.load('data/bed.npy').astype(np.float64).mean(axis=1)
mix = np.load('data/mix.npy').astype(np.float64).mean(axis=1)
def band(x, lo, hi):
    sos = butter(4, [lo, hi], btype='band', fs=SR, output='sos'); return sosfiltfilt(sos, x)
low = band(bed, 30, 150); high = band(bed, 5000, 11000); mid = band(bed, 300, 3000)
np.save('data/bed_low.npy', low.astype(np.float32)); np.save('data/bed_high.npy', high.astype(np.float32)); np.save('data/bed_mid.npy', mid.astype(np.float32))
def db(s): return 20 * np.log10(np.sqrt((s ** 2).mean() + 1e-18))
rows = []
for sb, t0, ln, trk in BARS:
    a, b = int(t0 * SR), int((t0 + ln) * SR)
    rows.append(dict(sb=int(sb), trk=trk, t0=t0, all=db(bed[a:b]), low=db(low[a:b]), mid=db(mid[a:b]), high=db(high[a:b]), mix=db(mix[a:b]),
                     beats=[db(bed[int((t0 + k * ln / 4) * SR):int((t0 + (k + 1) * ln / 4) * SR)]) for k in range(4)],
                     lowbeats=[db(low[int((t0 + k * ln / 4) * SR):int((t0 + (k + 1) * ln / 4) * SR)]) for k in range(4)]))
json.dump(rows, open('data/bars_audio.json', 'w'))
for r in rows:
    print(f"sb {r['sb']:2d} FI {r['trk']:3d} {mmss(r['t0'])} all {r['all']:6.1f} low {r['low']:6.1f} mid {r['mid']:6.1f} high {r['high']:6.1f} | mix {r['mix']:6.1f} | beats {' '.join(f'{x:6.1f}' for x in r['beats'])} | low/beat {' '.join(f'{x:6.1f}' for x in r['lowbeats'])}")
