#!/usr/bin/env python3
"""
Original, locally synthesised score for the Music Space competition video, v2 (hook-first structure).
No samples, no third-party audio: 100 % our own synthesis.  Rights: created by this script (CC0-style dedication by the project team).

Tempo 96 BPM -> beat 0.625 s, bar (4/4) 2.5 s.  165 s = 66 bars (2:45) + 3 s tail.  Every picture cut falls on a bar line (see STORYBOARD.md).
  bars  1- 5  (0:00-0:12.5)   HOOK     warm sustained keys + pad + bell sparkle under the 3D livehouse tour; soft pulse bars 4-5; soft impact on bar 5 (title lockup)
  bars  6-13  (0:12.5-0:32.5) PAIN     sparse minor colour, bells, heartbeat bars 12-13, riser into bar 14      [pain cards + what-if card]
  bar  14     (0:32.5)        DROP     crash + sub, the groove enters                                           [the product starts]
  bars 14-31  (0:32.5-1:17.5) GROOVE A drums + bass + piano comp + guitar arp; single bell chime at the AI chip (bar 27)
  bars 32-35  (1:17.5-1:27.5) GROOVE B rising bell figure = "同一刻的另一面" reveal; melody hook; shaker
  bars 36-45  (1:27.5-1:52.5) CONSENT  brushes, thin, warm pad; swell chord when the other side agrees (bar 40)  [exchange]
  bars 46-52  (1:52.5-2:10)   GROOVE A' light groove returns, build in bars 51-52                               [greeting / chat]
  bars 53-62  (2:10-2:35)     LIFT     full groove + strummed guitar + hook every bar; crash on 53              [after-show, recap, memory card, Map]
  bars 63-66  (2:35-2:45)     RESOLVE  drums out at 64, rooted open voicings ring out, 3 s tail                 [end card starts on bar 63]
SCORE_CONFIG=<json> (see music/score-config.json) retimes bars and cue bars without touching the code.
Outputs (music/original-v2/): space-original-v2.wav (stereo mix), stems/*.wav, loop 8 bars, beats.json
"""
import json, os, sys
import numpy as np
from scipy import signal
from scipy.io import wavfile

SR = 44100
BPM = 96.0
BEAT = 60.0 / BPM            # 0.625 s
BAR = 4 * BEAT               # 2.5 s
STEP = BEAT / 4              # 16th = 0.15625 s
SWING = 0.10                 # fraction of a beat added to the off-beat 8ths
CFG = json.load(open(os.environ['SCORE_CONFIG'])) if os.environ.get('SCORE_CONFIG') else {}
OUTDIR = os.environ.get('SCORE_OUT', '/tmp/space-video-prep/music/original-v2')
BARS = int(CFG.get('bars', 66))
TOTAL = BARS * BAR           # 160 s
rng = np.random.default_rng(1005)

def mtof(m): return 440.0 * 2 ** ((np.asarray(m, dtype=float) - 69) / 12)
def bar_t(b): return (b - 1) * BAR                      # start time of 1-based bar
def step_t(b, s, swing=True):
    """time of 16th-step s (0..15) inside bar b, with swing on odd 8ths (steps 2,6,10,14) and mild on odd 16ths"""
    t = bar_t(b) + s * STEP
    if swing and s % 4 == 2: t += SWING * BEAT
    return t

N = int(TOTAL * SR) + SR * 6
def buf(): return np.zeros((2, N), dtype=np.float64)

def add(track, mono, t, pan=0.0, gain=1.0):
    """add a mono snippet into a stereo track at time t with equal-power pan (-1..1)"""
    i = int(round(t * SR))
    if i < 0 or i >= N: return
    n = min(len(mono), N - i)
    ang = (pan + 1) * np.pi / 4
    track[0, i:i + n] += mono[:n] * np.cos(ang) * gain
    track[1, i:i + n] += mono[:n] * np.sin(ang) * gain

def env_ad(n, a=0.004, tau=0.5, rel=0.08, hold=None):
    t = np.arange(n) / SR
    e = np.minimum(1, t / max(a, 1e-4)) * np.exp(-t / tau)
    if hold is not None:                           # note-off at `hold` seconds
        k = int(hold * SR)
        if k < n:
            r = np.exp(-(np.arange(n - k)) / SR / rel)
            e[k:] *= r
    return e

