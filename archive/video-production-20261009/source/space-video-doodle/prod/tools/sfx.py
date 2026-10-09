#!/usr/bin/env python3
"""Sound effects, all synthesized here from noise and oscillators (no samples, no recordings, no licences needed), placed from the
scene's event log (DM.events) on the exact output time of every entrance, draw, wipe, tap ...

  PY tools/sfx.py bus <info.json> <out.wav> [--from S --to S] [--map ID]    -> SFX bus (48 kHz float) + <out>.json placement log
  PY tools/sfx.py demo <out.wav>                                            -> every sound once, 1 s apart (for measuring / reviewing)
  PY tools/sfx.py list                                                      -> sound names, default levels, which event kinds use them

Event -> sound: an event's `sfx` field wins ('none' = silent); otherwise the default sound of its kind (KIND_SFX).  Rules: at most two
sounds start within 25 ms (highest priority kept), the same sound is not retriggered within 60 ms (type-on ticks are their own sequence),
deterministic pitch/level variation per event, constant-power pan from the element's x.  Level: tools/mix.py scales the whole bus so it
sits SFX_LU (default -9) LU under the music over the rendered range (the brief: about 8-10 dB under the music).
"""
import json, os, sys, hashlib
import numpy as np
from scipy.signal import butter, sosfilt, sosfiltfilt
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
from audiolib import SR, write_wav

# ------------------------------------------------------------------------------------------------ primitives
def env(n, a, d, shape=1.0):
    t = np.arange(n) / SR; e = np.minimum(1, t / max(a, 1e-4)) * np.exp(-np.maximum(0, t - a) / max(d, 1e-4)); return e ** shape
def bp(sig, lo, hi, order=2):
    lo = max(20, lo); hi = min(SR / 2 - 100, hi)
    return sosfilt(butter(order, [lo, hi], 'bandpass', fs=SR, output='sos'), sig)
def hpf(sig, f): return sosfilt(butter(2, f, 'hp', fs=SR, output='sos'), sig)
def lpf(sig, f): return sosfilt(butter(2, f, 'lp', fs=SR, output='sos'), sig)
def glide(f0, f1, n, wave='sin', curve='geom'):
    f = np.geomspace(f0, f1, n) if curve == 'geom' else np.linspace(f0, f1, n); ph = 2 * np.pi * np.cumsum(f) / SR
    if wave == 'sin': return np.sin(ph)
    if wave == 'tri': return (2 / np.pi) * np.arcsin(np.sin(ph))
    return np.sign(np.sin(ph))
def norm(s, peak=1.0): return s / (np.abs(s).max() + 1e-12) * peak
def sweep_bp(noise, f0, f1, q=1.6, seg_ms=8):
    """time-varying band-pass by overlapping segments (centre f0 -> f1 geometric)"""
    n = len(noise); out = np.zeros(n); seg = int(seg_ms * SR / 1000); win = np.hanning(2 * seg)
    for i in range(0, n, seg):
        k = i / max(1, n - 1); c = f0 * (f1 / f0) ** k; a = max(0, i - seg); b = min(n, i + seg)
        y = bp(noise[a:b], c / q, c * q); w = win[:b - a] if b - a == 2 * seg else np.hanning(b - a)
        out[a:b] += y * w
    return out
def pink(n, rng):
    w = rng.standard_normal(n); F = np.fft.rfft(w); f = np.fft.rfftfreq(n, 1 / SR); F[1:] /= np.sqrt(f[1:]); F[0] = 0
    return norm(np.fft.irfft(F, n))

# ------------------------------------------------------------------------------------------------ the sounds
# each returns a mono signal at peak ~1 (levels are applied by BASE_DB); `v` = per-event variation in [-1, 1], `st` = semitone offset
def s_pop(rng, v, st, dur=None):
    k = 2 ** ((st + v * 1.5) / 12); n = int(0.11 * SR)
    blip = glide(560 * k, 1280 * k, n) * env(n, 0.002, 0.028)
    body = glide(220 * k, 140 * k, n) * env(n, 0.001, 0.018) * 0.5
    click = hpf(rng.standard_normal(n), 3000) * env(n, 0.0002, 0.0025) * 0.35
    return norm(blip + body + click)
