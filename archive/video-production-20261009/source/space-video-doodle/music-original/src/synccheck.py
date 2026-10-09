"""verify that beats.json times match the audio: onset of each logged kick/snare in the drums stem, and of the impacts in the master"""
import json, sys, numpy as np
from scipy import signal
from scipy.io import wavfile
SR = 48000
OUT = sys.argv[1] if len(sys.argv) > 1 else 'out'
b = json.load(open(f'{OUT}/beats.json'))
_, d = wavfile.read(f'{OUT}/stems/drums_float.wav'); d = d.mean(1).astype(np.float64)
_, m = wavfile.read(f'{OUT}/master_float.wav'); m = m.mean(1).astype(np.float64)

def onset_errors(x, times, lo, hi, win=0.03):
    sos = signal.butter(4, [lo, hi], 'band', fs=SR, output='sos')
    y = np.abs(signal.sosfilt(sos, x))
    env = signal.sosfilt(signal.butter(2, 400, 'low', fs=SR, output='sos'), y)
    errs = []
    for t in times:
        a, c = int((t - win) * SR), int((t + win) * SR)
        if a < 0 or c >= len(env):
            continue
        seg = env[a:c]
        pk = np.max(seg)
        if pk <= 0:
            continue
        i = np.argmax(seg >= 0.5 * pk)     # half-rise point
        errs.append((a + i) / SR - t)
    e = np.array(errs) * 1000
    return e

ek = onset_errors(d, b['events']['kick_s'], 40, 200)
es = onset_errors(d, b['events']['snare_s'], 1500, 8000)
print(f"kicks: n={len(ek)} median offset {np.median(ek):+.1f} ms, 95% within [{np.percentile(ek, 2.5):+.1f}, {np.percentile(ek, 97.5):+.1f}] ms")
print(f"snares: n={len(es)} median offset {np.median(es):+.1f} ms, 95% within [{np.percentile(es, 2.5):+.1f}, {np.percentile(es, 97.5):+.1f}] ms")
# logged kick times vs exact grid (humanisation)
grid = np.array(b['events']['kick_s'])
step = b['step16_s']
dev = (grid - np.round(grid / step) * step) * 1000
print(f"kick humanisation vs 16th grid: sd {np.std(dev):.1f} ms, max {np.max(np.abs(dev)):.1f} ms")
for h in b['hits']:
    if h['kind'] in ('impact', 'chime', 'stab', 'pop') and h['name'] != 'sticker_pop':
        e = onset_errors(m, [h['time_s']], 30, 12000, 0.05)
        print(f"  {h['name']:16s} {h['time_s']:8.3f}s  audio onset {e[0]:+6.1f} ms" if len(e) else h['name'])