# ---------------- instruments ----------------
def rhodes(freq, dur, vel=1.0, bright=1.0):
    n = int((dur + 1.4) * SR); t = np.arange(n) / SR
    f = freq
    modenv = np.exp(-t * (10 + 2 * f / 400)) * bright
    tine = np.sin(2 * np.pi * f * t + 1.9 * modenv * np.sin(2 * np.pi * f * 14 * t))     # bell-ish tine
    body = np.sin(2 * np.pi * f * t + 0.55 * np.sin(2 * np.pi * f * t))
    sub = 0.35 * np.sin(2 * np.pi * f * 0.5 * t) * np.exp(-t * 4)
    y = 0.55 * tine * np.exp(-t * 3.2) + 0.9 * body * np.exp(-t * 1.1) + sub
    y *= env_ad(n, 0.003, 10.0, 0.18, hold=dur)
    y *= 1 + 0.07 * np.sin(2 * np.pi * 4.6 * t + rng.random() * 6)                      # tremolo
    return y * vel

def bell(freq, dur=1.8, vel=1.0):
    n = int(dur * SR); t = np.arange(n) / SR
    y = np.sin(2 * np.pi * freq * t + 2.2 * np.exp(-t * 4) * np.sin(2 * np.pi * freq * 3.5 * t)) * np.exp(-t * 2.4)
    y += 0.3 * np.sin(2 * np.pi * freq * 2.01 * t) * np.exp(-t * 5)
    y[:int(0.002 * SR)] *= np.linspace(0, 1, int(0.002 * SR))
    return y * vel

def pluck(freq, dur=1.6, vel=1.0, decay=0.9965, mellow=0.55):
    N0 = int(round(SR / freq)); n = int(dur * SR) + N0 + 2
    y = np.zeros(n)
    exc = rng.random(N0) * 2 - 1
    # mellow excitation (one-pole lowpass)
    for i in range(1, N0): exc[i] = mellow * exc[i - 1] + (1 - mellow) * exc[i]
    y[:N0] = exc - exc.mean()
    for i in range(N0, n - N0, N0):
        prev = y[i - N0:i]
        shifted = np.concatenate(([y[i - N0 - 1]], prev[:-1]))
        y[i:i + N0] = decay * 0.5 * (prev + shifted)
    y = y[:int(dur * SR)]
    y *= np.minimum(1, np.arange(len(y)) / (0.002 * SR))
    y *= env_ad(len(y), 0.001, 99, 0.12, hold=dur * 0.95)
    return y * vel * 1.8

def bass_note(freq, dur, vel=1.0):
    n = int((dur + 0.3) * SR); t = np.arange(n) / SR
    y = np.sin(2 * np.pi * freq * t) + 0.35 * np.sin(2 * np.pi * freq * 2 * t) * np.exp(-t * 5) + 0.12 * np.sin(2 * np.pi * freq * 3 * t) * np.exp(-t * 9)
    y = np.tanh(1.6 * y) / 1.2
    y *= env_ad(n, 0.006, 1.6, 0.07, hold=dur)
    return y * vel

def kick(vel=1.0, soft=False):
    n = int(0.55 * SR); t = np.arange(n) / SR
    f = 46 + 95 * np.exp(-t * 32)
    ph = 2 * np.pi * np.cumsum(f) / SR
    y = np.sin(ph) * np.exp(-t * (8 if not soft else 11))
    click = rng.standard_normal(n) * np.exp(-t * 900) * (0.25 if not soft else 0.08)
    return (y + click) * vel

def snare(vel=1.0, brush=False):
    n = int(0.35 * SR); t = np.arange(n) / SR
    noise = rng.standard_normal(n)
    if brush:
        sos = signal.butter(2, [1500, 7500], 'band', fs=SR, output='sos'); y = signal.sosfilt(sos, noise) * np.minimum(1, t / 0.04) * np.exp(-t * 9) * 0.55
    else:
        sos = signal.butter(2, [900, 6500], 'band', fs=SR, output='sos')
        y = signal.sosfilt(sos, noise) * np.exp(-t * 19) * 0.9 + np.sin(2 * np.pi * 188 * t) * np.exp(-t * 28) * 0.6 + np.sin(2 * np.pi * 330 * t) * np.exp(-t * 40) * 0.25
    return y * vel

def hat(vel=1.0, open_=False):
    n = int((0.38 if open_ else 0.08) * SR); t = np.arange(n) / SR
    sos = signal.butter(3, 7000, 'high', fs=SR, output='sos')
    y = signal.sosfilt(sos, rng.standard_normal(n)) * np.exp(-t * (11 if open_ else 70))
    return y * vel * 0.30