def s_slap(rng, v, st, dur=None):
    k = 2 ** ((st * 0.5 + v) / 12); n = int(0.22 * SR)
    snap = bp(rng.standard_normal(n), 900 * k, 5200, 2) * env(n, 0.0006, 0.016)
    flap = bp(rng.standard_normal(n), 300, 1400) * env(n, 0.002, 0.035) * 0.45
    thump = glide(120 * k, 62, n) * env(n, 0.002, 0.05) * 0.9
    return norm(snap + flap + thump)
def s_stamp(rng, v, st, dur=None):
    k = 2 ** ((st * 0.5 + v) / 12); n = int(0.28 * SR)
    thud = glide(92 * k, 55, n) * env(n, 0.002, 0.075)
    knock = glide(320 * k, 240, n) * env(n, 0.001, 0.022) * 0.45
    rub = bp(rng.standard_normal(n), 250, 2400) * env(n, 0.0005, 0.014) * 0.5
    return norm(thud + knock + rub)
def s_impact(rng, v, st, dur=None):
    n = int(0.75 * SR); k = 2 ** ((st * 0.3 + v * 0.5) / 12)
    sub = glide(72 * k, 36, n) * env(n, 0.003, 0.17)
    snap = bp(rng.standard_normal(n), 1300, 7500) * env(n, 0.0005, 0.02) * 0.55
    body = glide(240 * k, 130, n) * env(n, 0.002, 0.05) * 0.35
    paper = bp(rng.standard_normal(n), 500, 2500) * env(n, 0.001, 0.06) * 0.25
    return norm(sub + snap + body + paper)
def s_slam(rng, v, st, dur=None):          # smaller title hit (L / M lines)
    n = int(0.4 * SR); k = 2 ** ((st * 0.3 + v) / 12)
    sub = glide(110 * k, 52, n) * env(n, 0.002, 0.08)
    snap = bp(rng.standard_normal(n), 1500, 7000) * env(n, 0.0005, 0.014) * 0.6
    return norm(sub + snap)
def s_boom(rng, v, st, dur=None):
    n = int(1.3 * SR)
    sub = glide(64, 31, n) * env(n, 0.004, 0.34)
    air = bp(rng.standard_normal(n), 1800, 9000) * env(n, 0.003, 0.2) * 0.22
    body = glide(170, 85, n) * env(n, 0.003, 0.09) * 0.4
    return norm(sub + air + body)
def nb_noise(rng, centre, bw):
    """narrow-band noise on a time-varying centre frequency (array, Hz): low-passed complex noise shifted to the centre"""
    n = len(centre); sos = butter(2, bw, 'lp', fs=SR, output='sos')
    z = sosfiltfilt(sos, rng.standard_normal(n)) + 1j * sosfiltfilt(sos, rng.standard_normal(n))
    return np.real(z * np.exp(1j * 2 * np.pi * np.cumsum(centre) / SR))
def s_squeak(rng, v, st, dur=None):        # felt marker on paper: a narrow noise band whose centre wobbles with the hand
    L = float(np.clip(dur or 0.24, 0.12, 0.55)); n = int(L * SR); t = np.arange(n) / SR
    c = 2500 * 2 ** (v * 0.25) + 260 * np.sin(2 * np.pi * (6 + 2 * v) * t) + 110 * np.sin(2 * np.pi * 17 * t + 1.3)
    tone = nb_noise(rng, c, 90) + 0.5 * nb_noise(rng, 2 * c, 140)
    grit = bp(rng.standard_normal(n), 3000, 8000) * 0.15
    e = np.minimum(1, t / 0.025) * np.minimum(1, (L - t) / 0.06) ** 1.2 * (0.75 + 0.25 * np.sin(2 * np.pi * 9 * t))
    return norm((norm(tone) + grit) * e)
def s_highlighter(rng, v, st, dur=None):   # broad felt tip: lower, breathier squeak
    L = float(np.clip(dur or 0.45, 0.2, 0.7)); n = int(L * SR); t = np.arange(n) / SR
    s = sweep_bp(rng.standard_normal(n), 1300 * 2 ** (v * 0.2), 1900, q=1.25)
    e = np.minimum(1, t / 0.04) * np.minimum(1, (L - t) / 0.08)
    return norm(s * e)
def s_scribble(rng, v, st, dur=None):      # pencil scribble: zigzag strokes of graphite noise at ~11 Hz
    L = float(np.clip(dur or 0.5, 0.25, 0.9)); n = int(L * SR); t = np.arange(n) / SR
    g = bp(rng.standard_normal(n), 1800, 7000) + 0.4 * bp(rng.standard_normal(n), 600, 1800)
    rate = 10.5 + 2 * v; am = 0.35 + 0.65 * np.abs(np.sin(np.pi * rate * t + rng.uniform(0, 3))) ** 0.6
    e = np.minimum(1, t / 0.02) * np.minimum(1, (L - t) / 0.05)
    return norm(g * am * e)
