# downbeat hit strength in an act mix: level of the 120 ms after each downbeat vs the 250 ms before (dB), plus peak dBFS
import sys, json, numpy as np, scipy.io.wavfile as wf
wav, mp = sys.argv[1], sys.argv[2]
C = json.load(open(f'/tmp/space-video-doodle/prod/tools/tempo-maps/compiled/{mp}.json'))
rend = json.load(open(wav.replace('.mix.wav', '.render.json'))); t0 = rend['seconds'][0]
sr, x = wf.read(wav); x = x.astype(np.float64); x = x.mean(1) if x.ndim > 1 else x; x /= np.abs(x).max() or 1
def db(a): return 20 * np.log10(np.sqrt(np.mean(a ** 2)) + 1e-9)
rows = []
for b in C['bars']:
    t = b['t0'] - t0
    if t < 0.3 or t > len(x) / sr - 0.2: continue
    i = int(t * sr); pre = x[max(0, i - int(0.25 * sr)):i]; post = x[i:i + int(0.12 * sr)]
    rows.append((b['sb'], db(post) - db(pre), db(post), 20 * np.log10(np.abs(post).max() + 1e-9)))
for sb, jump, lvl, pk in sorted(rows, key=lambda r: -r[1]): print(f'{sb:>5}  jump {jump:+5.1f} dB  level {lvl:6.1f}  peak {pk:6.1f}')
