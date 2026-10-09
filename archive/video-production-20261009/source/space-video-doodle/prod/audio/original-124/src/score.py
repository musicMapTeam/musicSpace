#!/usr/bin/env python3
"""
"Same Moment, Other Side" -- original score for the Music Space competition video (doodle cut).
100 % our own synthesis (see instruments.py); no samples, no third-party audio, no lyrics.
Rights: created by this script for the Music Space team (CC0-style dedication by the team).

124 BPM, 4/4, bar = 1.935484 s, 16th = 0.120968 s.  2:56 (176.0 s) incl. the end-card ring-out.
Key D major; final lift chorus up a whole step to E major.

Section map (bars 1-based; times = (bar-1) * 1.935484 s) -- see beats.json for every time:
  HOOK      1-4    cold open: full band + whistle hook ("同-一-刻 | 另-一-面" rhythm cell); HARD STOP: stab on bar 4 beat 3.5, silence
  TITLE     5-6    IMPACT on the title (bar 5 downbeat), chord rings; glock pop for the tagline (bar 6)
  PAIN      7-12   half-time, sparse: kick on 1, snare on 3, clean guitar arpeggio + dotted-8th echo, lonely glock (hook rhythm, falling)
  WHATIF    13-14  build: four-on-the-floor, snare roll, riser, reverse crash
  GROOVE_A  15-30  DROP (bar 15): full groove; organ stabs from bar 19; whistle hook bars 23-30
  AI        31-38  thinner (palm-muted guitar, 16th hats, synth-pluck arpeggio), riser -> AI CHIME (bar 35), groove back
  REVEAL    39-46  reveal sting (bar 39); build: snare 8ths -> 16ths, rising bass E-F#-G-A, riser; one-beat GAP (bar 46 beat 4)
  GROOVE_B  47-66  PAYOFF hit (bar 47, 交换已接受) + second groove (four-on-the-floor, octave bass, pluck); whistle B-melody bars 59-66
  BREAK     67-68  stop-time hits on C and D (bVI-bVII of the new key) + tom fill
  LIFT      69-84  final lift chorus in E major, hook x4, whistle harmony bars 77-84
  TAG       85-86  stop-time hits C, D
  END       87-91  BIG CHORD (bar 87) under the end card; glock/whistle reprise of the hook cell; final ding (bar 90); tail to 176.0 s

SCORE_CONFIG=<json> may override section lengths {"bars": {"PAIN": 8, ...}}, "ai_chime_bar" (1-based bar inside AI, default 5),
"ai_chime_beat" (0-3), "total_s".  SCORE_OUT=<dir> output folder.
"""
import json, os, sys, time
import numpy as np
from dsp import *
import instruments as I

T_START = time.time()
BPM = 124.0
BEAT = 60.0 / BPM
BAR = 4 * BEAT
STEP = BEAT / 4
SWING = 0.07                       # odd 16ths pushed late by 7 % of a 16th (hats, tambourine, acoustic, melody pickups)
CFG = json.load(open(os.environ['SCORE_CONFIG'])) if os.environ.get('SCORE_CONFIG') else {}
OUT = os.environ.get('SCORE_OUT', '/tmp/space-video-doodle/music-original/out')
TOTAL_S = float(CFG.get('total_s', 176.0))
rng = np.random.default_rng(124_2026)

# ============================================================================ FORM
GB_CHORDS = ['D', 'A', 'Bm', 'G'] + ['D', 'Bm', 'G', 'A'] * 4
FORM = [  # name, bars, chords (cycled), description (also written to beats.json)
    ('HOOK', 4, ['D', 'A', 'Bm', 'G'], 'cold open: full band + whistle hook; hard stop (stab on bar 4 beat 3.5, then silence)'),
    ('TITLE', 2, ['Dadd9'], 'IMPACT on the title (downbeat of the first bar); chord rings; glock pop for the tagline on the second bar'),
    ('PAIN', 6, ['Bm7', 'Gmaj7', 'D/F#', 'Asus4', 'Bm7', 'Gmaj7'], 'half-time, sparse: kick on 1, snare on 3 (one per bar), clean guitar arpeggio + echo, lonely glock'),
    ('WHATIF', 2, ['Em7', 'A'], 'build into the drop: four-on-the-floor, snare roll, riser, reverse crash'),
    ('GROOVE_A', 16, ['D', 'A', 'Bm', 'G'], 'DROP: full groove when the product appears; organ stabs from bar 5; whistle hook in the second 8 bars'),
    ('AI', 8, ['G', 'A', 'Bm', 'A', 'D', 'A', 'Bm', 'G'], 'thinner groove (muted guitar, 16th hats, synth-pluck arpeggio); riser -> AI CHIME; groove back from the chime'),
    ('REVEAL', 8, ['G', 'A', 'F#m', 'Bm', 'Em7', 'F#m7', 'G', 'A'], 'reveal sting on bar 1; build (snare 8ths->16ths, rising bass, riser) into a one-beat gap'),
    ('GROOVE_B', 20, GB_CHORDS, 'PAYOFF hit (exchange accepted) + second groove: four-on-the-floor, octave bass, synth pluck; whistle B-melody in the last 8 bars'),
    ('BREAK', 2, ['C', 'D'], 'stop-time hits on bVI-bVII of the new key + tom fill + riser'),
    ('LIFT', 16, ['E', 'B', 'C#m', 'A'], 'final lift chorus up a whole step (E major): hook x4, whistle harmony in the last 8 bars'),
    ('TAG', 2, ['C', 'D'], 'stop-time hits (bVI-bVII) into the end chord'),
    ('END', 5, ['Eadd9'], 'BIG CHORD under the end card; whistle/glock reprise of the hook cell; final ding; natural tail'),
]
for name, n in CFG.get('bars', {}).items():
    FORM = [(a, (int(n) if a == name else b), c, d) for (a, b, c, d) in FORM]

SECTION = {}          # name -> (first_bar, n_bars)
BAR_INFO = {}         # bar -> (section, index_in_section (0-based), chord)
b = 1
for name, n, chords, desc in FORM:
    SECTION[name] = (b, n)
    for i in range(n):
        ch = GB_CHORDS[i % len(GB_CHORDS)] if name == 'GROOVE_B' else chords[i % len(chords)]
        BAR_INFO[b + i] = (name, i, ch)
    b += n
LAST_BAR = b - 1
AI_CHIME_BAR = SECTION['AI'][0] + int(CFG.get('ai_chime_bar', 5)) - 1
AI_CHIME_BEAT = float(CFG.get('ai_chime_beat', 0))


def first(name):
    return SECTION[name][0]


def at(bar, step=0.0):
    return (bar - 1) * BAR + step * STEP


def sw(step):
    """swung position of a 16th step (odd 16ths late)"""
    return step + (SWING if int(round(step)) % 2 == 1 and abs(step - round(step)) < 1e-6 else 0.0)


def hum(ms=3.0):
    return rng.normal(0, ms / 1000.0)


def vj(s=0.06):
    return float(np.clip(1 + rng.normal(0, s), 0.7, 1.25))


# ============================================================================ HARMONY TABLES
GTR_OPEN = {
    'D': [45, 50, 57, 62, 66], 'Dadd9': [50, 54, 57, 62, 64], 'A': [45, 52, 57, 61, 64], 'Bm': [47, 54, 59, 62, 66],
    'G': [43, 47, 50, 55, 62, 67], 'F#m': [42, 49, 54, 57, 61, 66], 'Em7': [40, 47, 52, 55, 62, 67], 'F#m7': [42, 49, 52, 57, 61, 66],
    'Asus4': [45, 52, 57, 62, 64], 'C': [48, 52, 55, 60, 64], 'Bm7': [47, 50, 57, 59, 66], 'Gmaj7': [43, 50, 55, 59, 66],
    'D/F#': [42, 50, 57, 62, 66], 'E': [40, 47, 52, 56, 59, 64], 'B': [47, 54, 59, 63, 66], 'C#m': [49, 56, 61, 64, 68],
    'Eadd9': [40, 47, 54, 56, 59, 64],
}
GTR_HIGH = {
    'D': [50, 57, 62, 66, 69], 'Dadd9': [57, 62, 64, 66, 69], 'A': [57, 61, 64, 69], 'Bm': [59, 62, 66, 71],
    'G': [55, 59, 62, 67], 'F#m': [54, 61, 66, 69], 'Em7': [52, 59, 62, 67], 'F#m7': [54, 61, 64, 69],
    'Asus4': [57, 62, 64, 69], 'C': [48, 55, 60, 64, 67], 'Bm7': [54, 57, 62, 66], 'Gmaj7': [55, 59, 62, 66],
    'D/F#': [54, 57, 62, 66], 'E': [52, 59, 64, 68, 71], 'B': [59, 63, 66, 71], 'C#m': [61, 64, 68, 73],
    'Eadd9': [52, 59, 64, 66, 68, 71],
}
BASS = {'D': 38, 'Dadd9': 38, 'A': 33, 'Bm': 35, 'G': 31, 'F#m': 30, 'Em7': 40, 'F#m7': 42, 'Asus4': 33, 'C': 36,
        'Bm7': 35, 'Gmaj7': 31, 'D/F#': 30, 'E': 40, 'B': 35, 'C#m': 37, 'Eadd9': 28}