def s_pencil(rng, v, st, dur=None):        # short pencil scratch / tick
    n = int(0.09 * SR); return norm(bp(rng.standard_normal(n), 2000, 7500) * env(n, 0.003, 0.025) + bp(rng.standard_normal(n), 700, 1600) * env(n, 0.002, 0.012) * 0.4)
def s_whoosh(rng, v, st, dur=None):
    L = float(np.clip(dur or 0.38, 0.18, 0.8)); n = int(L * SR); t = np.arange(n) / SR
    s = sweep_bp(pink(n, rng), 380 * 2 ** (v * 0.2), 3300, q=1.7)
    return norm(s * np.sin(np.pi * t / L) ** 1.6)
def s_swish(rng, v, st, dur=None): return s_whoosh(rng, v, st, 0.18)
def s_tick(rng, v, st, dur=None):
    n = int(0.03 * SR); k = 2 ** ((st + v) / 12)
    return norm(glide(1050 * k, 1000 * k, n) * env(n, 0.0005, 0.006) + hpf(rng.standard_normal(n), 2500) * env(n, 0.0002, 0.0015) * 0.6)
def s_click(rng, v, st, dur=None):
    n = int(0.05 * SR); return norm(bp(rng.standard_normal(n), 1500, 6500) * env(n, 0.0002, 0.003) + glide(2100, 1800, n) * env(n, 0.0005, 0.007) * 0.45)
def s_typetick(rng, v, st, dur=None):
    n = int(0.035 * SR); k = 2 ** (v * 0.15)
    return norm(bp(rng.standard_normal(n), 1800 * k, 5200 * k) * env(n, 0.0003, 0.004) + glide(1450 * k, 1400 * k, n) * env(n, 0.0004, 0.005) * 0.3)
def s_chime(rng, v, st, dur=None):         # the AI moment: a quick glock sparkle landing on a bell (partials 1, 2.76, 5.4 on C6)
    n = int(1.9 * SR); t = np.arange(n) / SR; out = np.zeros(n)
    run = [74, 78, 81, 86, 90, 93]
    for i, m in enumerate(run):
        f = 440 * 2 ** ((m - 69) / 12); i0 = int((0.03 * i) * SR); tt = t[:n - i0]
        out[i0:] += (np.sin(2 * np.pi * f * tt) + 0.3 * np.sin(2 * np.pi * 2.76 * f * tt)) * np.exp(-tt / 0.25) * 0.25
    f0 = 1046.5; i0 = int(0.03 * len(run) * SR); tt = t[:n - i0]
    bell = sum(a * np.sin(2 * np.pi * f0 * p * tt) * np.exp(-tt / d) for p, a, d in ((1, 1.0, 1.1), (2.76, 0.42, 0.55), (5.4, 0.22, 0.25), (8.93, 0.08, 0.12)))
    out[i0:] += bell
    return norm(out)
def s_swell(rng, v, st, dur=None):         # crowd-ish swell from noise: many band-limited "voices" with slow independent AM
    L = float(np.clip(dur or 2.4, 1.0, 4.0)); n = int(L * SR); t = np.arange(n) / SR; out = np.zeros(n)
    for i in range(14):
        c = rng.uniform(350, 2600); q = rng.uniform(1.3, 2.2)
        voice = bp(rng.standard_normal(n), c / q, c * q)
        am = 0.5 + 0.5 * np.sin(2 * np.pi * rng.uniform(1.5, 5.0) * t + rng.uniform(0, 6.28)) * np.sin(2 * np.pi * rng.uniform(0.3, 0.9) * t + rng.uniform(0, 6.28))
        out += voice * am * rng.uniform(0.5, 1.0)
    shape = np.sin(np.pi * np.clip(t / L, 0, 1)) ** 1.3 * np.minimum(1, t / (L * 0.55)) ** 1.5
    return norm(lpf(out, 4500) * shape)
def s_tape(rng, v, st, dur=None):
    n = int(0.2 * SR); t = np.arange(n) / SR
    s = sweep_bp(rng.standard_normal(n), 2000, 6200, q=1.4) * (0.6 + 0.4 * np.sign(np.sin(2 * np.pi * 42 * t)))
    return norm(s * env(n, 0.004, 0.09))
