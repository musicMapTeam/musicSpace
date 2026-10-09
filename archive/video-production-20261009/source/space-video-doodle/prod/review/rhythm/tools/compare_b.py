import sys, numpy as np, json
sys.path.insert(0, '/tmp/space-video-doodle/prod/tools')
from audiolib import decode
from scipy.signal import butter, sosfiltfilt
SR = 48000
def bars_of(mid):
    C = json.load(open(f'/tmp/space-video-doodle/prod/tools/tempo-maps/compiled/{mid}.json'))
    return C
def db(s): return 20 * np.log10(np.sqrt((s ** 2).mean() + 1e-18))
def env_db(m, win=0.05, hop=0.005):
    n = int(win * SR); h = int(hop * SR)
    sq = np.convolve(m ** 2, np.ones(n) / n, mode='same'); return 10 * np.log10(sq[::h] + 1e-12), h / SR
out = {}
for mid in ('flipping-in', 'flipping-in-b'):
    C = bars_of(mid)
    x = decode(f'/tmp/space-video-doodle/prod/audio/beds/{mid}.wav').mean(axis=1)
    sos = butter(4, [300, 3000], btype='band', fs=SR, output='sos'); mid_b = sosfiltfilt(sos, x)
    e, dt = env_db(x)
    rows = {}
    for b in C['bars']:
        a, z = int(b['t0'] * SR), int((b['t0'] + b['len']) * SR)
        i = int(b['t0'] / dt)
        pre = e[max(0, i - int(0.6 / dt)):i - int(0.05 / dt)]; post = e[i:i + int(0.25 / dt)]
        rows[b['sb']] = dict(trk=b['trk'], t0=b['t0'], all=db(x[a:z]), mid=db(mid_b[a:z]), hit=(post.max() - pre.mean()) if len(pre) else 0)
    out[mid] = (C, rows, e, dt)
    print(mid, 'duration', C['duration_s'], 'fade', C['fade'], 'tail', C['tail_s'])
A, B = out['flipping-in'][1], out['flipping-in-b'][1]
print(' sb | FI  lvl   mid  hit | FI-b lvl   mid  hit')
for sb in [str(k) for k in range(1, 91)]:
    a = A.get(sb); b = B.get(sb)
    fa = f"{a['trk']:3d} {a['all']:5.1f} {a['mid']:5.1f} {a['hit']:+5.1f}" if a else '   -'
    fb = f"{b['trk']:3d} {b['all']:5.1f} {b['mid']:5.1f} {b['hit']:+5.1f}" if b else '   -'
    if sb in ('1','5','7','9','17','19','20','21','22','25','41','47','49','50','51','52','53','55','61','65','67','71','73','75','77','79','81','83','85','86','87','88','89'):
        print(f'{sb:>3} | {fa} | {fb}')
# ranks of key downbeats among all downbeats
for mid in out:
    rows = out[mid][1]
    order = sorted(rows, key=lambda k: -rows[k]['hit'])
    print(mid, 'top downbeats:', [(k, round(rows[k]['hit'], 1)) for k in order[:6]], ' rank 21:', order.index('21') + 1, ' rank 51:', order.index('51') + 1)
