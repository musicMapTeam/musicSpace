#!/usr/bin/env python3
"""Visual check of the beat grid: onset envelope + drum-band envelope with beat (thin) and bar (thick) lines, at the track start
and at the start of the preview window. usage: grid_check.py PICK_DIR AUDIO"""
import sys, os, json, numpy as np
sys.path.insert(0, os.path.dirname(__file__))
import deep
import matplotlib; matplotlib.use('Agg'); import matplotlib.pyplot as plt
pick, audio = sys.argv[1], sys.argv[2]
B = json.load(open(os.path.join(pick, 'beats.json')))
y = deep.decode(os.path.join(pick, audio))
f, S = deep.stft_mag(y)
env = deep.flux(S, f, 40, 8000); low = deep.flux(S, f, 30, 150)
t = np.arange(len(env)) / deep.FPS + deep.FLUX_BIAS
beat = B['beat_s']; bars = np.array(B['bar_starts_s'])
fa = B.get('first_active_downbeat_s') or B['first_downbeat_s']
wins = [(max(0, fa - 0.5), max(0, fa - 0.5) + 8), (B['strongest_30s']['start_s'] - 1, B['strongest_30s']['start_s'] + 7)]
fig, axs = plt.subplots(2, 1, figsize=(15, 6.5))
for ax, (t0, t1) in zip(axs, wins):
    m = (t >= t0) & (t <= t1)
    ax.plot(t[m], env[m] / (env[m].max() + 1e-9), color='#1c1b1a', lw=0.8, label='onset envelope (all bands)')
    ax.plot(t[m], -low[m] / (low[m].max() + 1e-9), color='#ff5c8a', lw=0.8, label='kick band 30-150 Hz (inverted)')
    for b0 in bars:
        for k in range(4):
            tb = b0 + k * beat
            if t0 <= tb <= t1:
                ax.axvline(tb, color='#5fdcc0' if k else '#1c1b1a', lw=2.2 if k == 0 else 0.8, alpha=0.9 if k == 0 else 0.7)
    ax.set_xlim(t0, t1); ax.set_ylim(-1.05, 1.05); ax.set_yticks([])
    ax.set_title(f"{os.path.basename(pick)} | {B['tempo_bpm']} BPM | thick black = bar lines (downbeats), mint = beats | window {t0:.2f}-{t1:.2f} s")
axs[0].legend(loc='upper right', fontsize=8)
fig.tight_layout(); fig.savefig(os.path.join(pick, 'grid-check.png'), dpi=90)
print('ok', pick)
