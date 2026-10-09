"""Per-bar balance of the act's mix: music bed vs the SFX bus (dB RMS, K-weighting not applied: a coarse check that no bar's
effects sit on top of the music).  PY balance.py <map> <info.json> <mix.wav.json>"""
import json, sys, subprocess, os
import numpy as np
sys.path.insert(0, '/tmp/space-video-doodle/prod/tools')
import audiolib, tempo
mid, info_p, mixrep_p = sys.argv[1:4]
info = json.load(open(info_p)); mixrep = json.load(open(mixrep_p))
t0, t1 = mixrep['range']; gain = mixrep['sfx_gain_db']
C = tempo.load_compiled(mid)
bus = '/tmp/a67-sfxbus.wav'
subprocess.run(['/tmp/space-video-doodle/music-cc0/tools/venv-ana/bin/python', '/tmp/space-video-doodle/prod/tools/sfx.py', 'bus', info_p, bus, '--from', str(t0), '--to', str(t1), '--map', mid], check=True, capture_output=True)
sfx = audiolib.decode(bus) * 10 ** (gain / 20)
bed = audiolib.decode(f'/tmp/space-video-doodle/prod/audio/beds/{mid}.wav')
i0 = int(round(t0 * audiolib.SR)); bed = bed[i0:i0 + len(sfx)]
def db(x): return 20 * np.log10(np.sqrt((x ** 2).mean() + 1e-18))
print(f'{"bar":>6} {"music dB":>9} {"sfx dB":>8} {"sfx-music":>10} {"sfx peak-music rms":>19}')
for b in C['bars']:
    if b['t0'] < t0 - 1e-6 or b['t0'] >= t1: continue
    a = int((b['t0'] - t0) * audiolib.SR); e = int((b['t0'] + b['len'] - t0) * audiolib.SR)
    m = bed[a:e].mean(axis=1); s = sfx[a:e].mean(axis=1)
    if len(s) == 0: continue
    # loudest 100 ms window of the sfx vs the music rms
    w = int(0.1 * audiolib.SR); pk = max(db(s[k:k + w]) for k in range(0, max(1, len(s) - w), w // 2))
    print(f"{b['sb']:>6} {db(m):9.1f} {db(s):8.1f} {db(s) - db(m):10.1f} {pk - db(m):19.1f}")
os.remove(bus)
