#!/usr/bin/env python3
"""Compare demucs vocal stem vs mix: per-1s RMS ratio. usage: vocal_ratio.py mix.wav vocals.wav"""
import sys, subprocess, numpy as np, json
SR = 22050
def dec(p): return np.frombuffer(subprocess.check_output(['ffmpeg', '-v', 'quiet', '-i', p, '-ac', '1', '-ar', str(SR), '-f', 'f32le', '-']), dtype=np.float32)
m, v = dec(sys.argv[1]), dec(sys.argv[2])
n = min(len(m), len(v)); m, v = m[:n], v[:n]
w = SR
r = []
for i in range(0, n - w, w):
    a = np.sqrt(np.mean(m[i:i + w] ** 2)) + 1e-9; b = np.sqrt(np.mean(v[i:i + w] ** 2)) + 1e-9
    if a > 10 ** (-45 / 20): r.append(20 * np.log10(b / a))
r = np.array(r)
tot = 20 * np.log10((np.sqrt(np.mean(v ** 2)) + 1e-9) / (np.sqrt(np.mean(m ** 2)) + 1e-9))
res = dict(vocal_rel_db=round(float(tot), 1), median_db=round(float(np.median(r)), 1), p90_db=round(float(np.percentile(r, 90)), 1),
           frac_above_m10=round(float((r > -10).mean()), 3), frac_above_m15=round(float((r > -15).mean()), 3), seconds=len(r))
print(json.dumps(res))
