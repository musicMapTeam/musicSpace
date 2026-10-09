"""Audio check of the act's key moments (nobody can listen here): SFX vs music level right after each moment, in the full band and
in the band where the sound lives; plus where the mix would exceed the true-peak ceiling before the limiter.
moments.py <map> <info.json> <t0> <t1>"""
import json, sys
import numpy as np
from scipy.signal import butter, sosfilt
sys.path.insert(0, '/tmp/space-video-doodle/prod/tools')
import tempo, music, sfx
from audiolib import SR, decode

mp, infop, t0, t1 = sys.argv[1], sys.argv[2], float(sys.argv[3]), float(sys.argv[4])
info = json.load(open(infop))
C = tempo.load_compiled(mp)
y = decode(music.ensure_bed(mp))
a, b = int(round(t0 * SR)), int(round(t1 * SR))
mus = y[a:b].mean(axis=1)
pl = sfx.place(info['events'], t0, t1, C.get('music_has', []))
bus = sfx.render_bus(pl, t0, t1)
rep = json.load(open(infop.replace('.info.json', '.mix.wav.json')))
g = rep.get('sfx_gain_db', 0.0)
bus = bus.mean(axis=1) * 10 ** (g / 20)
bars = {x['sb']: x for x in C['bars']}
def T(p):
    bb, bt = p.split(':'); B = bars[bb]; return B['t0'] + (float(bt) - 1) * B['len'] / 4
def band(x, lo, hi):
    sos = butter(4, [lo, hi], btype='band', fs=SR, output='sos'); return sosfilt(sos, x)
def rms_db(x): return 20 * np.log10(np.sqrt(np.mean(x ** 2)) + 1e-12)
moments = [('21:1', 'drop: boom + slam + rise', 30, 200), ('22:1', 'punch thump', 40, 200), ('31:3', 'AI chime', 800, 6000), ('31:4', 'chip pops', 500, 4000),
           ('32:1', '人海。 XXL slam', 30, 300), ('33:4', 'hmm plucks', 150, 1200), ('34:3', 'tap 舞台 (click)', 2000, 8000), ('38:1', 'rule lifts (slap)', 1000, 4000),
           ('39:1', 'stamp thud', 40, 200), ('40:4.5', 'wipe whoosh', 400, 3000)]
print(f'{"pos":7} {"what":28} {"SFX-music full":>15} {"SFX-music band":>15}  (dB, 250 ms after the beat)')
for p, what, lo, hi in moments:
    t = T(p)
    if not (t0 <= t < t1 - 0.3): continue
    i, j = int((t - t0) * SR), int((t - t0 + 0.25) * SR)
    f = rms_db(bus[i:j]) - rms_db(mus[i:j])
    bd = rms_db(band(bus, lo, hi)[i:j]) - rms_db(band(mus, lo, hi)[i:j])
    print(f'{p:7} {what:28} {f:15.1f} {bd:15.1f}')
mix = mus + bus
pk = np.abs(mix); ceil = 10 ** (-1.5 / 20)
over = np.where(pk > ceil)[0]
print('samples over -1.5 dBFS before the limiter:', len(over), ' max', round(20 * np.log10(pk.max()), 2), 'dBFS at', round(t0 + pk.argmax() / SR, 3), 's')
