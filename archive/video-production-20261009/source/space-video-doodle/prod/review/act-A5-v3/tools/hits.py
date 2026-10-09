#!/usr/bin/env python3
"""Downbeat hits for candidate track runs under storyboard 65-72 (picture accents at 65:1 map, 67:1 community, 69:1 corner,
70:1 recap, 71:1 card lands, 71:3 my space, 73:1 break).  hit = 50 ms-RMS peak 0-250 ms after the beat minus mean RMS 50-600 ms before."""
import json, subprocess, sys
import numpy as np
FF = '/opt/homebrew/bin/ffmpeg'; SR = 22050
B = json.load(open('/tmp/space-video-doodle/music-cc0/02-flipping-in__Wax-Lyricist/beats.json'))
raw = subprocess.run([FF, '-v', 'error', '-i', '/tmp/space-video-doodle/music-cc0/02-flipping-in__Wax-Lyricist/Wax_Lyricist_-_Flipping_In.mp3', '-f', 'f32le', '-ac', '1', '-ar', str(SR), '-'], capture_output=True, check=True).stdout
x = np.frombuffer(raw, np.float32).astype(np.float64)
bs = B['bar_starts_s']; bar = bs[1] - bs[0]; beat = bar / 4
def seg(trk, b0, b1):          # track bar trk, beats b0..b1 (float) -> samples
    t0 = bs[trk - 1] + b0 * beat; t1 = bs[trk - 1] + b1 * beat
    return x[int(t0 * SR):int(t1 * SR)]
def rms_db(a): return 20 * np.log10(np.sqrt((a ** 2).mean()) + 1e-12)
def env(a, w=int(0.05 * SR)):
    c = np.convolve(a ** 2, np.ones(w) / w, mode='valid'); return 10 * np.log10(c + 1e-20)
def hit(prev_trk, prev_beat, trk, beat_pos):
    pre = seg(prev_trk, prev_beat - (0.6 / beat), prev_beat - (0.05 / beat)) if prev_beat else None
    post = seg(trk, beat_pos, beat_pos + 0.25 / beat)
    return env(post).max() - rms_db(pre)
runs = {'79-86 (now)': list(range(79, 87)), '93-100': list(range(93, 101)), '95-102': list(range(95, 103)), '87-94': list(range(87, 95)), '107-114': list(range(107, 115))}
pts = [('65:1', 0, 0), ('67:1', 2, 0), ('69:1', 4, 0), ('70:1', 5, 0), ('71:1', 6, 0), ('71:3', 6, 2), ('72:1', 7, 0)]
for name, r in runs.items():
    out = []
    for lab, k, b in pts:
        trk = r[k]
        if b == 0:
            prev = 118 if k == 0 else r[k - 1]
            h = hit(prev, 4, trk, 0)
        else:
            h = hit(trk, b, trk, b)
        out.append(f'{lab} {h:+5.1f}')
    # 73:1 into the break (119) from the run's last bar
    out.append(f'73:1 {hit(r[-1], 4, 119, 0):+5.1f}')
    lv = ' '.join(f'{rms_db(seg(t, 0, 4)):5.1f}' for t in r)
    print(f'{name:12s} ' + ' | '.join(out) + '   bar rms: ' + lv)