def s_zip(rng, v, st, dur=None):
    n = int(0.22 * SR); return norm(glide(320, 990, n, 'tri') * env(n, 0.01, 0.09) * 0.7 + bp(rng.standard_normal(n), 3000, 8000) * env(n, 0.005, 0.05) * 0.3)
def s_boop(rng, v, st, dur=None):
    n = int(0.2 * SR); k = 2 ** ((st + v) / 12); return norm(glide(440 * k, 690 * k, n) * env(n, 0.012, 0.07))
def s_crackle(rng, v, st, dur=None):       # confetti: ~30 tiny paper clicks over 0.7 s
    n = int(0.8 * SR); out = np.zeros(n)
    for i in range(30):
        t0 = rng.uniform(0, 0.7) ** 1.6; i0 = int(t0 * SR); m = int(0.012 * SR)
        g = bp(rng.standard_normal(m), rng.uniform(2000, 4500), 9000) * env(m, 0.0002, 0.002) * rng.uniform(0.3, 1.0)
        out[i0:i0 + m] += g[:len(out[i0:i0 + m])]
    return norm(out)
def s_heartbeat(rng, v, st, dur=None):
    n = int(0.45 * SR); out = np.zeros(n); m = int(0.12 * SR)
    for t0, a in ((0.0, 1.0), (0.17, 0.7)):
        i0 = int(t0 * SR); out[i0:i0 + m] += (glide(70, 45, m) * env(m, 0.004, 0.04) * a)[:len(out[i0:i0 + m])]
    return norm(out)
def s_flip(rng, v, st, dur=None):
    n = int(0.32 * SR); t = np.arange(n) / SR
    s = sweep_bp(rng.standard_normal(n), 5000, 900, q=1.5) * (0.55 + 0.45 * np.abs(np.sin(2 * np.pi * 23 * t)))
    return norm(s * np.sin(np.pi * t / 0.32) ** 0.8)
def s_riser(rng, v, st, dur=None):
    L = float(np.clip(dur or 1.6, 0.6, 4.0)); n = int(L * SR); t = np.arange(n) / SR
    s = sweep_bp(pink(n, rng), 300, 6000, q=1.5) + 0.25 * glide(220, 880, n) * (t / L) ** 2
    return norm(s * (t / L) ** 2.3)
def s_blip(rng, v, st, dur=None):
    n = int(0.07 * SR); f = 880 if v < 0 else 1320; return norm(np.sin(2 * np.pi * f * np.arange(n) / SR) * env(n, 0.002, 0.02))
def s_scratch(rng, v, st, dur=None):
    n = int(0.32 * SR); t = np.arange(n) / SR; out = np.zeros(n); base = rng.standard_normal(n); seg = int(0.005 * SR)
    for i in range(0, n, seg):
        c = 900 * 2 ** (1.4 * np.sin(2 * np.pi * 6.5 * t[i])); out[i:i + seg] = bp(base[i:i + seg], c / 1.3, c * 1.3)[:len(out[i:i + seg])]
    return norm(out * env(n, 0.005, 0.12))
def s_sparkle(rng, v, st, dur=None):
    n = int(0.6 * SR); t = np.arange(n) / SR; out = np.zeros(n)
    for i, m in enumerate((98, 103, 107)):
        f = 440 * 2 ** ((m - 69) / 12); i0 = int(i * 0.045 * SR); tt = t[:n - i0]; out[i0:] += np.sin(2 * np.pi * f * tt) * np.exp(-tt / 0.12)
    return norm(out)
def s_thump(rng, v, st, dur=None):         # punch-in zoom: low thump + a short air puff
    n = int(0.22 * SR); w = s_whoosh(rng, v, 0, 0.18); w = np.pad(w, (0, max(0, n - len(w))))[:n]
    return norm(glide(85, 48, n) * env(n, 0.002, 0.06) + 0.18 * w)
def s_ding(rng, v, st, dur=None):
    n = int(0.7 * SR); t = np.arange(n) / SR; f = 1568 * 2 ** (st / 12)
    return norm(np.sin(2 * np.pi * f * t) * np.exp(-t / 0.22) + 0.35 * np.sin(2 * np.pi * 2.76 * f * t) * np.exp(-t / 0.08))