ORGAN = {'D': [57, 62, 66], 'Dadd9': [57, 62, 64, 66], 'A': [57, 61, 64], 'Bm': [59, 62, 66], 'G': [59, 62, 67], 'F#m': [57, 61, 66],
         'Em7': [59, 62, 64, 67], 'F#m7': [57, 61, 64, 66], 'Asus4': [57, 62, 64], 'C': [55, 60, 64], 'Bm7': [57, 62, 66],
         'Gmaj7': [59, 62, 66], 'D/F#': [57, 62, 66], 'E': [59, 64, 68], 'B': [59, 63, 66], 'C#m': [61, 64, 68], 'Eadd9': [59, 64, 66, 68]}
CHORD_PCS = {  # for the analysis (chroma check)
    'D': [2, 6, 9], 'Dadd9': [2, 6, 9, 4], 'A': [9, 1, 4], 'Bm': [11, 2, 6], 'G': [7, 11, 2], 'F#m': [6, 9, 1], 'Em7': [4, 7, 11, 2],
    'F#m7': [6, 9, 1, 4], 'Asus4': [9, 2, 4], 'C': [0, 4, 7], 'Bm7': [11, 2, 6, 9], 'Gmaj7': [7, 11, 2, 6], 'D/F#': [2, 6, 9],
    'E': [4, 8, 11], 'B': [11, 3, 6], 'C#m': [1, 4, 8], 'Eadd9': [4, 8, 11, 6]}

# ============================================================================ MELODIES  (bar offset, step, length in 16ths, midi[, vel])
HOOK = [  # D major over D | A | Bm | G ; rhythm cell 8th-16th-long = 同-一-刻 / 另-一-面
    (0, 0, 2, 86), (0, 2, 1, 90), (0, 3, 7, 93), (0, 10, 2, 90), (0, 12, 2, 93), (0, 14, 2, 95),
    (1, 0, 2, 93), (1, 2, 1, 90), (1, 3, 9, 88), (1, 12, 2, 85), (1, 14, 2, 86),
    (2, 0, 2, 86), (2, 2, 1, 90), (2, 3, 7, 95), (2, 10, 2, 93), (2, 12, 2, 90), (2, 14, 2, 88),
    (3, 0, 3, 91), (3, 3, 3, 90), (3, 6, 2, 88), (3, 8, 4, 86),
]
HOOK_PICKUP = [(3, 12, 2, 81), (3, 14, 2, 83)]          # A5 B5 into the repeat
HOOK_SYLLABLES = {(0, 0): '同', (0, 2): '一', (0, 3): '刻', (1, 0): '另', (1, 2): '一', (1, 3): '面'}
B_MEL = [  # over D | Bm | G | A (second half of GROOVE_B), bouncy, lower
    (0, 0, 1.5, 81), (0, 2, 1, 86), (0, 3, 2, 90), (0, 6, 2, 88), (0, 8, 4, 86), (0, 13, 1, 86), (0, 14, 2, 88),
    (1, 0, 1.5, 90), (1, 2, 1, 90), (1, 3, 2, 88), (1, 6, 2, 86), (1, 8, 4, 83), (1, 14, 2, 86),
    (2, 0, 1.5, 86), (2, 2, 1, 91), (2, 3, 2, 90), (2, 6, 2, 88), (2, 8, 2, 86), (2, 10, 2, 83), (2, 12, 4, 86),
]
B_BAR3 = [(3, 0, 2, 88), (3, 2, 2, 85), (3, 4, 5, 81)]               # bar 4 steps 8-15 = glock answer
B_BAR3_END = [(3, 0, 2, 88), (3, 2, 2, 90), (3, 4, 2, 91), (3, 6, 6, 93)]   # last time: climb to A6 with the glock
PAIN_GLOCK = [(0, 0, 2, 90), (0, 2, 1, 88), (0, 3, 9, 86), (1, 8, 6, 83),
              (2, 0, 2, 93), (2, 2, 1, 90), (2, 3, 9, 88), (3, 8, 6, 86),
              (4, 0, 2, 90), (4, 2, 1, 88), (4, 3, 5, 86), (4, 8, 8, 83), (5, 8, 6, 86)]
D_SCALE = [2, 4, 6, 7, 9, 11, 13]   # D major pitch classes as offsets from C (13 = C#)


def harmony_below(m, chord_name):
    """highest chord tone at least a minor third below m (chord-aware second whistle)"""
    pcs = set(CHORD_PCS[chord_name])
    for d in range(3, 10):
        if (m - d) % 12 in pcs:
            return m - d
    return m - 3


def diatonic_third_below(m, key_root=62):
    """a diatonic third below in the major key whose tonic is key_root (pitch class)"""
    pcs = sorted([(key_root + s) % 12 for s in [0, 2, 4, 5, 7, 9, 11]])
    cand = [m - k for k in (3, 4)]
    for c in cand:
        if c % 12 in pcs:
            return c
    return m - 3


# ============================================================================ TRACKS + EVENT LOG
TR = {k: Track(TOTAL_S, k) for k in [
    'kick', 'snare', 'clap', 'hats', 'tamb', 'shaker', 'cym', 'toms',
    'bass', 'gtrL', 'gtrR', 'acou', 'mute', 'clean',
    'organ', 'pad', 'whistle', 'glock', 'pluck',
    'boom', 'riser', 'chime']}
EV = {'kick': [], 'snare': [], 'clap': [], 'crash': [], 'boom': [], 'whistle': [], 'gate': [], 'hits': []}
KICK_SC = []          # (time, vel) for sidechain