def shaker(vel=1.0):
    n = int(0.12 * SR); t = np.arange(n) / SR
    sos = signal.butter(2, [4500, 10000], 'band', fs=SR, output='sos')
    y = signal.sosfilt(sos, rng.standard_normal(n)) * np.minimum(1, t / 0.012) * np.exp(-t * 32)
    return y * vel * 0.22

def crash(dur=3.2, vel=1.0):
    n = int(dur * SR); t = np.arange(n) / SR
    sos = signal.butter(3, 4500, 'high', fs=SR, output='sos')
    return signal.sosfilt(sos, rng.standard_normal(n)) * np.exp(-t * 1.5) * 0.4 * vel

def riser(dur):
    n = int(dur * SR); t = np.arange(n) / SR
    noise = rng.standard_normal(n)
    out = np.zeros(n)
    # swept band-pass in 24 blocks
    blocks = 40; bl = n // blocks
    for i in range(blocks):
        fc = 500 * (14 ** (i / (blocks - 1)))
        sos = signal.butter(2, [fc * 0.8, min(fc * 1.25, 18000)], 'band', fs=SR, output='sos')
        out[i * bl:(i + 1) * bl] = signal.sosfilt(sos, noise[i * bl:(i + 1) * bl])
    out *= (t / dur) ** 2.2
    return out * 0.5

def pad_chord(freqs, dur, vel=1.0):
    n = int((dur + 2.0) * SR); t = np.arange(n) / SR
    y = np.zeros(n)
    for f in freqs:
        for det in (-0.004, 0.0, 0.004):
            y += signal.sawtooth(2 * np.pi * f * (1 + det) * t, 0.5) * 0.12     # triangle-ish
    sos = signal.butter(2, 1400, 'low', fs=SR, output='sos')
    y = signal.sosfilt(sos, y)
    a = np.minimum(1, t / 1.6)
    e = a.copy()
    k = int(dur * SR)
    e[k:] *= np.exp(-np.arange(n - k) / SR / 0.9)
    return y * e * vel

def reverb_ir(rt=1.7, pre=0.02, damp=6000):
    n = int(rt * 1.5 * SR); t = np.arange(n) / SR
    ir = rng.standard_normal(n) * np.exp(-t * (6.9 / rt))
    sos = signal.butter(2, damp, 'low', fs=SR, output='sos'); ir = signal.sosfilt(sos, ir)
    ir = np.concatenate([np.zeros(int(pre * SR)), ir])
    return ir / np.sqrt(np.sum(ir ** 2))

def wet(track, ir, mix):
    out = np.zeros_like(track)
    for c in range(2):
        out[c] = signal.fftconvolve(track[c], ir)[:N]
    return track * (1 - mix * 0.5) + out * mix

# ---------------- harmony ----------------
CH = {  # name: (rhodes voicing midi, bass root midi, pad freqs base midi)
    'Cmaj9': ([52, 55, 59, 62, 64], 36),
    'Em7': ([55, 59, 62, 64, 67], 40),
    'Fmaj9': ([57, 60, 64, 67, 69], 41),
    'G69': ([59, 62, 64, 69, 71], 43),
    'Am9': ([55, 59, 60, 64, 67], 45),
}
ROOTED = {'Am9': [57, 60, 67, 71], 'Fmaj9': [53, 57, 64, 67], 'Cmaj9': [48, 52, 59, 62], 'G69': [55, 59, 64, 69]}
PROG_A = ['Cmaj9', 'Em7', 'Fmaj9', 'G69']
PROG_B = ['Am9', 'Fmaj9', 'Cmaj9', 'G69']
PROG_H = ['Cmaj9', 'Fmaj9', 'Am9', 'G69']      # hook: I-IV-vi-V, bright and hopeful (the pain section uses the minor-first PROG_B)
def chord_of(bar, prog): return CH[prog[(bar - 1) % 4]]

# melody hook (midi, start beat in bar (0-based), length beats) per bar of PROG_A cycle
HOOK = [
    [(76, 0, 1.5), (79, 1.5, .5), (81, 2, 1), (79, 3, 1)],        # Cmaj9: E5 G5 A5 G5
    [(71, 0, 1.5), (74, 1.5, .5), (76, 2, 2)],                    # Em7:   B4 D5 E5
    [(72, 0, 1), (76, 1, 1), (79, 2, 1), (81, 3, 1)],             # Fmaj9: C5 E5 G5 A5
    [(79, 0, 1.5), (76, 1.5, .5), (74, 2, 1.5), (72, 3.5, .5)],   # G69:   G5 E5 D5 C5
]

