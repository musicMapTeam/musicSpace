# where does an act mp4's audio exceed a true-peak level?  usage: tpk.py act.mp4 [thr_dBTP]
import sys, json, subprocess, numpy as np
from scipy.signal import resample_poly
v = sys.argv[1]; thr = float(sys.argv[2]) if len(sys.argv) > 2 else -1.2
rend = json.load(open(v[:-4] + '.render.json')); t0 = rend['seconds'][0]; mp = rend['map']
C = json.load(open(f'/tmp/space-video-doodle/prod/tools/tempo-maps/compiled/{mp}.json'))
raw = subprocess.run(['/opt/homebrew/bin/ffmpeg', '-v', 'error', '-i', v, '-vn', '-f', 'f32le', '-ac', '2', '-ar', '48000', '-'], capture_output=True).stdout
x = np.frombuffer(raw, np.float32).reshape(-1, 2).astype(np.float64)
up = np.abs(resample_poly(x, 4, 1, axis=0)).max(1)
db = 20 * np.log10(up + 1e-12)
def pos(t):
    best = None
    for b in C['bars']:
        if b['t0'] <= t: best = b
    return f"{best['sb']}:{1 + (t - best['t0']) / C['beat_s']:.2f}"
idx = np.where(db > thr)[0]
print('max', round(db.max(), 2), 'dBTP at', round(t0 + db.argmax() / 192000, 3), pos(t0 + db.argmax() / 192000))
groups = []
for i in idx:
    t = t0 + i / 192000
    if groups and t - groups[-1][1] < 0.05: groups[-1][1] = t; groups[-1][2] = max(groups[-1][2], db[i])
    else: groups.append([t, t, db[i]])
for g in groups[:30]: print(f'{g[0]:8.3f}-{g[1]:8.3f}  {pos(g[0]):>8}  peak {g[2]:.2f}')
