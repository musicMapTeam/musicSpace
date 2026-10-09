#!/usr/bin/env python3
"""Beat grid + structure map for cutting video to music.
usage: beatmap.py audio.mp3 out.json
Output: bpm, first_beat_s, downbeat_offset (0-3 beats, chosen by low-band energy), bar start times, 'drops'/'breakdowns' (large RMS steps between bars),
and a confidence note.  Constant-tempo tracks (all the CC0 candidates here and the generated score) are reliable; verify the downbeat by ear once."""
import sys, json, subprocess
import numpy as np
from scipy import signal

SR = 22050
path, out = sys.argv[1], sys.argv[2]
raw = subprocess.check_output(['ffmpeg', '-v', 'error', '-i', path, '-ac', '1', '-ar', str(SR), '-f', 'f32le', '-'])
y = np.frombuffer(raw, dtype=np.float32)
dur = len(y) / SR
hop = 128
f, t, Z = signal.stft(y, fs=SR, nperseg=1024, noverlap=1024 - hop, boundary=None)
S = np.abs(Z)
fps = SR / hop

def flux(lo, hi):
    band = (f >= lo) & (f <= hi)
    L = np.log1p(S[band] * 60.0)
    d = np.maximum(0, np.diff(L, axis=1)).sum(axis=0)
    d = np.concatenate([[0], d])
    k = int(0.4 * fps)
    d = np.maximum(0, d - signal.convolve(d, np.ones(k) / k, mode='same'))
    return d

env = flux(40, 6000)
low = flux(35, 160)

def tempo_from(env, lo=60, hi=170):
    e = (env - env.mean()) / (env.std() + 1e-9)
    ac = signal.correlate(e, e, mode='full')[len(e) - 1:]
    ac /= ac[0] + 1e-9
    lags = np.arange(1, len(ac))
    bpm = 60 * fps / lags
    prior = np.exp(-0.5 * (np.log2(bpm / 100) / 0.6) ** 2)
    sc = np.where((bpm >= lo) & (bpm <= hi), ac[1:] * prior, -1)
    i = int(np.argmax(sc)) + 1
    # parabolic refine
    a, b, c = ac[i - 1], ac[i], ac[i + 1]
    den = a - 2 * b + c
    off = 0.5 * (a - c) / den if abs(den) > 1e-9 else 0
    return 60 * fps / (i + off), float(ac[i])

bpm, conf = tempo_from(env)
# fine tempo: scan +-1.5 % around estimate maximising comb energy
best = (-1, bpm, 0)
for cand in np.linspace(bpm * 0.985, bpm * 1.015, 61):
    period = fps * 60 / cand
    for ph in np.arange(0, period, 0.5):
        idx = np.arange(ph, len(env), period).astype(int)
        idx = idx[idx < len(env)]
        v = np.maximum.reduce([env[np.clip(idx + d, 0, len(env) - 1)] for d in (-1, 0, 1)]).sum() / len(idx)
        if v > best[0]: best = (v, cand, ph)
_, bpm, ph = best
beat = 60 / bpm
first = ph / fps
# downbeat: which of 4 beat positions carries the most low-band energy
period = fps * 60 / bpm
scores = []
for k in range(4):
    idx = (np.arange(ph + k * period, len(low), period * 4)).astype(int)
    idx = idx[idx < len(low)]
    scores.append(float(np.maximum.reduce([low[np.clip(idx + d, 0, len(low) - 1)] for d in (-1, 0, 1)]).mean()))
db = int(np.argmax(scores))
first_down = first + db * beat
bars = [round(float(first_down + i * 4 * beat), 3) for i in range(int((dur - first_down) / (4 * beat)) + 1)]
# fold bars before 0
pre = []
t0 = first_down - 4 * beat
while t0 >= 0:
    pre.insert(0, round(float(t0), 3)); t0 -= 4 * beat
bars = pre + bars
# RMS per bar and step detection
rms = []
for b0 in bars:
    seg = y[int(b0 * SR):int((b0 + 4 * beat) * SR)]
    rms.append(float(20 * np.log10(np.sqrt(np.mean(seg ** 2)) + 1e-9)) if len(seg) > 100 else -90.0)
steps = []
for i in range(1, len(rms)):
    d = rms[i] - rms[i - 1]
    if d >= 5.5: steps.append(('drop/entry', bars[i], round(float(d), 1)))
    elif d <= -5.5: steps.append(('breakdown/exit', bars[i], round(float(d), 1)))
res = dict(file=path.split('/')[-1], duration_s=round(float(dur), 2), bpm=round(float(bpm), 2), beat_s=round(float(beat), 4), bar_s=round(float(4 * beat), 4),
           first_beat_s=round(float(first), 3), downbeat_offset_beats=db, downbeat_scores=[round(float(s), 3) for s in scores], first_downbeat_s=round(float(first_down), 3),
           tempo_autocorr_conf=round(conf, 2), bar_starts_s=bars, bar_rms_db=[round(float(r), 1) for r in rms], structure_steps=steps,
           note='Constant-tempo grid. downbeat_offset_beats picked by low-band (kick/bass) energy; verify by ear once (+/- 1 beat possible).')
json.dump(res, open(out, 'w'), indent=1)
print(f"{res['file'][:44]:44s} bpm {res['bpm']:.2f}  beat {res['beat_s']:.4f}s  bar {res['bar_s']:.3f}s  first_down {res['first_downbeat_s']:.3f}s (offset {db}, scores {res['downbeat_scores']})  steps: {steps[:8]}")