def s_shutter(rng, v, st, dur=None):
    n = int(0.16 * SR); out = np.zeros(n)
    for t0 in (0.0, 0.07):
        i0 = int(t0 * SR); m = int(0.03 * SR); out[i0:i0 + m] += bp(rng.standard_normal(m), 1200, 6000) * env(m, 0.0003, 0.006)
    return norm(out)
def s_hmm(rng, v, st, dur=None):           # two soft plucks, a questioning interval
    n = int(0.6 * SR); t = np.arange(n) / SR; out = np.zeros(n)
    for t0, m in ((0.0, 76), (0.16, 81)):
        f = 440 * 2 ** ((m - 69) / 12); i0 = int(t0 * SR); tt = t[:n - i0]; out[i0:] += np.sin(2 * np.pi * f * tt) * np.exp(-tt / 0.15) * (1 + 0.3 * np.sin(2 * np.pi * 2 * f * tt))
    return norm(out)

SOUNDS = {k[2:]: f for k, f in globals().items() if k.startswith('s_') and callable(f)}
# relative levels (dB at peak 1.0 before the bus is scaled against the music); priority for the two-at-once rule (higher wins)
BASE_DB = dict(pop=-17, slap=-14, stamp=-14, impact=-9, slam=-12, boom=-7, squeak=-23, highlighter=-22, scribble=-21, pencil=-21, whoosh=-17, swish=-20,
               tick=-22, click=-20, typetick=-27, chime=-12, swell=-15, tape=-20, zip=-16, boop=-17, crackle=-15, heartbeat=-12, flip=-17, riser=-17,
               blip=-22, scratch=-16, sparkle=-19, thump=-12, ding=-16, shutter=-19, hmm=-17)
PRIORITY = dict(boom=10, impact=9, chime=9, slam=8, stamp=7, slap=7, crackle=6, thump=6, pop=5, zip=5, boop=5, heartbeat=5, swell=5, riser=5, scratch=5, flip=5,
                whoosh=4, swish=3, squeak=3, highlighter=3, scribble=3, pencil=3, tape=3, click=3, ding=3, sparkle=3, shutter=3, hmm=3, tick=2, blip=2, typetick=1)
KIND_SFX = dict(slam=None, pop='pop', spring='pop', stamp='stamp', slap='slap', drop='slap', rise='whoosh', slide='swish', type='typetick', swipe='highlighter',
                draw='squeak', wipe='whoosh', tap='click', confetti='crackle', punch='thump', **{'enter-slap': 'slap', 'enter-slide': 'swish'})
SILENT_KINDS = {'cut', 'fade', 'grow', 'out', 'none', 'mark', 'wipe-off'}


def h01(*a):
    return int(hashlib.md5('|'.join(map(str, a)).encode()).hexdigest()[:8], 16) / 0xFFFFFFFF


def sound_for(e):
    """event -> (sound name, extra gain dB) or None"""
    name = e.get('sfx')
    if name in ('none', False, ''):
        return None
    if name:
        return (name, 0.0) if name in SOUNDS else None
    k = e['kind']
    if k in SILENT_KINDS:
        return None
    if k == 'slam':
        sz = e.get('size') or 128
        return ('impact', 0.0) if sz >= 180 else ('slam', -2.0 if sz >= 128 else -5.0)
    s = KIND_SFX.get(k)
    return (s, 0.0) if s else None


