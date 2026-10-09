# per-beat loudness + strongest 16th onsets for storyboard bars 41-55 of a bed (measurement only)
import json, sys, numpy as np, subprocess
mp = sys.argv[1]
c = json.load(open(f'/tmp/space-video-doodle/prod/tools/tempo-maps/compiled/{mp}.json'))
wav = f'/tmp/space-video-doodle/prod/audio/beds/{mp}.wav'
import scipy.io.wavfile as wf
sr, x = wf.read(wav)
x = x.astype(np.float32)
if x.ndim > 1: x = x.mean(1)
x /= 32768.0 if np.abs(x).max() > 2 else 1.0
beat = c['beat_s']
bars = {b['sb']: b for b in c['bars']}
def t_of(sb, bt):
    b = bars[str(sb)]; return b['t0'] + (bt - 1) * beat
# onset envelope: positive spectral-flux-ish via band energy diff
hop = int(sr * 0.005); win = int(sr * 0.02)
n = (len(x) - win) // hop
env = np.array([np.sqrt(np.mean(x[i*hop:i*hop+win]**2) + 1e-12) for i in range(n)])
db = 20*np.log10(env + 1e-9)
flux = np.maximum(0, np.diff(db, prepend=db[0]))
def rms_db(t0, t1):
    a, b = int(t0*sr), int(t1*sr); seg = x[a:b]; return 20*np.log10(np.sqrt(np.mean(seg**2))+1e-9)
lo = int(sys.argv[2]) if len(sys.argv) > 2 else 41
hi = int(sys.argv[3]) if len(sys.argv) > 3 else 55
for sb in range(lo, hi + 1):
    if str(sb) not in bars: print(sb, 'cut'); continue
    b = bars[str(sb)]
    row = []
    for bt in range(1, 5):
        t0 = t_of(sb, bt); row.append(f'{rms_db(t0, t0+beat):6.1f}')
    # strongest onsets on 16ths
    s16 = []
    for k in range(16):
        t = t_of(sb, 1 + k/4); i = int(t / 0.005)
        s16.append(flux[max(0,i-6):i+6].max() if i < len(flux) else 0)
    s16 = np.array(s16)
    marks = ''.join('X' if v > 10 else ('x' if v > 6 else ('.' if v > 3 else ' ')) for v in s16)
    print(f'sb {sb:>2} trk {b["trk"]:>3} t {b["t0"]:7.3f}  beat dB {" ".join(row)}  16ths |{marks}|')