# ---------------- stems ----------------
stems = {k: buf() for k in ['keys', 'guitar', 'bass', 'drums', 'pad', 'fx', 'bell']}

def cue(name, default, structural=True):          # structural cues start sections (integer bars); chime / swell may be fractional bars (e.g. 27.2) to land on a measured moment
    v = CFG.get('cues', {}).get(name, default); return int(round(v)) if structural else float(v)
Q = dict(title=cue('title', 5), drop=cue('drop', 14), ai_chime=cue('ai_chime', 27, False), reveal=cue('reveal', 32), consent_swell=cue('consent_swell', 40, False),
         build=cue('build', 51), lift=cue('lift', 53), end_card=cue('end_card', 63), drums_out=cue('drums_out', 64))
PAIN_FIRST, GROOVE_B_FIRST, CONSENT_FIRST, LIGHT_FIRST = 6, Q['reveal'], cue('consent_first', 36), cue('light_first', 46)
SECTIONS = [  # (first bar, last bar, name, prog, cfg)
    (1, PAIN_FIRST - 1, 'HOOK', PROG_H, dict(keys='sustain', pad=True, bell=True, pulse=(Q['title'] - 1, Q['title']))),
    (PAIN_FIRST, Q['drop'] - 1, 'PAIN', PROG_B, dict(keys='sustain', pad=True, bell=True, heart=(Q['drop'] - 2, Q['drop'] - 1), riser=Q['drop'] - 1)),
    (Q['drop'], GROOVE_B_FIRST - 1, 'GROOVE A', PROG_A, dict(keys='comp', bass=True, drums='full', guitar='arp', pad=False)),
    (GROOVE_B_FIRST, CONSENT_FIRST - 1, 'GROOVE B', PROG_A, dict(keys='comp', bass=True, drums='full', guitar='arp', melody='keys', shaker=True)),
    (CONSENT_FIRST, LIGHT_FIRST - 1, 'CONSENT', PROG_B, dict(keys='soft', bass=True, drums='brush', guitar='arp', pad=True)),
    (LIGHT_FIRST, Q['lift'] - 1, 'GROOVE A-LIGHT', PROG_A, dict(keys='comp', bass=True, drums='full', guitar='arp', pad=False, build=(Q['build'], Q['build'] + 1))),
    (Q['lift'], Q['end_card'] - 1, 'LIFT', PROG_A, dict(keys='comp', bass=True, drums='full', guitar='strum', melody='gtr', shaker=True, extra=True)),
    (Q['end_card'], BARS, 'RESOLVE', PROG_B, dict(keys='sustain', bass=False, drums='none', guitar='none', pad=True, outro=True)),
]

def section_of(b):
    for s in SECTIONS:
        if s[0] <= b <= s[1]: return s
    return SECTIONS[-1]

def jit(): return rng.normal(0, 0.004)     # human timing, +-4 ms
def vj(): return 1 + rng.normal(0, 0.06)