def place(events, t0, t1, music_has=()):
    """resolve the event log to concrete sound placements in [t0, t1) (two-at-once + retrigger rules)"""
    cand = []
    skip = set()
    if 'chime' in music_has: skip.add('chime')
    if 'dings' in music_has: skip.add('ding')
    if 'riser' in music_has: skip.add('riser')
    for i, e in enumerate(events):
        r = sound_for(e)
        if not r:
            continue
        name, g = r
        if name in skip:
            continue
        if name == 'typetick':          # one soft tick per character on the type-on steps
            n = int(e.get('note') or 6); step = (e.get('dur') or 0.12 * n) / max(1, n)
            every = max(1, -(-n // 16))          # long lines (fine print): at most ~16 ticks, on every k-th character
            for c in range(0, n, every):
                cand.append(dict(t=e['t'] + c * step, sound='typetick', gain=(e.get('gain') or 0) + g - (0 if c % 2 == 0 else 2), pan=e.get('pan', 0), note=0, label=e['label'], idx=i, seq=True))
            continue
        dur = e.get('dur')
        tt = e['t'] - (0.06 if name in ('whoosh', 'swish') else 0.0)     # whooshes peak a little after their start
        cand.append(dict(t=tt, sound=name, gain=(e.get('gain') or 0) + g, pan=e.get('pan', 0), note=e.get('note') or 0, label=e['label'], idx=i, dur=dur))
    cand.sort(key=lambda c: (c['t'], -PRIORITY.get(c['sound'], 0)))
    out = []; last = {}
    i = 0
    while i < len(cand):
        grp = [cand[i]]; j = i + 1
        while j < len(cand) and cand[j]['t'] - cand[i]['t'] < 0.025:
            grp.append(cand[j]); j += 1
        grp.sort(key=lambda c: -PRIORITY.get(c['sound'], 0))
        kept = []
        for c in grp:
            if c['sound'] in [k['sound'] for k in kept] and not c.get('seq'):
                continue
            if len([k for k in kept if not k.get('seq')]) >= 2 and not c.get('seq'):
                continue
            if not c.get('seq') and c['sound'] in last and c['t'] - last[c['sound']] < 0.06:
                continue
            kept.append(c); last[c['sound']] = c['t']
        out.extend(kept); i = j
    return [c for c in out if t0 - 3.0 <= c['t'] < t1]


def render_bus(placements, t0, t1):
    n = int(round((t1 - t0) * SR)); bus = np.zeros((n + SR * 4, 2))
    for c in placements:
        seed = int(h01(c['label'], round(c['t'], 4), c['sound']) * 2 ** 31)
        rng = np.random.default_rng(seed); v = h01('v', c['label'], round(c['t'], 4)) * 2 - 1
        s = SOUNDS[c['sound']](rng, v, c.get('note', 0) % 12 if c['sound'] in ('pop', 'slap', 'stamp', 'tick', 'boop') else 0, c.get('dur'))
        s = s * 10 ** ((BASE_DB.get(c['sound'], -18) + c.get('gain', 0)) / 20)
        pan = float(np.clip(c.get('pan', 0), -0.6, 0.6)); L, R = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
        i0 = int(round((c['t'] - t0) * SR)); a = max(0, i0); b = min(len(bus), i0 + len(s))
        if b <= a:
            continue
        seg = s[a - i0:b - i0]
        bus[a:b, 0] += seg * L * 1.41; bus[a:b, 1] += seg * R * 1.41
    return bus[:n]


def main():
    a = sys.argv[1:]
    if not a:
        print(__doc__); sys.exit(1)
    if a[0] == 'list':
        inv = {}
        for k, s in KIND_SFX.items(): inv.setdefault(s, []).append(k)
        for nm in sorted(SOUNDS):
            print(f"{nm:12s} {BASE_DB.get(nm, -18):4d} dB  prio {PRIORITY.get(nm, 0)}  kinds: {', '.join(inv.get(nm, [])) or '-'}")
        return
    if a[0] == 'demo':
        names = sorted(SOUNDS); pl = [dict(t=1.0 + i * 1.2, sound=n, gain=0, pan=0, label='demo', note=0) for i, n in enumerate(names)]
        bus = render_bus(pl, 0, 2 + len(names) * 1.2); write_wav(a[1], bus, 24)
        json.dump(pl, open(a[1] + '.json', 'w'), indent=0); print('demo', a[1], len(names), 'sounds'); return
    if a[0] == 'bus':
        info = json.load(open(a[1])); out = a[2]
        opt = dict(zip(a[3::2], a[4::2]))
        t0 = float(opt.get('--from', 0)); t1 = float(opt.get('--to', info['duration']))
        music_has = []
        mid = opt.get('--map') or (info.get('map') or {}).get('id')
        if mid:
            try:
                import tempo; music_has = tempo.load_compiled(mid).get('music_has', [])
            except Exception:
                pass
        pl = place(info['events'], t0, t1, music_has)
        bus = render_bus(pl, t0, t1)
        write_wav(out, bus, 32)
        counts = {}
        for c in pl: counts[c['sound']] = counts.get(c['sound'], 0) + 1
        json.dump(dict(range=[t0, t1], music_has=music_has, counts=counts, placements=[{k: (round(v, 4) if isinstance(v, float) else v) for k, v in c.items()} for c in pl]),
                  open(out + '.json', 'w'), ensure_ascii=False, indent=0)
        print(f"sfx bus {out}: {len(pl)} sounds {counts}")
        return
    print(__doc__); sys.exit(1)


if __name__ == '__main__':
    main()