def hit(name, t, kind, note):
    q = round(t / BEAT, 6)                      # beats from 0 (rounded so exact downbeats never fall into the previous bar)
    EV['hits'].append(dict(name=name, time_s=round(t, 4), bar=int(q // 4) + 1, beat=round(q % 4 + 1, 3), kind=kind, note=note))


# ---------------------------------------------------------------------------- drums
def k(bar, step, v=1.0, tight=False, sc=True):
    t = at(bar, step) + hum(1.0)
    TR['kick'].add(I.kick(int(rng.integers(0, 3)), tight), t, 0.0, 0.95 * v ** 1.3)
    EV['kick'].append(round(t, 4))
    if sc:
        KICK_SC.append((t, v))


def s(bar, step, v=1.0, clap=True):
    t = at(bar, step) + hum(2.0)
    TR['snare'].add(I.snare(int(rng.integers(0, 4))), t, 0.04, 0.80 * v ** 1.4)
    EV['snare'].append(round(t, 4))
    if clap:
        TR['clap'].add(I.clap(int(rng.integers(0, 3))), t + 0.002, -0.35, 0.45 * v ** 1.3)
        TR['clap'].add(I.clap(int(rng.integers(3, 6))), t + 0.004, 0.35, 0.45 * v ** 1.3)


def ghost(bar, step, v=0.25):
    t = at(bar, sw(step)) + hum(3.0)
    TR['snare'].add(I.snare(int(rng.integers(0, 4))), t, 0.04, 0.80 * v ** 1.4)


def clap_only(bar, step, v=0.8):
    t = at(bar, step) + hum(2.0)
    TR['clap'].add(I.clap(int(rng.integers(0, 3))), t, -0.35, 0.45 * v)
    TR['clap'].add(I.clap(int(rng.integers(3, 6))), t + 0.003, 0.35, 0.45 * v)
    EV['clap'].append(round(t, 4))


def hh(bar, step, v=0.7, open_=False, pan=0.32):
    t = at(bar, sw(step)) + hum(3.0)
    TR['hats'].add(I.hat(int(rng.integers(0, 4)), open_), t, pan, (0.55 if open_ else 0.42) * v * vj(0.08))


def hh_open_choked(bar, step, choke_steps=2, v=0.7, pan=0.32):
    t = at(bar, sw(step)) + hum(3.0)
    y = I.hat(int(rng.integers(0, 4)), True).copy()
    y = release_tail(y, choke_steps * STEP, 0.012)
    TR['hats'].add(y, t, pan, 0.55 * v * vj(0.08))


def tb(bar, step, v=0.6, pan=-0.45):
    t = at(bar, sw(step)) + hum(4.0)
    TR['tamb'].add(I.tamb(int(rng.integers(0, 5))), t, pan, 0.40 * v * vj(0.1))


def sh(bar, step, v=0.6, pan=-0.45):
    t = at(bar, sw(step)) + hum(4.0)
    TR['shaker'].add(I.shaker(int(rng.integers(0, 4))), t, pan, 0.42 * v * vj(0.1))


def cr(bar, step=0.0, v=1.0, both=True, choke=None, t=None):
    t = at(bar, step) if t is None else t
    for side, var in ((-0.55, 0), (0.55, 1)) if both else ((0.45, 2),):
        y = I.crash(var + (int(rng.integers(0, 2)) * 2 if not both else 0))
        if choke is not None:
            y = release_tail(y.copy(), choke, 0.02)
        TR['cym'].add(y, t + hum(1.5), side, 0.50 * v)
    EV['crash'].append(round(t, 4))


def tm(bar, step, which, v=0.9):
    f = {0: 82.0, 1: 110.0, 2: 147.0}[which]
    t = at(bar, step) + hum(2.0)
    TR['toms'].add(I.tom(f, int(rng.integers(0, 2))), t, {0: 0.35, 1: 0.0, 2: -0.35}[which], 0.75 * v)


def snare_roll(bar, s0, s1, v0, v1, div=1, clap_every=None):
    steps = np.arange(s0, s1, 1.0 / div)
    for i, st in enumerate(steps):
        v = v0 + (v1 - v0) * i / max(1, len(steps) - 1)
        t = at(bar, st) + hum(1.5)
        TR['snare'].add(I.snare(int(rng.integers(0, 4))), t, 0.04 * (1 if i % 2 else -1), 0.80 * v ** 1.4)


def beat_rock(bar, i, nbars, fill=False, crash=False, hats='8', tamb_on=True, open_every=2, light=False):
    """indie-pop rock beat: kick 1, (2&), 3, 3&; snare+clap 2 & 4; 8th hats; tambourine 16ths"""
    vk = 0.85 if light else 1.0
    kpat = [0, 8, 10] if i % 2 == 0 else [0, 6, 8, 10]
    if i % 4 == 3 and not fill:
        kpat = [0, 8, 10, 13]
    for st in kpat:
        if fill and st >= 12:
            continue
        k(bar, st, (1.0 if st in (0, 8) else 0.8) * vk)
    s(bar, 4, 0.95 * vk)
    if not fill:
        s(bar, 12, 1.0 * vk)
    if rng.random() < 0.5:
        ghost(bar, 7, 0.18)
    if rng.random() < 0.35 and not fill:
        ghost(bar, 15, 0.16)
    if crash:
        cr(bar, 0, 0.95)
    for st in range(0, 16, 2):
        if fill and st >= 12:
            break
        if crash and st == 0:
            continue
        if open_every and st == 14 and i % open_every == open_every - 1 and not fill:
            hh_open_choked(bar, st, 2.0, 0.75)
        else:
            hh(bar, st, 0.85 if st % 4 == 0 else 0.6)
    if tamb_on:
        for st in range(16):
            if fill and st >= 12:
                break
            tb(bar, st, 0.75 if st % 4 == 2 else (0.5 if st % 2 == 0 else 0.3))
    if fill:
        # 16th fill on beat 4: snare snare tom tom
        for st, w, v in ((12, 's', 0.7), (13, 's', 0.6), (14, 1, 0.85), (15, 0, 0.95)):
            if w == 's':
                s(bar, st, v, clap=False)
            else:
                tm(bar, st, w, v)
        k(bar, 12, 0.7)


def beat_four(bar, i, nbars, fill=False, crash=False, big=False, tamb_on=True):
    """four-on-the-floor disco-punk: kick quarters, snare+clap 2&4, open hats on the off-beats, 16th tambourine"""
    for st in (0, 4, 8, 12):
        if fill and st == 12:
            k(bar, 12, 0.85)
            continue
        k(bar, st, 1.0 if st in (0, 8) else 0.92)
    s(bar, 4, 0.95)
    if not fill:
        s(bar, 12, 1.0)
    if crash:
        cr(bar, 0, 1.0)
    for st in (2, 6, 10, 14):
        if fill and st == 14:
            continue
        hh_open_choked(bar, st, 1.6, 0.72 if not big else 0.8)
    for st in (0, 4, 8, 12):
        if crash and st == 0:
            continue
        if not (fill and st == 12):
            hh(bar, st, 0.45)
    if tamb_on:
        for st in range(16):
            if fill and st >= 12:
                break
            tb(bar, st, 0.8 if st % 4 == 2 else (0.5 if st % 2 == 0 else 0.32))
    if big and i % 2 == 1 and not fill:
        clap_only(bar, 15, 0.45)
    if rng.random() < 0.4 and not fill:
        ghost(bar, 7, 0.16)
    if fill:
        for st, w, v in ((12, 's', 0.75), (13, 2, 0.8), (14, 1, 0.9), (15, 0, 1.0)):
            if w == 's':
                s(bar, st, v, clap=False)
            else:
                tm(bar, st, w, v)


def beat_half(bar, i):
    """half-time: kick on 1 (+ soft 3& on even bars), snare (big room) on 3, quarter hats, soft shaker"""
    k(bar, 0, 0.9)
    if i % 2 == 1:
        k(bar, 10, 0.6)
    s(bar, 8, 0.9, clap=False)
    clap_only(bar, 8, 0.45)
    for st in (0, 4, 8, 12):
        hh(bar, st, 0.35 if st != 8 else 0.25, pan=0.25)
    for st in range(2, 16, 4):
        sh(bar, st, 0.35)


# ---------------------------------------------------------------------------- guitars (per-string voices with choke)
class Guitar:
    """collects plucks per string slot and renders with re-pluck / choke cut-offs"""
    def __init__(self, track, kind='elec', pan=0.0, maxlen=3.0):
        self.tr, self.kind, self.pan, self.maxlen = track, kind, pan, maxlen
        self.notes = {i: [] for i in range(6)}      # slot -> [(t, midi, vel, choke_t or None)]
        self.mutes = []                             # times when all strings stop

    def strum(self, t, voicing, direction='D', vel=1.0, spread=0.016, choke=None, top=None, layer=None):
        vs = list(voicing)
        slots = list(range(6 - len(vs), 6))
        pairs = list(zip(slots, vs))
        if direction == 'U':
            pairs = pairs[::-1]
            if top:
                pairs = pairs[:top]
        elif top:
            pairs = pairs[-top:]
        nn = len(pairs)
        for j, (slot, m) in enumerate(pairs):
            tj = t + spread * j / max(1, nn - 1) * (1 + rng.uniform(-0.2, 0.2)) + hum(1.0)
            v = vel * (1 - 0.12 * j / max(1, nn - 1)) * vj(0.07)
            self.notes[slot].append((tj, m, v, None if choke is None else t + choke, layer))
        if direction == 'D' and not top:
            for slot in range(0, 6 - len(vs)):        # unused low strings muted on a full downstroke
                self.notes[slot].append((t, None, 0, None, None))

    def pick(self, t, slot, m, vel=1.0, choke=None, layer=None):
        self.notes[slot].append((t + hum(1.5), m, vel, None if choke is None else t + choke, layer))

    def mute_all(self, t):
        self.mutes.append(t)

    def render(self):
        mutes = sorted(self.mutes)
        for slot, lst in self.notes.items():
            lst.sort(key=lambda x: x[0])
            for idx, (t, m, v, ch, layer) in enumerate(lst):
                if m is None:
                    continue
                nxt = lst[idx + 1][0] if idx + 1 < len(lst) else t + self.maxlen
                end = min(nxt, t + self.maxlen)
                if ch is not None:
                    end = min(end, ch)
                for mt in mutes:
                    if mt > t:
                        end = min(end, mt)
                        break
                L = max(0.02, end - t)
                natural = (end >= t + self.maxlen - 1e-6)
                if layer is None:
                    layer = 3 if v > 0.9 else (2 if v > 0.65 else (1 if v > 0.4 else 0))
                y = I.string_note(m, self.maxlen if self.kind != 'mute' else 0.6, self.kind, layer, int(rng.integers(0, 3)))
                rel = 0.012 if self.kind != 'ac' else 0.02
                if natural:
                    rel = 0.35
                    L = max(0.02, L - 1.6)
                y = release_tail(y, L, rel)
                self.tr.add(y, t, self.pan, v)


GL = Guitar(TR['gtrL'], 'elec', -0.85, maxlen=4.5)
GR = Guitar(TR['gtrR'], 'elec', 0.85, maxlen=4.5)
AC = Guitar(TR['acou'], 'ac', 0.12, maxlen=2.5)
MU = Guitar(TR['mute'], 'mute', -0.45, maxlen=0.6)
CL = Guitar(TR['clean'], 'clean', 0.25, maxlen=3.5)

DRIVE8 = [(0, 'D', 1.0), (2, 'U', 0.62), (4, 'D', 0.86), (6, 'U', 0.66), (8, 'D', 0.95), (10, 'U', 0.62), (12, 'D', 0.86), (14, 'U', 0.72)]
CHOP_B = [(0, 'D', 0.92, None), (3, 'U', 0.55, 1.0), (6, 'D', 0.88, None), (8, 'D', 0.6, 1.0), (10, 'U', 0.82, None), (12, 'D', 0.7, 1.0), (14, 'U', 0.86, None)]


def gtr_drive(bar, ch, vel=1.0, which=('L', 'R'), upto=16, pattern=DRIVE8):
    for st, d, v in pattern:
        if st >= upto:
            continue
        t = at(bar, st)
        if 'L' in which:
            GL.strum(t + hum(2), GTR_OPEN[ch], d, v * vel, 0.016 if d == 'D' else 0.012, top=4 if d == 'U' else None)
        if 'R' in which:
            GR.strum(t + 0.006 + hum(2), GTR_HIGH[ch], d, v * vel * 0.95, 0.012, top=3 if d == 'U' else None)


def gtr_chop(bar, ch, vel=1.0):
    for st, d, v, chk in CHOP_B:
        t = at(bar, st)
        GL.strum(t + hum(2), GTR_OPEN[ch], d, v * vel, 0.014, choke=None if chk is None else chk * STEP, top=4 if d == 'U' else None)
        GR.strum(t + 0.005 + hum(2), GTR_HIGH[ch], d, v * vel * 0.95, 0.011, choke=None if chk is None else chk * STEP, top=3 if d == 'U' else None)


def gtr_ring(bar, ch, vel=1.0, step=0.0, spread=0.045, choke=None):
    t = at(bar, step)
    GL.strum(t, GTR_OPEN[ch], 'D', vel, spread, choke=choke)
    GR.strum(t + 0.008, GTR_HIGH[ch], 'D', vel * 0.95, spread * 0.8, choke=choke)


def acoustic16(bar, ch, vel=0.8, upto=16):
    acc = [1.0, 0.42, 0.75, 0.5, 0.9, 0.42, 0.75, 0.55, 1.0, 0.42, 0.75, 0.5, 0.9, 0.42, 0.78, 0.6]
    for st in range(min(16, upto)):
        d = 'D' if st % 2 == 0 else 'U'
        v = acc[st] * vel
        ghost_ = acc[st] < 0.45
        t = at(bar, sw(st)) + hum(2.5)
        AC.strum(t, GTR_OPEN[ch], d, v, 0.010 if d == 'D' else 0.008, choke=0.05 if ghost_ else None, top=3 if d == 'U' else (4 if v < 0.8 else None))


def mute8(bar, ch, vel=0.8):
    root = GTR_OPEN[ch][0]
    fifth = root + 7
    for st in range(0, 16, 2):
        t = at(bar, st)
        v = vel * (1.0 if st % 4 == 0 else 0.75)
        MU.pick(t, 0, root, v * vj(0.05), choke=0.17)
        MU.pick(t + 0.004, 1, fifth, v * 0.8 * vj(0.05), choke=0.17)
        MU.pick(t + 0.008, 2, root + 12, v * 0.6 * vj(0.05), choke=0.17)


def clean_arp(bar, ch, vel=0.7):
    vs = GTR_OPEN[ch]
    order = [0, 2, 3, len(vs) - 1, 3, 2]
    steps = [0, 3, 6, 8, 11, 14]
    for st, o in zip(steps, order):
        m = vs[min(o, len(vs) - 1)]
        CL.pick(at(bar, st), min(5, o + (6 - len(vs))), m, vel * (1.0 if st in (0, 8) else 0.8) * vj(0.06))


# ---------------------------------------------------------------------------- bass
def bnote(bar, step, midi, length_steps, vel=1.0, layer=2, rel=0.018):
    t = at(bar, step) + hum(1.0)
    y = I.bass_note(midi, length_steps * STEP * 0.9, 1.0, int(rng.integers(0, 3)), layer, rel)
    TR['bass'].add(y, t, 0.0, 0.9 * vel)


KEY_PCS = [set([2, 4, 6, 7, 9, 11, 1])]          # D major (the lift sets E major)


def bass_root8(bar, root, nxt_root=None, vel=1.0, upto=16, approach=True):
    for st in range(0, min(16, upto), 2):
        m = root
        if approach and st == 14 and nxt_root is not None and nxt_root != root:
            if nxt_root > root:
                m = nxt_root - 1                                  # chromatic leading tone from below
            else:
                m = nxt_root + 2 if (nxt_root + 2) % 12 in KEY_PCS[0] else nxt_root + 1
            m = root + 12 if abs(m - root) > 7 else m
        v = (1.0 if st == 0 else 0.86 if st % 4 == 0 else 0.78) * vel
        bnote(bar, st, m, 1.75, v, layer=3 if st == 0 else 2)


def bass_octave8(bar, root, vel=1.0, upto=16):
    for st in range(0, min(16, upto), 2):
        m = root + (12 if st % 4 == 2 else 0)
        v = (1.0 if st % 4 == 0 else 0.78) * vel
        bnote(bar, st, m, 1.6, v, layer=3 if st % 4 == 0 else 2)


# ---------------------------------------------------------------------------- keys / leads
def organ_chord(bar, ch, step, length_steps, vel=0.5, transpose=0):
    t = at(bar, step) + hum(1.5)
    for j, m in enumerate(ORGAN[ch]):
        TR['organ'].add(I.organ(m + transpose, length_steps * STEP, j), t + 0.002 * j, -0.2 + 0.2 * j, vel)


def organ_stabs(bar, ch, vel=0.45):
    for st in (2, 6, 10, 14):
        organ_chord(bar, ch, sw(st), 0.9, vel * vj(0.05))


def pad(bar, ch, nbars=1, vel=0.5, extra_top=False, attack=0.5, cutoff=2400):
    root = 48 + CHORD_PCS[ch][0]
    root = root - 12 if root > 54 else root
    ms = sorted(set([root, root + 7] + ORGAN[ch] + ([ORGAN[ch][-1] + 12] if extra_top else [])))
    y = I.pad_chord(ms, nbars * BAR, attack=attack, release=1.0, cutoff=cutoff, seed=bar)
    TR['pad'].add(y, at(bar), 0.0, vel)


def melody(phrase_bar, notes, track='whistle', vel=1.0, transpose=0, seed=0, detune=0.0, glock_double=None, glock_oct=0,
           syll=False, glock_vel=0.5, log=True):
    """notes: (bar offset, step, len16, midi[, vel]); renders a whistle line (one continuous voice) and optional glock doubling"""
    t0 = at(phrase_bar)
    LEAD = 0.05
    wl = []
    for nt in notes:
        bo, st, ln, m = nt[:4]
        v = nt[4] if len(nt) > 4 else 1.0
        ts = bo * BAR + sw(st) * STEP + hum(4.0)
        wl.append((ts + LEAD, ln * STEP * 0.96, m + transpose, v * vj(0.04)))
        if log and track == 'whistle':
            e = dict(time_s=round(t0 + bo * BAR + st * STEP, 4), midi=m + transpose, len_s=round(ln * STEP, 3))
            if syll and (bo % 4, st) in HOOK_SYLLABLES and bo % 4 < 2:
                e['syllable'] = HOOK_SYLLABLES[(bo % 4, st)]
            EV['whistle'].append(e)
        if glock_double is not None:
            g = I.glock(m + transpose + 12 * glock_oct, 2, int(rng.integers(0, 3)))
            TR['glock'].add(g, t0 + ts, 0.25, glock_vel * v)
    if track == 'whistle':
        dur = max(ts + l for ts, l, _, _ in wl) + 0.6
        y = I.whistle_line(wl, dur, seed=seed, detune_cents=detune)
        TR['whistle'].add(y, t0 - LEAD, 0.0 if detune == 0 else (-0.25 if detune < 0 else 0.25), 0.55 * vel)


def glock_notes(bar, notes, vel=0.6, pan=0.3, layer=2, oct_=0):
    for nt in notes:
        bo, st, ln, m = nt[:4]
        v = nt[4] if len(nt) > 4 else 1.0
        TR['glock'].add(I.glock(m + 12 * oct_, layer, int(rng.integers(0, 3))), at(bar + bo, sw(st)) + hum(2), pan, vel * v)


def pluck_arp(bar, ch, vel=0.5, octave=0, pattern=None, upto=16):
    vs = ORGAN[ch]
    root = BASS[ch] + 24
    tones = sorted(set([root] + [m + 12 for m in vs]))
    pat = pattern or [0, 1, 2, 3, 2, 1, 3, 2, 0, 1, 2, 3, 2, 3, 1, 2]
    for st in range(min(16, upto)):
        m = tones[pat[st] % len(tones)] + 12 * octave
        v = vel * (1.0 if st % 4 == 0 else 0.7 if st % 2 == 0 else 0.55)
        TR['pluck'].add(I.synth_pluck(int(m), 0.4, int(rng.integers(0, 2))), at(bar, sw(st)) + hum(1.5), 0.35 if st % 2 else -0.35, v)


# ---------------------------------------------------------------------------- fx
def impact(bar, size=1.0, name='impact', note=''):
    t = at(bar)
    TR['boom'].add(I.boom(3.2 if size > 0.8 else 2.2, 120.0, 33.0, 0.11, 0.9 if size > 0.8 else 0.5, seed=bar), t, 0.0, 0.95 * size)
    EV['boom'].append(round(t, 4))
    KICK_SC.append((t, 1.6 * size))
    hit(name, t, 'impact', note)


def riser_into(bar, nbars, gain=0.5, step_end=0.0, seed=0):
    """riser starting nbars before `bar`, ending step_end 16ths relative to the bar line (negative = earlier)"""
    dur = nbars * BAR + step_end * STEP
    t0 = at(bar) - nbars * BAR
    y = I.riser(dur, seed=seed)
    y = fade(y, 0.0, 0.006)
    TR['riser'].add(y, t0, 0.0, gain)


def rev_crash_into(bar, gain=0.5, length=1.9):
    y = I.reverse_crash(length)
    TR['riser'].add(y, at(bar) - length, 0.0, gain)


def gate(t0, t1, name):
    """complete silence between t0 and t1 for every stem except the hit that follows (applied in the mix)"""
    EV['gate'].append((t0, t1, name))


# ============================================================================ ARRANGEMENT
def chord(bar):
    return BAR_INFO[bar][2]


def next_chord(bar):
    return BAR_INFO[bar + 1][2] if bar + 1 in BAR_INFO else None


def arrange():
    # ---------------- HOOK (cold open)
    f, n = SECTION['HOOK']
    hit('music_in', 0.0, 'start', 'cold open: band + whistle hook start on the first frame')
    cr(f, 0, 0.8)
    for i in range(n):
        b = f + i
        ch = chord(b)
        last = i == n - 1
        if not last:
            beat_rock(b, i, n, crash=False)
            gtr_drive(b, ch, 0.95)
            bass_root8(b, BASS[ch], BASS.get(next_chord(b)), 0.95)
        else:
            # hard stop: groove until beat 3, 16th snare pickup, unison stab on beat 3.5 (step 10), dead silence from step 11
            for st in (0, 8):
                k(b, st, 1.0)
            s(b, 4, 0.95)
            for st in range(0, 8, 2):
                hh(b, st, 0.7)
            for st in range(0, 8):
                tb(b, st, 0.6 if st % 2 == 0 else 0.35)
            s(b, 8, 0.7, clap=False); s(b, 9, 0.85, clap=False)
            k(b, 10, 1.0); s(b, 10, 1.0); cr(b, 10, 0.9, choke=0.16)
            gtr_drive(b, ch, 0.95, upto=9)
            GL.strum(at(b, 10), GTR_OPEN[ch], 'D', 1.0, 0.010, choke=0.75 * STEP)
            GR.strum(at(b, 10) + 0.004, GTR_HIGH[ch], 'D', 1.0, 0.008, choke=0.75 * STEP)
            bass_root8(b, BASS[ch], None, 0.95, upto=9, approach=False)
            bnote(b, 10, BASS[ch], 0.7, 1.0, 3)
            gate(at(b, 11.0), at(b + 1) - 0.0015, 'hard_stop')
            hit('hard_stop_stab', at(b, 10), 'stab', 'unison stab on beat 3.5, then silence until the title impact')
    hook_cold = [x for x in HOOK if not (x[0] == 3 and x[1] == 8)] + [(3, 8, 2.4, 86)]
    melody(f, hook_cold, 'whistle', 1.0, seed=1, glock_double=True, glock_vel=0.32, syll=True)

    # ---------------- TITLE
    f, n = SECTION['TITLE']
    impact(f, 1.0, 'title_impact', 'TITLE: biggest boom of the intro; chord rings for 2 bars')
    k(f, 0, 1.0)
    cr(f, 0, 1.0)
    gtr_ring(f, 'Dadd9', 1.0, 0.0, 0.05)
    bnote(f, 0, 38, 12, 1.0, 3, rel=0.7)             # D2 under the boom, decays naturally
    organ_chord(f, 'Dadd9', 0, 30, 0.35)
    pad(f, 'Dadd9', 2, 0.45, extra_top=True, attack=0.05)
    TR['glock'].add(I.glock(98, 3, 0), at(f) + 0.01, 0.2, 0.55)
    # tagline pop on the 2nd bar: two glock notes + soft clap
    glock_notes(f + 1, [(0, 0, 2, 93, 1.0), (0, 2, 2, 98, 1.0)], vel=0.55, pan=0.15, layer=3)
    clap_only(f + 1, 0, 0.35)
    hit('tagline_pop', at(f + 1), 'pop', 'glock pop (A6, D7) for the tagline 同一刻，另一面。')

    # ---------------- PAIN (half-time, sparse)
    f, n = SECTION['PAIN']
    hit('pain_start', at(f), 'section', 'half-time groove starts (kick on 1, snare on 3 of every bar)')
    for i in range(n):
        b = f + i
        ch = chord(b)
        beat_half(b, i)
        clean_arp(b, ch, 0.78)
        bnote(b, 0, BASS[ch], 11, 0.9, 1)
        bnote(b, 11, BASS[ch] + 12 if i % 2 == 0 else BASS[ch] + 7, 4, 0.6, 1)
        pad(b, ch, 1, 0.36, attack=0.7, cutoff=1500)
    glock_notes(f, PAIN_GLOCK, vel=0.52, pan=0.35, layer=1)
    lb = f + n - 1
    s(lb, 14, 0.45, clap=False); s(lb, 15, 0.6, clap=False)

    # ---------------- WHATIF (build into the drop)
    f, n = SECTION['WHATIF']
    hit('whatif', at(f), 'section', 'build starts (four-on-the-floor + snare roll + riser)')
    for i in range(n):
        b = f + i
        ch = chord(b)
        if i == 0:
            for st in (0, 4, 8, 12):
                k(b, st, 0.78)
            snare_roll(b, 8, 16, 0.35, 0.55, div=0.5)
            for st in range(0, 16, 2):
                hh(b, st, 0.55)
            for st in (0, 4, 8, 12):
                GL.strum(at(b, st), GTR_OPEN[ch], 'D', 0.6 + 0.04 * st / 4, 0.02, choke=3.2 * STEP)
                GR.strum(at(b, st) + 0.006, GTR_HIGH[ch], 'D', 0.6 + 0.04 * st / 4, 0.016, choke=3.2 * STEP)
            bass_root8(b, BASS[ch], None, 0.75, approach=False)
        else:
            # first half: full build; second half: kick + bass + low guitar drop out (lift-off), only the
            # high guitar 16ths, the 32nd snare roll, riser and reverse crash -> the drop restores the low end
            k(b, 0, 0.88); k(b, 4, 0.9)
            snare_roll(b, 0, 8, 0.5, 0.75, div=1)
            snare_roll(b, 8, 16, 0.65, 0.88, div=2)
            for st in range(0, 8, 2):
                GL.strum(at(b, st), GTR_OPEN[ch], 'D', 0.75 + 0.2 * st / 8, 0.014, choke=1.6 * STEP)
            for st in range(0, 16, 1 if True else 2):
                if st < 8 or st % 1 == 0:
                    GR.strum(at(b, st) + 0.006, GTR_HIGH[ch], 'D' if st % 2 == 0 else 'U', 0.6 + 0.4 * st / 16, 0.010, choke=0.8 * STEP, top=None if st % 2 == 0 else 3)
            for st in range(0, 8):
                bnote(b, st, BASS[ch], 0.8, 0.7 + 0.25 * st / 8, 2)
            for st in range(8, 16, 2):
                hh(b, st, 0.5 + 0.3 * (st - 8) / 8)
        pad(b, ch, 1, 0.25 + 0.1 * i, attack=0.3, cutoff=1800 + 1500 * i)
    riser_into(f + n, n, 0.42, seed=1)
    rev_crash_into(f + n, 0.45)

    # ---------------- GROOVE A (drop)
    f, n = SECTION['GROOVE_A']
    impact(f, 0.85, 'drop', 'DROP: the product appears; full groove enters on this downbeat')
    for i in range(n):
        b = f + i
        ch = chord(b)
        fill = (i % 8 == 7)
        beat_rock(b, i, n, fill=fill, crash=(i % 8 == 0))
        gtr_drive(b, ch, 1.0)
        acoustic16(b, ch, 0.7)
        bass_root8(b, BASS[ch], BASS.get(next_chord(b)), 1.0)
        if i >= 4:
            organ_stabs(b, ch, 0.42)
        if i in (1, 3, 5, 7):
            pops = [(0, 12, 2, 88), (0, 14, 2, 93)] if ch == 'A' else [(0, 12, 2, 86), (0, 14, 2, 91)]
            glock_notes(b, pops, vel=0.5, pan=0.3 if i % 4 == 1 else -0.3, layer=3)
            hit('sticker_pop', at(b, 12), 'pop', 'glock ding-ding on beat 4 (sticker-pop cue)')
    melody(f + 8, HOOK + HOOK_PICKUP, 'whistle', 0.95, seed=2, glock_double=True, glock_vel=0.30)
    melody(f + 12, HOOK, 'whistle', 0.95, seed=3, glock_double=True, glock_vel=0.30)
    hit('hook_in_groove', at(f + 8), 'melody', 'whistle hook enters (twice, 8 bars)')

    # ---------------- AI
    f, n = SECTION['AI']
    cb = AI_CHIME_BAR
    hit('ai_section', at(f), 'section', 'thinner groove for the AI step (muted guitar, 16th hats, pluck arpeggio)')
    for i in range(n):
        b = f + i
        ch = chord(b)
        if b < cb:
            for st in (0, 4, 8, 12):
                k(b, st, 0.78, tight=True)
            for st in range(16):
                hh(b, st, 0.5 if st % 4 == 0 else 0.32, pan=0.3)
            for st in range(2, 16, 4):
                sh(b, st, 0.55)
            clap_only(b, 4, 0.55)
            clap_only(b, 12, 0.62)
            mute8(b, ch, 1.15)
            for st in range(0, 16, 2):
                bnote(b, st, BASS[ch], 1.1, 0.85 if st % 4 == 0 else 0.68, 1)
            pluck_arp(b, ch, 0.85 + 0.06 * i, octave=0 if i < 2 else 1)
            pad(b, ch, 1, 0.55, attack=0.5, cutoff=1800 + 400 * i)
        else:
            fill = (b == f + n - 1)
            beat_rock(b, i, n, fill=fill, crash=False)
            gtr_drive(b, ch, 0.9)
            acoustic16(b, ch, 0.62)
            bass_root8(b, BASS[ch], BASS.get(next_chord(b)), 0.95)
            pluck_arp(b, ch, 0.34, octave=1)
    # riser into the chime
    t_ch = at(cb, AI_CHIME_BEAT * 4)
    y = I.riser(2 * BAR + AI_CHIME_BEAT * BEAT, f_lo=600, f_hi=11000, seed=2, tone=False)
    TR['riser'].add(fade(y, 0, 0.004), t_ch - len(y) / SR, 0.0, 0.40)
    # the chime: upward glock sparkle + FM bell + soft crash
    run = [74, 78, 81, 86, 90, 93, 98]
    sp = I.sparkle(run, gap=0.028, seed=4, layer=3)
    TR['chime'].add(sp, t_ch - 0.028 * (len(run) - 1), 0.1, 0.55)
    TR['chime'].add(I.bell(98, 3.5), t_ch, -0.15, 0.40)
    TR['chime'].add(I.bell(105, 3.0), t_ch + 0.004, 0.25, 0.18)
    cr(cb, AI_CHIME_BEAT * 4, 0.55, both=False)
    k(cb, AI_CHIME_BEAT * 4, 0.9)
    hit('ai_chime', t_ch, 'chime', 'AI moment: glock run lands on a bell chime; groove returns on this bar')

    # ---------------- REVEAL + build
    f, n = SECTION['REVEAL']
    hit('reveal', at(f), 'sting', 'reveal sting for 同一刻的另一面 (rising glock figure + crash)')
    cr(f, 0, 0.9)
    glock_notes(f, [(0, 0, 2, 81, 0.8), (0, 1, 2, 86, 0.9), (0, 2, 2, 90, 1.0), (0, 3, 6, 93, 1.0)], vel=0.6, pan=-0.1, layer=3)
    TR['chime'].add(I.bell(93, 3.0), at(f, 3), 0.2, 0.25)
    # prod patch (2026-10-07): the original assumed REVEAL = 8 bars (rising bass E-F#-G-A on bars 5-8); any other length crashed.
    # The build now always takes the LAST 4 bars of the section and the sting groove fills the rest.
    rev_line = [40, 42, 43, 45]
    rev_low = [31, 33, 30, 35]
    nb = max(0, n - 4)
    for i in range(n):
        b = f + i
        ch = chord(b)
        root = rev_line[i - nb] if i >= nb else rev_low[i % 4]
        if i < nb:
            k(b, 0, 1.0); k(b, 8, 0.9)
            if i % 2 == 1:
                k(b, 10, 0.7)
            s(b, 4, 0.75); s(b, 12, 0.85)
            for st in range(0, 16, 2):
                hh(b, st, 0.6 if st % 4 == 0 else 0.45)
            gtr_ring(b, ch, 0.85, 0.0, 0.04)
            for st in (6, 10, 14):
                GR.strum(at(b, st), GTR_HIGH[ch], 'U' if st != 10 else 'D', 0.55, 0.01, top=3)
            for st in range(0, 16, 2):
                bnote(b, st, root, 1.7, 0.85 if st % 4 == 0 else 0.7, 2)
            organ_chord(b, ch, 0, 15.5, 0.30 + 0.03 * i)
            pad(b, ch, 1, 0.28, attack=0.4, cutoff=2000)
        else:
            j = i - nb
            last = (i == n - 1)
            for st in (0, 4, 8, 12):
                if last and st == 12:
                    continue
                k(b, st, 0.8 + 0.06 * j)
            if j < 2:
                snare_roll(b, 0, 16, 0.38 + 0.12 * j, 0.5 + 0.12 * j, div=0.5)
            else:
                snare_roll(b, 0, 16 if not last else 12, 0.5 + 0.15 * (j - 2), 0.72 + 0.2 * (j - 2), div=1 if j == 2 else 2)
            for st in range(0, 16 if not last else 12, 2 if j < 3 else 1):
                vv = 0.6 + 0.35 * (j * 16 + st) / 64
                GL.strum(at(b, st), GTR_OPEN[ch], 'D', vv, 0.012, choke=(1.7 if j < 3 else 0.85) * STEP)
                GR.strum(at(b, st) + 0.005, GTR_HIGH[ch], 'D', vv, 0.010, choke=(1.7 if j < 3 else 0.85) * STEP)
            if j >= 2:
                acoustic16(b, ch, 0.55 + 0.1 * j, upto=16 if not last else 12)
            for st in range(0, 16 if not last else 12, 2 if j < 3 else 1):
                bnote(b, st, root, 1.6 if j < 3 else 0.85, 0.75 + 0.2 * st / 16, 2)
            organ_chord(b, ch, 0, 15.5 if not last else 11.5, 0.34 + 0.04 * j)
            pad(b, ch, 1, 0.26 + 0.05 * j, attack=0.2, cutoff=2200 + 900 * j)
    riser_into(f + n, 4, 0.62, step_end=-4.0, seed=3)        # riser ends where the gap starts
    gate(at(f + n - 1, 12), at(f + n) - 0.0015, 'payoff_gap')
    hit('build_gap', at(f + n - 1, 12), 'gap', 'one beat of silence before the payoff')

    # ---------------- GROOVE B (payoff + second groove)
    f, n = SECTION['GROOVE_B']
    impact(f, 1.0, 'payoff', 'PAYOFF: 交换已接受 -- big hit + crash, hook returns')
    for i in range(n):
        b = f + i
        ch = chord(b)
        fill = (i in (3, 11, n - 1))
        beat_four(b, i, n, fill=fill, crash=(i in (0, 4, 12)))
        if i < 4:
            gtr_drive(b, ch, 1.0)
            bass_root8(b, BASS[ch], BASS.get(next_chord(b)), 1.0)
        else:
            gtr_chop(b, ch, 0.95)
            bass_octave8(b, BASS[ch], 1.0)
            organ_chord(b, ch, 0, 15.6, 0.26)
        acoustic16(b, ch, 0.66)
        if 4 <= i < 12:
            pluck_arp(b, ch, 0.36, octave=1 if i >= 8 else 0)
            if i % 2 == 1:
                lo_, top = ORGAN[ch][-2] + 24, ORGAN[ch][-1] + 24
                glock_notes(b, [(0, 12, 2, lo_), (0, 14, 2, top)], vel=0.5, pan=0.3 if i % 4 == 1 else -0.3, layer=3)
                hit('sticker_pop', at(b, 12), 'pop', 'glock ding-ding on beat 4 (sticker-pop cue, social montage)')
    melody(f, HOOK, 'whistle', 1.0, seed=4, glock_double=True, glock_vel=0.34, glock_oct=1)
    melody(f + 12, B_MEL + B_BAR3, 'whistle', 0.95, seed=5, glock_double=None)
    melody(f + 16, B_MEL + B_BAR3_END, 'whistle', 0.95, seed=6, glock_double=None)
    # glock answers in the B section
    for rep in (0, 4):
        glock_notes(f + 12 + rep, [(3, 8, 2, 88), (3, 10, 2, 90), (3, 12, 2, 91), (3, 14, 2, 93)], vel=0.4, pan=0.4, layer=2)
    hit('social_groove', at(f + 4), 'section', 'second groove proper (octave bass, choppy guitars, synth pluck)')
    hit('whistle_b', at(f + 12), 'melody', 'whistle B-melody (8 bars)')

    # ---------------- BREAK (stop-time on C, D) into the lift
    f, n = SECTION['BREAK']
    for i in range(n):
        b = f + i
        ch = chord(b)
        for st in (0, 6, 10):
            k(b, st, 1.0)
            s(b, st, 0.9 if st else 1.0)
            GL.strum(at(b, st), GTR_OPEN[ch], 'D', 1.0, 0.012, choke=1.2 * STEP)
            GR.strum(at(b, st) + 0.004, GTR_HIGH[ch], 'D', 1.0, 0.010, choke=1.2 * STEP)
            bnote(b, st, BASS[ch], 1.1, 1.0, 3)
            organ_chord(b, ch, st, 1.0, 0.36)
        cr(b, 0, 0.95)
        if i == 0:
            for st, w in ((12, 2), (13, 2), (14, 1), (15, 0)):
                tm(b, st, w, 0.85)
        else:
            snare_roll(b, 12, 16, 0.7, 1.0, div=2)
            tm(b, 12, 1, 0.8); tm(b, 14, 0, 0.9)
    hit('break', at(f), 'stab', 'stop-time hits (beats 1, 2.5, 3.5) on C then D')
    riser_into(f + n, n, 0.5, seed=4)
    rev_crash_into(f + n, 0.6)

    # ---------------- LIFT (E major)
    KEY_PCS[0] = set([4, 6, 8, 9, 11, 1, 3])
    f, n = SECTION['LIFT']
    impact(f, 0.8, 'lift', 'LIFT: final chorus up a whole step (E major), everything in')
    for i in range(n):
        b = f + i
        ch = chord(b)
        fill = (i % 4 == 3) and i != n - 1
        beat_four(b, i, n, fill=fill, crash=(i % 4 == 0), big=True)
        if i == n - 1:  # last bar: build into the tag
            snare_roll(b, 8, 16, 0.6, 1.0, div=2)
        gtr_drive(b, ch, 1.0)
        acoustic16(b, ch, 0.72)
        bass_octave8(b, BASS[ch], 1.0) if i % 8 >= 4 else bass_root8(b, BASS[ch], BASS.get(next_chord(b)), 1.0)
        organ_chord(b, ch, 0, 15.6, 0.30)
        pad(b, ch, 1, 0.20, extra_top=True, attack=0.15, cutoff=3000)
        if i >= 8:
            pluck_arp(b, ch, 0.30, octave=1)
    for rep in range(4):
        notes = HOOK + (HOOK_PICKUP if rep < 3 else [])
        melody(f + 4 * rep, notes, 'whistle', 1.0, transpose=2, seed=10 + rep, glock_double=True, glock_vel=0.36, glock_oct=1)
        if rep >= 2:   # second whistler: chord tone a third (or fourth) below, slightly detuned and panned
            harm = [(a, b_, c, harmony_below(m + 2, chord(f + 4 * rep + a)) - 2) for (a, b_, c, m) in notes]
            melody(f + 4 * rep, harm, 'whistle', 0.62, transpose=2, seed=20 + rep, detune=-6.0, log=False)
    hit('lift_harmony', at(f + 8), 'melody', 'second whistle (harmony a third below) joins')

    # ---------------- TAG (stop-time C, D)
    f, n = SECTION['TAG']
    for i in range(n):
        b = f + i
        ch = chord(b)
        for st in (0, 3, 6):
            k(b, st, 1.0)
            s(b, st, 0.95)
            GL.strum(at(b, st), GTR_OPEN[ch], 'D', 1.0, 0.012, choke=1.4 * STEP)
            GR.strum(at(b, st) + 0.004, GTR_HIGH[ch], 'D', 1.0, 0.010, choke=1.4 * STEP)
            bnote(b, st, BASS[ch], 1.3, 1.0, 3)
            organ_chord(b, ch, st, 1.2, 0.36)
        cr(b, 0, 1.0)
        if i == 0:
            for st in range(8, 16, 2):
                tm(b, st, 2 if st < 12 else 1, 0.75)
            snare_roll(b, 8, 16, 0.4, 0.6, div=1)
        else:
            snare_roll(b, 8, 16, 0.55, 1.0, div=2)
            tm(b, 12, 1, 0.9); tm(b, 14, 0, 1.0)
    hit('tag', at(f), 'stab', 'stop-time hits on 1, 1.75, 2.5 (C then D)')
    riser_into(f + n, n, 0.45, seed=5)

    # ---------------- END
    f, n = SECTION['END']
    impact(f, 1.0, 'end_card', 'END CARD: big E chord, rings out; no drums after this hit')
    k(f, 0, 1.0)
    cr(f, 0, 1.0)
    gtr_ring(f, 'Eadd9', 1.0, 0.0, 0.06)
    AC.strum(at(f), GTR_OPEN['Eadd9'], 'D', 0.9, 0.03)
    bnote(f, 0, 28, 14, 1.0, 3, rel=1.2)
    for j, m in enumerate(ORGAN['Eadd9']):
        TR['organ'].add(I.organ(m, 4 * BAR, j, decay=2.6), at(f) + 0.002 * j, -0.2 + 0.15 * j, 0.36)
    y = I.pad_chord(sorted(set([40, 47, 52, 56, 59, 64, 66, 68, 71, 76])), 4.5 * BAR, attack=0.04, release=2.5, cutoff=3200, seed=99)
    TR['pad'].add(y, at(f), 0.0, 0.42)
    TR['glock'].add(I.glock(100, 3, 1), at(f) + 0.01, 0.2, 0.5)
    TR['chime'].add(I.bell(100, 3.5), at(f) + 0.02, -0.2, 0.25)
    # reprise of the hook cell (E major) on bars 2-3 of the end: 同一刻 | 另一面, whistle + glock
    rep = [(0, 0, 2, 88), (0, 2, 1, 92), (0, 3, 9, 95), (1, 0, 2, 95), (1, 2, 1, 92), (1, 3, 11, 90)]
    melody(f + 1, rep, 'whistle', 0.62, seed=30, glock_double=True, glock_vel=0.4, glock_oct=1)
    hit('end_reprise', at(f + 1), 'melody', 'soft whistle + glock reprise of 同一刻 | 另一面')
    TR['glock'].add(I.glock(100, 2, 2), at(f + 3), 0.0, 0.45)
    TR['glock'].add(I.glock(88, 2, 0), at(f + 3) + 0.003, -0.2, 0.30)
    TR['chime'].add(I.bell(100, 3.5), at(f + 3) + 0.004, 0.15, 0.18)
    hit('final_ding', at(f + 3), 'pop', 'final soft ding (E7 glock + bell)')


print('arranging ...', flush=True)
arrange()
print(f'  sequenced in {time.time() - T_START:.1f} s; rendering guitars ...', flush=True)
for g in (GL, GR, AC, MU, CL):
    g.render()
print(f'  guitars done at {time.time() - T_START:.1f} s', flush=True)

# ============================================================================ MIX
N = TR['kick'].n
SC = sidechain_env(N, [t for t, v in KICK_SC], depth_db=1.0, attack=0.003, release=0.11, vels=[min(1.6, v) for t, v in KICK_SC], shape=1.4)
sc_db = -db(SC)           # duck amount per sample in dB at depth 1


def duck(depth_db):
    return undb(-sc_db * depth_db)


IR_ROOM = make_ir(0.75, 0.006, 7000, 0.5, seed=11, width=0.8)
IR_PLATE = make_ir(1.9, 0.018, 6500, 0.8, seed=12, width=1.0)
IR_HALL = make_ir(3.2, 0.03, 5200, 1.2, seed=13, width=1.0, lo_rt_scale=1.1)

tr = {k: v.buf for k, v in TR.items()}


def amp_sim(x, drive=2.2, bias=0.12):
    from scipy.signal import resample_poly
    pk = np.max(np.abs(x)) + 1e-9
    y = resample_poly(x / pk, 2, 1, axis=-1)
    y = np.tanh(drive * (y + bias)) - np.tanh(drive * bias)
    y = resample_poly(y, 1, 2, axis=-1)[:, :x.shape[1]]
    y = eq(y, ('hp', 140, 0.7, 0), ('peak', 260, 1.0, -2.0), ('peak', 420, 0.9, -2.5), ('peak', 900, 0.8, -2.5), ('peak', 3300, 0.9, 3.5), ('lp', 9500, 0.7, 0))
    return y * pk / np.tanh(drive) * 0.9


def stem_drums():
    kick = eq(tr['kick'], ('peak', 360, 1.2, -3.5), ('peak', 4000, 1.0, 1.5))
    snare = eq(tr['snare'], ('hp', 80, 0.7, 0), ('peak', 900, 1.0, -1.5), ('highshelf', 5000, 0.7, 3.0))
    clap = eq(hp(tr['clap'], 300), ('peak', 2600, 1.0, 2.0))
    hats = hp(tr['hats'], 500)
    tamb = hp(tr['tamb'], 2500)
    shk = hp(tr['shaker'], 1500)
    cym = hp(tr['cym'], 300)
    toms = hp(tr['toms'], 60)
    dry = kick * 1.0 + snare * 0.85 + clap * 0.60 + hats * 0.62 + tamb * 0.52 + shk * 0.40 + cym * 0.42 + toms * 0.65
    room = reverb_send(snare * 0.8 + clap * 0.6 + toms * 0.5 + hats * 0.15 + kick * 0.05, IR_ROOM) * 0.22
    plate = reverb_send(snare * 0.6 + clap * 0.5, IR_PLATE) * 0.10
    bus = dry + room + plate
    # parallel crush for punch
    crush, _ = compressor(bus, thresh_db=-26, ratio=6, attack=0.003, release=0.08)
    bus = bus + 0.35 * np.tanh(crush * 2.0) / 2.0
    return bus


def stem_bass():
    x = eq(tr['bass'], ('hp', 32, 0.7, 0), ('peak', 90, 0.9, 1.5), ('peak', 750, 1.0, 1.0), ('lp', 5000, 0.7, 0))
    x, _ = compressor(x, thresh_db=-20, ratio=4, attack=0.004, release=0.09)
    x = soft_clip(x * 1.2, 1.2)
    m = 0.5 * (x[0] + x[1])
    x = np.stack([m, m])            # bass in mono
    return x * duck(5.0) * 0.95


def stem_guitars():
    L = amp_sim(tr['gtrL'], 2.4, 0.10)
    R = amp_sim(tr['gtrR'], 2.0, 0.14)
    mu = amp_sim(tr['mute'], 2.8, 0.1)
    ac = eq(tr['acou'], ('hp', 160, 0.7, 0), ('peak', 250, 1.0, -3.0), ('peak', 5200, 0.8, 3.0), ('highshelf', 8000, 0.7, 3.0))
    cl = eq(tr['clean'], ('hp', 100, 0.7, 0), ('peak', 3000, 0.9, 2.0))
    cl_echo = pingpong(cl, 0.75 * BEAT, fb=0.42, taps=4, lp_hz=4200, hp_hz=300)
    dry = L * 0.44 + R * 0.45 + mu * 0.62 + ac * 0.55 + cl * 0.62 + cl_echo * 0.34
    verb = reverb_send(L * 0.3 + R * 0.3 + ac * 0.3 + cl * 0.8, IR_PLATE) * 0.11
    return (dry + verb) * duck(2.5)


def stem_keys():
    org = eq(tr['organ'], ('hp', 140, 0.7, 0), ('peak', 1500, 1.0, -2.0), ('peak', 2500, 1.0, -1.5))
    org = np.tanh(org * 1.3) / 1.3
    pd = hp(tr['pad'], 140)
    dry = org * 0.55 + pd * 0.42
    verb = reverb_send(org * 0.5 + pd * 0.7, IR_HALL) * 0.18
    return dry * duck(3.0) + verb * duck(4.0)


def stem_hook():
    wh = eq(tr['whistle'], ('hp', 350, 0.7, 0), ('peak', 2400, 1.0, 1.0))
    gl = hp(tr['glock'], 500)
    pl = eq(tr['pluck'], ('hp', 220, 0.7, 0), ('lp', 9000, 0.7, 0))
    dry = wh * 1.0 + gl * 0.55 + pl * 0.62
    echo = pingpong(wh * 0.8 + pl * 0.6, 0.75 * BEAT, fb=0.35, taps=4, lp_hz=5000, hp_hz=500)
    verb = reverb_send(wh * 0.7 + gl * 0.9 + pl * 0.5, IR_PLATE) * 0.20
    return dry + echo * 0.16 + verb * duck(1.5)


def stem_fx():
    bm = lp(tr['boom'], 9000)
    rs = hp(tr['riser'], 180)
    chm = hp(tr['chime'], 300)
    dry = bm * 0.9 + rs * 0.30 + chm * 0.55
    verb = reverb_send(rs * 0.4 + chm * 0.9 + bm * 0.08, IR_HALL) * 0.22
    return dry + verb


print('mixing stems ...', flush=True)
STEMS = {}
for name, fn in [('drums', stem_drums), ('bass', stem_bass), ('guitars', stem_guitars), ('keys', stem_keys), ('hook', stem_hook), ('fx', stem_fx)]:
    STEMS[name] = fn()
    print(f'  {name:8s} peak {db(np.max(np.abs(STEMS[name]))):6.1f} dBFS  ({time.time() - T_START:.1f} s)', flush=True)

# stem balance (dB), tuned by measurement (analysis/balance.json)
BAL = dict(drums=0.0, bass=-1.0, guitars=-3.0, keys=-5.0, hook=-4.0, fx=-3.0)
BAL.update(CFG.get('balance', {}))
for kname in STEMS:
    STEMS[kname] = STEMS[kname] * undb(BAL[kname])

# gates (hard stop, payoff gap): silence everything except the hit that starts at the end of the gate
gate_g = np.ones(N)
for t0, t1, nm in EV['gate']:
    a, bb = nsamp(t0), nsamp(t1)
    r = nsamp(0.006)
    gate_g[a:bb] = 0.0
    gate_g[max(0, a - r):a] = np.minimum(gate_g[max(0, a - r):a], np.linspace(1, 0, a - max(0, a - r)))
for kname in STEMS:
    STEMS[kname] = STEMS[kname] * gate_g

mix = sum(STEMS.values())
# end: natural tail, gentle fade over the last 2.2 s to digital silence
fo = nsamp(2.2)
mix[:, -fo:] *= np.cos(np.linspace(0, np.pi / 2, fo)) ** 2
for kname in STEMS:
    STEMS[kname][:, -fo:] *= np.cos(np.linspace(0, np.pi / 2, fo)) ** 2

# ============================================================================ MASTER
print('mastering ...', flush=True)
# protective 5 ms fade-in on the first transient
fi = nsamp(0.005)
ramp = np.sin(np.linspace(0, np.pi / 2, fi)) ** 2
mix[:, :fi] *= ramp
for kname in STEMS:
    STEMS[kname][:, :fi] *= ramp

PRE_G = undb(-20.0 - integrated_lufs(mix))
pre = mix * PRE_G
glue, gr = compressor(pre, thresh_db=-21, ratio=1.8, attack=0.025, release=0.2, knee=8)
G_COMP = undb(-gr)                                   # glue gain curve (time-varying scalar, same for every stem)
MASTER_EQ = (('hp', 26, 0.7, 0), ('lowshelf', 45, 0.7, -1.5), ('peak', 1400, 0.8, -1.0), ('highshelf', 8000, 0.7, 1.5))
glue = eq(glue, *MASTER_EQ)
TARGET = -16.0
CEIL = -1.6
g_db = TARGET - integrated_lufs(glue)
for it in range(4):
    y, gl = tp_limiter(glue * undb(g_db), CEIL, 0.005, 0.10)
    L = integrated_lufs(y)
    g_db += TARGET - L
    if abs(TARGET - L) < 0.03:
        break
master = y * gate_g
tp = true_peak_db(master)
I_ = integrated_lufs(master)
print(f'  master: {I_:.2f} LUFS, true peak {tp:.2f} dBTP, LRA {lra(master):.1f} LU, gain {g_db:.2f} dB, max GR {db(np.min(gl)):.2f} dB, glue GR max {np.max(gr):.1f} dB', flush=True)

os.makedirs(OUT + '/stems', exist_ok=True)
from scipy.io import wavfile
wavfile.write(OUT + '/master_float.wav', SR, master.T.astype(np.float32))
# stems through the same chain: identical glue gain curve, linear master EQ, output gain, limiter gain curve and gates
# -> the six stems sum to the master (up to float rounding)
post_gain = gl * undb(g_db) * gate_g
ssum = np.zeros_like(master)
for kname, x in STEMS.items():
    st_ = eq(x * PRE_G * G_COMP, *MASTER_EQ) * post_gain
    ssum += st_
    wavfile.write(f'{OUT}/stems/{kname}_float.wav', SR, st_.T.astype(np.float32))
print(f'  stems sum vs master: max abs diff {np.max(np.abs(ssum - master)):.2e}', flush=True)

# ============================================================================ BEATS.JSON
sections = []
for name, nb, chords, desc in FORM:
    fb, _ = SECTION[name]
    sections.append(dict(name=name, first_bar=fb, last_bar=fb + nb - 1, start_s=round(at(fb), 4), end_s=round(min(TOTAL_S, at(fb + nb)), 4),
                         chords=[BAR_INFO[fb + i][2] for i in range(nb)],
                         key=('E major' if name in ('LIFT', 'END') else 'C-D = bVI-bVII of E major (pivot into the lift)' if name == 'BREAK'
                              else 'C-D = bVI-bVII of E major' if name == 'TAG' else 'D major'), description=desc))
bar_starts = [round(at(bb), 4) for bb in range(1, LAST_BAR + 1) if at(bb) < TOTAL_S]
beats = dict(
    title='Same Moment, Other Side (Music Space doodle score)', bpm=BPM, meter='4/4', beat_s=round(BEAT, 6), bar_s=round(BAR, 6), step16_s=round(STEP, 6),
    total_s=TOTAL_S, first_downbeat_s=0.0, swing='odd 16ths of hats/tambourine/acoustic/melody are 7 % of a 16th late (8.5 ms); beats and bars are exact',
    bar_starts_s=bar_starts, beats_s=[round(i * BEAT, 4) for i in range(int(TOTAL_S / BEAT) + 1)],
    sections=sections, hits=sorted(EV['hits'], key=lambda h: h['time_s']),
    silences=[dict(name=nm, start_s=round(a, 4), end_s=round(b2, 4)) for a, b2, nm in EV['gate']],
    events=dict(kick_s=sorted(EV['kick']), snare_s=sorted(EV['snare']), extra_clap_s=sorted(EV['clap']), crash_s=sorted(set(EV['crash'])),
                impact_s=sorted(EV['boom']), whistle_notes=sorted(EV['whistle'], key=lambda e: e['time_s'])),
    chords_per_bar=[dict(bar=bb, start_s=round(at(bb), 4), chord=BAR_INFO[bb][2], section=BAR_INFO[bb][0]) for bb in range(1, LAST_BAR + 1) if at(bb) < TOTAL_S],
    master=dict(lufs_integrated=round(I_, 2), true_peak_dbtp=round(tp, 2)),
)
json.dump(beats, open(OUT + '/beats.json', 'w'), ensure_ascii=False, indent=1)
json.dump(CHORD_PCS, open(OUT + '/chord_pcs.json', 'w'))
print(f'done in {time.time() - T_START:.1f} s', flush=True)