for b in range(1, BARS + 1):
    first, last, name, prog, cfg = section_of(b)
    ch, root = chord_of(b - first + 1 if prog is PROG_B and name != 'PAIN' else b - first + 1, prog)
    # keys ------------------------------------------------------------
    mode = cfg.get('keys', 'none')
    notes = ch[:4]
    if mode in ('sustain', 'soft'):
        notes = ROOTED[prog[(b - first) % 4]]   # rooted R-3-7-9 voicings (no bass in these sections) so the harmony reads correctly
    if mode == 'sustain':
        for k, m in enumerate(notes):
            y = rhodes(mtof(m), BAR * 0.97, vel=0.34 * vj(), bright=0.55)
            add(stems['keys'], y, bar_t(b) + 0.012 * k + jit(), pan=-0.18 + 0.12 * k, gain=0.9)
    elif mode == 'soft':
        for (st, ln, v) in [(0, 6, 0.50), (6, 5, 0.38)]:
            for k, m in enumerate(notes):
                y = rhodes(mtof(m), ln * STEP, vel=0.34 * v * vj(), bright=0.6)
                add(stems['keys'], y, step_t(b, st) + 0.01 * k + jit(), pan=-0.2 + 0.13 * k)
    elif mode == 'comp':
        for (st, ln, v) in [(0, 7, 1.0), (6, 3, 0.62), (10, 4, 0.8), (14, 2, 0.5)]:
            if st == 14 and b % 2 == 0: continue
            for k, m in enumerate(notes):
                y = rhodes(mtof(m), ln * STEP, vel=0.27 * v * vj(), bright=0.8)
                add(stems['keys'], y, step_t(b, st) + 0.008 * k + jit(), pan=-0.25 + 0.16 * k)
    # melody hook ---------------------------------------------------
    mel = cfg.get('melody')
    if mel and (b - first) % 4 < 4 and ((b - first) // 4) % 2 == 0 or (mel and name == 'LIFT'):
        for (m, st_b, ln) in HOOK[(b - first) % 4]:
            t0 = bar_t(b) + st_b * BEAT + (SWING * BEAT if (st_b % 1) == 0.5 else 0) + jit()
            if mel == 'keys':
                y = rhodes(mtof(m), ln * BEAT * 0.92, vel=0.30 * vj(), bright=1.1)
                add(stems['keys'], y, t0, pan=0.18, gain=1.0)
            else:
                y = pluck(mtof(m), ln * BEAT * 1.15 + 0.4, vel=0.5 * vj(), decay=0.9975, mellow=0.45)
                add(stems['guitar'], y, t0, pan=0.3, gain=1.0)
    # guitar ----------------------------------------------------------
    g = cfg.get('guitar', 'none')
    if g == 'arp':
        order = [0, 1, 2, 3, 2, 1, 2, 3]
        for i in range(8):
            if name == 'CONSENT' and i % 2: continue
            m = notes[order[i]] + 12
            y = pluck(mtof(m), 1.4, vel=0.34 * (1.0 if i % 4 == 0 else 0.7) * vj())
            add(stems['guitar'], y, step_t(b, i * 2) + jit(), pan=0.32)
    elif g == 'strum':
        for (st, v) in [(0, 1.0), (4, 0.6), (6, 0.8), (10, 0.7), (12, 0.55)]:
            for k, m in enumerate(notes):
                y = pluck(mtof(m + 12), 1.2, vel=0.30 * v * vj())
                add(stems['guitar'], y, step_t(b, st) + 0.014 * k + jit(), pan=0.28 + 0.05 * k)
    # bass ------------------------------------------------------------
    if cfg.get('bass'):
        pat = [(0, 6, 1.0, 0), (7, 3, 0.8, 0), (10, 4, 0.9, 7)]
        if name == 'CONSENT': pat = [(0, 10, 0.9, 0)]
        for (st, ln, v, up) in pat:
            f0 = mtof(root + (12 if up == 12 else 0)) * (1.5 if up == 7 else 1.0)
            y = bass_note(f0, ln * STEP, vel=0.62 * v * vj())
            add(stems['bass'], y, step_t(b, st) + jit() * 0.5, pan=0.0)
    # drums -----------------------------------------------------------
    d = cfg.get('drums', 'none')
    if d == 'full':
        for st in (0, 6, 10) if (b % 4 != 0) else (0, 6, 10, 13):
            add(stems['drums'], kick(vel=0.9 * vj()), step_t(b, st) + jit() * 0.5, gain=1.0)
        for st in (4, 12):
            add(stems['drums'], snare(vel=0.62 * vj()), step_t(b, st) + jit(), pan=0.05)
        for st in (7, 15):
            if rng.random() < 0.5: add(stems['drums'], snare(vel=0.16 * vj()), step_t(b, st) + jit(), pan=-0.05)
        for st in range(0, 16, 2):
            add(stems['drums'], hat(vel=(0.9 if st % 4 == 0 else 0.55) * vj(), open_=(st == 14 and b % 2 == 0)), step_t(b, st) + jit(), pan=0.25)
        if cfg.get('shaker'):
            for st in range(1, 16, 2):
                add(stems['drums'], shaker(vel=0.8 * vj()), step_t(b, st, swing=False) + jit(), pan=-0.3)
        if cfg.get('extra'):
            add(stems['drums'], hat(vel=0.8, open_=True), step_t(b, 8), pan=0.3)
        if b in (GROOVE_B_FIRST - 1, CONSENT_FIRST - 1, Q['lift'] - 1, Q['end_card'] - 1):   # fills
            for k, st in enumerate((12, 13, 14, 15)):
                add(stems['drums'], snare(vel=(0.3 + 0.12 * k) * vj()), step_t(b, st) + jit())
    elif d == 'brush':
        add(stems['drums'], kick(vel=0.55, soft=True), step_t(b, 0))
        if b % 2 == 0: add(stems['drums'], kick(vel=0.4, soft=True), step_t(b, 10))
        for st in (4, 12):
            add(stems['drums'], snare(vel=0.55, brush=True), step_t(b, st) + jit())
        for st in range(0, 16, 2):
            add(stems['drums'], shaker(vel=0.55 + 0.2 * (st % 4 == 0)), step_t(b, st) + jit(), pan=0.2)
    # pad -------------------------------------------------------------
    if cfg.get('pad'):
        y = pad_chord([mtof(m) for m in notes[:3]] + [mtof(root + 12)], BAR * 0.95, vel=0.11)
        add(stems['pad'], y, bar_t(b), pan=0.0)
    # soft pulse (hook, last two bars before the title) -----------------
    if cfg.get('pulse') and b in cfg['pulse']:
        add(stems['drums'], kick(vel=0.5, soft=True), step_t(b, 0)); add(stems['drums'], kick(vel=0.4, soft=True), step_t(b, 8))
        add(stems['drums'], hat(vel=0.5), step_t(b, 4), pan=0.25); add(stems['drums'], hat(vel=0.5), step_t(b, 12), pan=0.25)
    # bell (hook / pain) -----------------------------------------------------
    if cfg.get('bell') and (b - first) % 2 == 1:
        for (m, st_b) in [(88, 1.0), (91, 2.5)] if (b - first) % 4 != 3 else [(93, 1.5)]:
            add(stems['bell'], bell(mtof(m), 2.2, vel=0.18), bar_t(b) + st_b * BEAT, pan=0.4 if st_b > 1 else -0.35)

# ---------------- one-off cues (bars come from Q / the config) ----------------
sub_n = int(1.6 * SR); t_ = np.arange(sub_n) / SR
def sub_drop(t0, g=0.8): add(stems['fx'], np.sin(2 * np.pi * (36 + 30 * np.exp(-t_ * 6)) * t_) * np.exp(-t_ * 2.4) * g, t0, pan=0)
# title lockup (end of the hook): a soft impact, much smaller than the product drop
add(stems['fx'], crash(2.4, 0.55), bar_t(Q['title']), pan=0.1, gain=0.7); sub_drop(bar_t(Q['title']), 0.45)
# heartbeat before the drop + riser
for b in (Q['drop'] - 2, Q['drop'] - 1):
    add(stems['drums'], kick(vel=0.55, soft=True), step_t(b, 0), pan=0)
    add(stems['drums'], kick(vel=0.38, soft=True), step_t(b, 3), pan=0)
    add(stems['drums'], kick(vel=0.55 if b == Q['drop'] - 1 else 0.5, soft=True), step_t(b, 8), pan=0)
add(stems['fx'], riser(BAR * 1.8), bar_t(Q['drop'] - 1) + BAR * 0.2, pan=0, gain=0.9)
# product drop (the groove enters)
add(stems['fx'], crash(3.4, 1.0), bar_t(Q['drop']), pan=0.1, gain=0.8); sub_drop(bar_t(Q['drop']), 0.8)
# AI chip: one single bell chime (the model says something)
add(stems['bell'], bell(mtof(91), 2.2, vel=0.20), bar_t(Q['ai_chime']) + BEAT, pan=-0.2)
# "同一刻的另一面" reveal: a rising four-note bell figure
for k, m in enumerate([84, 88, 91, 96]):
    add(stems['bell'], bell(mtof(m), 2.6, vel=0.22), bar_t(Q['reveal']) + BEAT * (0.0 + 0.5 * k), pan=-0.3 + 0.2 * k)
# consent moment (the other side agrees): warm swell chord
add(stems['pad'], pad_chord([mtof(m) for m in (57, 60, 64, 67)], BAR * 1.8, vel=0.14), bar_t(Q['consent_swell']), pan=0)
add(stems['bell'], bell(mtof(93), 2.4, vel=0.16), bar_t(Q['consent_swell']) + BEAT * 0.5, pan=0.3)
# build before the light groove turns into the lift
add(stems['fx'], riser(BAR * 1.9), bar_t(Q['build']) + BAR * 0.1, pan=0, gain=0.7)
# lift hit
add(stems['fx'], crash(3.0, 0.8), bar_t(Q['lift']), pan=-0.1, gain=0.7)
# end card: big warm chord ring-out + final bell
for k, m in enumerate([48, 55, 59, 64, 67, 71]):
    add(stems['keys'], rhodes(mtof(m), BAR * 3.2, vel=0.20, bright=0.5), bar_t(Q['end_card']) + 0.015 * k, pan=-0.3 + 0.12 * k)
add(stems['bell'], bell(mtof(96), 4.0, vel=0.2), bar_t(Q['end_card']) + BEAT, pan=0.3)

# ---------------- mix ----------------
def hp(x, fc):
    sos = signal.butter(2, fc, 'high', fs=SR, output='sos'); return np.stack([signal.sosfilt(sos, x[0]), signal.sosfilt(sos, x[1])])
def lp(x, fc):
    sos = signal.butter(2, fc, 'low', fs=SR, output='sos'); return np.stack([signal.sosfilt(sos, x[0]), signal.sosfilt(sos, x[1])])
ir_room = reverb_ir(1.5, 0.014, 5500)
ir_hall = reverb_ir(2.8, 0.03, 4500)
levels = dict(keys=1.0, guitar=0.9, bass=0.95, drums=0.95, pad=1.0, fx=0.7, bell=0.9)
stem_proc = {
    'keys': lambda x: wet(lp(hp(x, 90), 9000), ir_room, 0.28),
    'guitar': lambda x: wet(lp(hp(x, 120), 6200), ir_room, 0.24),
    'bass': lambda x: lp(hp(x, 30), 700),
    'drums': lambda x: wet(lp(hp(x, 35), 8200), ir_room, 0.12),
    'pad': lambda x: wet(lp(x, 4500), ir_hall, 0.35),
    'fx': lambda x: wet(x, ir_hall, 0.3),
    'bell': lambda x: wet(lp(x, 9000), ir_hall, 0.4),
}
os.makedirs(OUTDIR + '/stems', exist_ok=True)
mix = np.zeros((2, N))
for k, tr in stems.items():
    p = stem_proc[k](tr) * levels[k]
    mix += p
    q = np.tanh(p * 1.0) * 0.9
    wavfile.write(f'{OUTDIR}/stems/{k}.wav', SR, (np.clip(q[:, :int((TOTAL + 3) * SR)], -1, 1).T * 32767).astype(np.int16))
# tape-ish warmth + gentle saturation + master filter
mix = lp(mix, 10500)
mix = np.tanh(mix * 1.15) / 1.15
# sidechain-lite: nothing (kept clean)
mix = mix[:, :int((TOTAL + 3.0) * SR)]
# fade tail
tail = int(3.0 * SR); mix[:, -tail:] *= np.linspace(1, 0, tail) ** 1.5
peak = np.max(np.abs(mix)); mix = mix / peak * 0.89
wavfile.write(OUTDIR + '/space-original-v2.wav', SR, (mix.T * 32767).astype(np.int16))

# loop: bars 25-32 (8 bars) from the mix, cut on bar lines; add 0.02 s crossfade for seamlessness
s0, s1 = int(bar_t(Q['drop'] + 4) * SR), int(bar_t(Q['drop'] + 12) * SR)
loop = mix[:, s0:s1].copy()
xf = int(0.02 * SR); loop[:, :xf] *= np.linspace(0, 1, xf); loop[:, -xf:] *= np.linspace(1, 0, xf)
wavfile.write(OUTDIR + '/space-original-v2-loop-8bar-20s.wav', SR, (loop.T * 32767).astype(np.int16))

beats = dict(bpm=BPM, beat_s=BEAT, bar_s=BAR, step_s=STEP, swing_beat_fraction=SWING, total_bars=BARS, total_s=TOTAL, first_beat_s=0.0,
             sections=[dict(name=n, first_bar=a, last_bar=z, start_s=bar_t(a), end_s=bar_t(z + 1)) for (a, z, n, _, _) in SECTIONS],
             cues={k + '_s': bar_t(v) for k, v in Q.items()},
             bar_starts_s=[round(bar_t(b), 4) for b in range(1, BARS + 2)])
json.dump(beats, open(OUTDIR + '/beats.json', 'w'), indent=1, ensure_ascii=False)
print('done; peak before norm', peak, 'duration', mix.shape[1] / SR)
