"""Synth voices for the Music Space doodle score.  All sounds are computed here from sine waves,
filtered noise and simple physical/modal models.  No samples, no third-party audio.

Every renderer is deterministic (seeded) and cached, so a variant/velocity layer is rendered once
and re-used (round-robin variants give the human variation).
"""
import numpy as np
from scipy import signal
from dsp import SR, nsamp, mtof, hp, lp, bp, eq, fade, env_exp, polyblep_saw, wavetable, wt_osc, stft_noise_sweep

_CACHE = {}


def cached(key, fn):
    v = _CACHE.get(key)
    if v is None:
        v = fn()
        _CACHE[key] = v
    return v


def norm(y, peak=1.0):
    m = np.max(np.abs(y))
    return y * (peak / m) if m > 0 else y


def tvec(n):
    return np.arange(n) / SR


# ============================================================================ DRUMS
def kick(variant=0, tight=False):
    """punchy pop kick: 56 Hz body with a fast pitch sweep (punch at 80-150 Hz), short tail, beater click"""
    def mk():
        rng = np.random.default_rng(1100 + variant)
        n = nsamp(0.36 if not tight else 0.24)
        t = tvec(n)
        f = 56.0 + 105.0 * np.exp(-t / 0.028) + 70.0 * np.exp(-t / 0.004)
        ph = 2 * np.pi * np.cumsum(f) / SR
        hold = 0.045 if not tight else 0.03
        tail = 0.085 if not tight else 0.05
        amp = np.where(t < hold, 1.0, np.exp(-(t - hold) / tail))
        amp *= np.minimum(1.0, t / 0.0006)
        body = np.sin(ph) * amp
        body = np.tanh(2.1 * body) / np.tanh(2.1)
        click = bp(rng.standard_normal(n), 1800, 9000, 2) * np.exp(-t / 0.0022) * 0.6
        knock = np.sin(2 * np.pi * 1000 * t) * np.exp(-t / 0.005) * 0.2
        y = body + click + knock
        y = hp(y, 32, 2)
        y = eq(y, ('peak', 110, 1.1, 2.0), ('peak', 3500, 1.0, 2.5))
        return norm(fade(y, 0.0003, 0.012))
    return cached(('kick', variant, tight), mk)


def snare(variant=0):
    def mk():
        rng = np.random.default_rng(1200 + variant)
        n = nsamp(0.5)
        t = tvec(n)
        f1 = 190.0 * (1 + 0.22 * np.exp(-t / 0.012))
        body = np.sin(2 * np.pi * np.cumsum(f1) / SR) * np.exp(-t / 0.06)
        body += 0.45 * np.sin(2 * np.pi * np.cumsum(f1 * 1.72) / SR) * np.exp(-t / 0.035)
        noise = rng.standard_normal(n)
        wires = bp(noise, 1700, 9000, 2) * np.exp(-t / 0.15)
        sizzle = hp(noise, 6000, 2) * np.exp(-t / 0.06)
        crack = hp(rng.standard_normal(n), 2500, 2) * np.exp(-t / 0.0035)
        y = 0.85 * body + 0.95 * norm(wires) + 0.25 * norm(sizzle) + 0.5 * norm(crack)
        y = np.tanh(1.4 * y)
        y = eq(hp(y, 90, 2), ('peak', 220, 1.2, 2.0), ('peak', 5000, 0.9, 2.5))
        return norm(fade(y, 0.0002, 0.03))
    return cached(('snare', variant), mk)


def rim(variant=0):
    def mk():
        rng = np.random.default_rng(1250 + variant)
        n = nsamp(0.12)
        t = tvec(n)
        y = np.sin(2 * np.pi * 520 * t) * np.exp(-t / 0.012) + 0.6 * np.sin(2 * np.pi * 1660 * t) * np.exp(-t / 0.006)
        y += bp(rng.standard_normal(n), 2000, 7000, 2) * np.exp(-t / 0.003) * 0.6
        return norm(fade(hp(y, 300, 2), 0.0002, 0.01))
    return cached(('rim', variant), mk)


def clap(variant=0):
    def mk():
        rng = np.random.default_rng(1300 + variant)
        n = nsamp(0.38)
        t = tvec(n)
        noise = rng.standard_normal(n)
        env = np.zeros(n)
        offs = [0.0, 0.0085 + rng.uniform(0, 0.002), 0.0175 + rng.uniform(0, 0.002), 0.027]
        for k, o in enumerate(offs):
            i = nsamp(o)
            env[i:] += np.exp(-(t[i:] - o) / 0.0032) * (0.75 if k < 3 else 1.0)
        o = offs[-1]
        i = nsamp(o)
        env[i:] += 0.6 * np.exp(-(t[i:] - o) / 0.10)
        y = bp(noise, 850, 3400, 2) * env + 0.22 * hp(noise, 3500, 2) * env
        y = eq(y, ('peak', 1150, 1.3, 3.0))
        return norm(fade(y, 0.0002, 0.03))
    return cached(('clap', variant), mk)


_HAT_F = [205.3, 304.4, 369.6, 522.7, 540.0, 800.0]


def _metal(n, ratio, seed):
    rng = np.random.default_rng(seed)
    t = tvec(n)
    y = np.zeros(n)
    for f in _HAT_F:
        f = f * ratio * (1 + rng.uniform(-0.012, 0.012))
        ph = rng.uniform(0, 2 * np.pi)
        k = 1
        while f * k < SR * 0.46:
            y += np.sin(2 * np.pi * f * k * t + ph * k) / k
            k += 2
    return y


def hat(variant=0, open_=False):
    def mk():
        rng = np.random.default_rng(1400 + variant + (50 if open_ else 0))
        n = nsamp(0.65 if open_ else 0.11)
        t = tvec(n)
        m = _metal(n, 1.55, 1400 + variant)
        m = hp(m, 6500, 4)
        noise = hp(rng.standard_normal(n), 7500, 4)
        tau = 0.30 if open_ else 0.028
        env = np.exp(-t / tau) * np.minimum(1, t / 0.0004)
        y = (0.55 * norm(m) + 0.6 * norm(noise)) * env
        y = eq(y, ('peak', 10500, 1.0, 3.0), ('highshelf', 14000, 0.7, -4.0))
        return norm(fade(y, 0, 0.04 if open_ else 0.01))
    return cached(('hat', variant, open_), mk)


def tamb(variant=0):
    def mk():
        rng = np.random.default_rng(1500 + variant)
        n = nsamp(0.24)
        t = tvec(n)
        jing = np.zeros(n)
        for _ in range(18):
            f = np.exp(rng.uniform(np.log(4200), np.log(13000)))
            d = rng.uniform(0.025, 0.11)
            jing += np.sin(2 * np.pi * f * t + rng.uniform(0, 6.28)) * np.exp(-t / d) * rng.uniform(0.3, 1.0)
        env = np.zeros(n)
        for o, g in [(0.0, 1.0), (0.005 + rng.uniform(0, 0.004), 0.7), (0.013 + rng.uniform(0, 0.006), 0.45)]:
            i = nsamp(o)
            env[i:] += g * np.exp(-(t[i:] - o) / 0.035)
        noise = bp(rng.standard_normal(n), 5500, 15000, 2)
        y = (0.7 * norm(jing) + 0.5 * norm(noise)) * env
        y = hp(y, 3500, 2)
        return norm(fade(y, 0.0003, 0.02))
    return cached(('tamb', variant), mk)


def shaker(variant=0):
    def mk():
        rng = np.random.default_rng(1600 + variant)
        n = nsamp(0.16)
        t = tvec(n)
        att = 0.014 + rng.uniform(0, 0.006)
        env = np.where(t < att, np.sin(0.5 * np.pi * t / att) ** 2, np.exp(-(t - att) / 0.045))
        y = bp(rng.standard_normal(n), 3500, 11000, 2) * env
        return norm(fade(y, 0, 0.02))
    return cached(('shaker', variant), mk)


def crash(variant=0, length=3.8):
    """crash: ~110 inharmonic partials from 420 Hz to 15 kHz (low ones quieter, longer), broadband noise from 900 Hz, bright attack"""
    def mk():
        rng = np.random.default_rng(1700 + variant)
        n = nsamp(length)
        t = tvec(n)
        y = np.zeros(n)
        for _ in range(110):
            f = np.exp(rng.uniform(np.log(420), np.log(15500)))
            d = rng.uniform(0.6, 2.2) * (3000 / f) ** 0.3
            a = rng.uniform(0.2, 1.0) * min(1.0, (f / 2500.0) ** 0.6)
            L = min(n, int(d * 7 * SR))
            y[:L] += np.sin(2 * np.pi * f * t[:L] + rng.uniform(0, 6.28)) * np.exp(-t[:L] / d) * a
        noise = rng.standard_normal(n)
        body = bp(noise, 900, 4000, 2) * np.exp(-t / 0.55)
        wash = lp(hp(noise, 3000, 2), 15000, 2) * np.exp(-t / 1.15)
        att = hp(rng.standard_normal(n), 1500, 2) * np.exp(-t / 0.014)
        y = 0.5 * norm(y) + 0.25 * norm(body) + 0.55 * norm(wash) + 0.45 * norm(att)
        y *= np.minimum(1.0, t / 0.0008)
        y = eq(hp(y, 350, 2), ('peak', 5500, 0.8, 2.0))
        return norm(fade(y, 0, 0.6))
    return cached(('crash', variant, length), mk)


def tom(freq, variant=0):
    def mk():
        rng = np.random.default_rng(1800 + variant + int(freq))
        n = nsamp(0.55)
        t = tvec(n)
        f = freq * (1 + 0.35 * np.exp(-t / 0.05))
        y = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.22)
        y += 0.3 * np.sin(2 * np.pi * np.cumsum(f * 1.5) / SR) * np.exp(-t / 0.08)
        y += bp(rng.standard_normal(n), 800, 5000, 2) * np.exp(-t / 0.006) * 0.4
        y = np.tanh(1.4 * y)
        return norm(fade(hp(y, 50, 2), 0.0003, 0.03))
    return cached(('tom', round(freq, 2), variant), mk)


# ============================================================================ PLUCKED STRINGS (modal)
_KIND_ID = {'elec': 1, 'ac': 2, 'mute': 3, 'clean': 4, 'bass': 5}

def string_note(midi, dur, kind='elec', vel_layer=2, variant=0):
    """modal plucked-string tone.  kind: elec (bright electric, bridge+neck pickup mix), ac (acoustic steel),
    mute (palm-muted electric), clean (clean neck pickup), bass (pick bass).  vel_layer 0..3 (pick hardness)."""
    def mk():
        f0 = float(mtof(midi))
        rng = np.random.default_rng(int(midi * 1000 + vel_layer * 100 + variant * 7 + _KIND_ID[kind] * 100003))
        n = nsamp(dur)
        t = tvec(n)
        if kind == 'bass':
            T0, fc, fmax, B, beta, p = 4.5, 800.0, 6000.0, 0.00012, 0.22, 1.05
        elif kind == 'ac':
            T0, fc, fmax, B, beta, p = 3.2, 1700.0, 14000.0, 0.00008, 0.13, 0.95
        elif kind == 'mute':
            T0, fc, fmax, B, beta, p = 0.22, 900.0, 8000.0, 0.00008, 0.12, 1.15
        elif kind == 'clean':
            T0, fc, fmax, B, beta, p = 4.0, 1400.0, 9000.0, 0.00006, 0.15, 1.1
        else:  # elec
            T0, fc, fmax, B, beta, p = 3.6, 2100.0, 11000.0, 0.00006, 0.14, 0.98
        hard = [1.25, 1.0, 0.85, 0.72][vel_layer]          # spectral exponent multiplier: harder pick -> brighter
        beta = beta * (1 + rng.uniform(-0.15, 0.15))
        K = int(min(fmax, SR * 0.45) / f0)
        k = np.arange(1, K + 1)
        fk = k * f0 * np.sqrt(1 + B * k ** 2)
        Ak = np.abs(np.sin(np.pi * k * beta)) / k ** (p * hard)
        if kind in ('elec', 'mute', 'clean'):
            pu = 0.09 if kind == 'elec' else 0.22
            Ak *= 0.35 + np.abs(np.sin(np.pi * k * pu))     # pickup position comb (partial)
        if kind == 'bass':
            Ak *= 0.4 + np.abs(np.sin(np.pi * k * 0.2))
        Ak *= 10 ** (rng.normal(0, 1.5, K) / 20)                 # per-pluck spectral jitter
        T60 = T0 * (220.0 / f0) ** 0.25 / (1 + (fk / fc) ** 2)
        T60 = np.maximum(T60, 0.012)
        sig = 6.908 / T60
        y = np.zeros(n)
        ph = rng.uniform(0, 2 * np.pi, K)
        for i in range(K):
            L = min(n, int(T60[i] * 1.25 * SR) + 64)
            tt = t[:L]
            seg = Ak[i] * np.exp(-sig[i] * tt) * np.sin(2 * np.pi * fk[i] * tt + ph[i])
            if i < 3 and kind != 'mute':                     # two-polarisation beating on the lowest partials
                seg *= 1 + 0.06 * np.sin(2 * np.pi * rng.uniform(0.3, 1.2) * tt + rng.uniform(0, 6))
            y[:L] += seg
        y = norm(y)
        # pick noise (short band-passed click, louder for harder picking)
        pn = min(n, nsamp(0.012))
        noise = bp(rng.standard_normal(pn), 1500, 7000, 2) * np.exp(-tvec(pn) / 0.0025)
        y[:pn] += norm(noise) * (0.05 if kind == 'bass' else 0.12) * (0.6 + 0.25 * vel_layer)
        y *= np.minimum(1.0, t / 0.0008)
        y = fade(y, 0, min(0.02, dur * 0.1))
        return norm(y)
    return cached(('str', midi, round(dur, 3), kind, vel_layer, variant), mk)


def bass_note(midi, dur_s, vel=1.0, variant=0, layer=2, rel=0.018):
    """pick bass = modal string + sine sub + gentle drive; dur_s = held length (release appended)"""
    def mk():
        f0 = float(mtof(midi))
        L = dur_s + max(0.08, rel * 6)
        s = string_note(midi, max(0.4, L), 'bass', layer, variant)[:nsamp(L)].copy()
        n = len(s)
        t = tvec(n)
        sub = np.sin(2 * np.pi * f0 * t) * np.exp(-t / 2.2)
        y = 0.85 * s + 0.55 * sub * np.max(np.abs(s))
        y = np.tanh(1.5 * y / (np.max(np.abs(y)) + 1e-9))
        env = np.ones(n)
        k = nsamp(dur_s)
        if k < n:
            env[k:] = np.exp(-tvec(n - k) / rel)
        env *= np.minimum(1, t / 0.002)
        return norm(fade(y * env, 0, 0.005))
    key = ('bass', midi, round(dur_s, 3), variant, layer, rel)
    return cached(key, mk) * vel


# ============================================================================ WHISTLE (one continuous line per phrase)
def whistle_line(notes, total_dur, seed=0, detune_cents=0.0, vib_rate=5.3, vib_cents=15.0, breath=0.05):
    """notes: list of (t0, dur, midi, vel) relative to the line start.  Legato notes glide (portamento);
    each attack has a small upward scoop; vibrato fades in on long notes; breath noise follows the amplitude."""
    rng = np.random.default_rng(9000 + seed)
    n = nsamp(total_dur)
    t = tvec(n)
    pitch = np.zeros(n)
    amp = np.zeros(n)
    vib_amt = np.zeros(n)
    scoop = np.zeros(n)
    notes = sorted([(max(0.0, a), b, c, d) for (a, b, c, d) in notes])
    if notes:
        pitch[:] = notes[0][2]
    last_end = -1.0
    for idx, (t0, d, m, v) in enumerate(notes):
        s = nsamp(t0)
        e = min(n, nsamp(t0 + d))
        if s >= n:
            continue
        legato = (t0 - last_end) < 0.03 and idx > 0
        if legato or idx == 0:
            pitch[s:] = m                                     # hold pitch until the next note (phase continuity)
        else:                                                 # after a rest: move the (silent) pitch early, no audible glide
            pitch[min(s, nsamp(last_end + 0.06)):] = m
        att = 0.012 if legato else 0.022
        rel = 0.045
        tt = t[s:] - t0
        a = np.where(tt < att, np.sin(0.5 * np.pi * np.minimum(tt / att, 1)) ** 2, 1.0)
        # gentle decay over long notes (breath runs out a little) + release
        sus = np.exp(-np.maximum(tt - 0.25, 0) / 3.0)
        r = np.where(t[s:] < t0 + d, 1.0, np.exp(-(t[s:] - (t0 + d)) / rel))
        env = a * sus * r * v
        if legato:                                            # small articulation dip at the note change
            dip = 1 - 0.35 * np.exp(-((tt - 0.004) / 0.012) ** 2)
            env *= dip
        amp[s:] = np.maximum(amp[s:], env)
        # vibrato fades in after 160 ms on notes longer than 0.3 s
        if d > 0.3:
            vv = np.clip((tt - 0.16) / 0.25, 0, 1) * (tt < d + 0.05)
            vib_amt[s:] = np.maximum(vib_amt[s:], vv)
        if not legato:
            sc = -0.55 * np.exp(-tt / 0.03) * (tt >= 0)
            scoop[s:] += np.where(tt < 0.2, sc, 0.0)
        last_end = t0 + d
    # portamento: smooth the pitch steps (one-pole, 28 ms) forward
    a1 = np.exp(-1.0 / (0.028 * SR))
    pitch_s = signal.lfilter([1 - a1], [1, -a1], pitch, zi=[pitch[0] * a1])[0] if n else pitch
    vib = np.sin(2 * np.pi * vib_rate * t + rng.uniform(0, 6)) * (vib_cents / 100.0) * vib_amt
    drift = 0.04 * np.sin(2 * np.pi * 0.37 * t + rng.uniform(0, 6))
    midi_c = pitch_s + scoop + vib + drift + detune_cents / 100.0
    f = mtof(midi_c)
    ph = 2 * np.pi * np.cumsum(f) / SR
    tone = np.sin(ph) + 0.03 * np.sin(2 * ph + 0.3) + 0.008 * np.sin(3 * ph)
    noise = rng.standard_normal(n)
    br = bp(noise, 900, 5000, 2)
    br = br / (np.std(br) + 1e-9)
    y = tone * amp + breath * br * amp ** 1.5
    # attack chiff
    y = hp(y, 250, 2)
    return y


# ============================================================================ GLOCKENSPIEL / BELL
def glock(midi, vel_layer=2, variant=0, dur=2.6):
    def mk():
        rng = np.random.default_rng(int(3000 + midi * 13 + variant))
        f = float(mtof(midi))
        n = nsamp(dur)
        t = tvec(n)
        T = 1.9 * (1047.0 / f) ** 0.45
        ratios = [1.0, 2.756, 5.404, 8.933]
        amps = np.array([1.0, 0.32, 0.12, 0.05]) * np.array([1, 1.0 + 0.25 * (vel_layer - 2), 1 + 0.4 * (vel_layer - 2), 1 + 0.5 * (vel_layer - 2)])
        y = np.zeros(n)
        for i, (r, a) in enumerate(zip(ratios, amps)):
            fr = f * r
            if fr > SR * 0.45:
                continue
            y += a * np.sin(2 * np.pi * fr * t + rng.uniform(0, 6)) * np.exp(-t / (T / (1 + 2.8 * i)))
        click = hp(rng.standard_normal(nsamp(0.004)), 5000, 2) * np.exp(-tvec(nsamp(0.004)) / 0.0008)
        y[:len(click)] += click * 0.10
        y *= np.minimum(1, t / 0.0004)
        return norm(fade(y, 0, 0.15))
    return cached(('glock', midi, vel_layer, variant, dur), mk)


def bell(midi, dur=3.5, variant=0):
    """FM bell for the AI chime (soft tine)"""
    def mk():
        f = float(mtof(midi))
        n = nsamp(dur)
        t = tvec(n)
        I = 2.4 * np.exp(-t / 0.9)
        y = np.sin(2 * np.pi * f * t + I * np.sin(2 * np.pi * f * 3.5 * t)) * np.exp(-t / 1.4)
        y += 0.25 * np.sin(2 * np.pi * f * 2.0 * t) * np.exp(-t / 0.5)
        y *= np.minimum(1, t / 0.002)
        return norm(fade(y, 0, 0.3))
    return cached(('bell', midi, dur, variant), mk)


# ============================================================================ COMBO ORGAN
def _organ_table(f0):
    K = max(1, int(11000 / f0))
    k = np.arange(1, K + 1)
    a = np.where(k % 2 == 1, 1.0 / k, 0.55 / k)                  # reedy, square-ish
    a *= 1.0 / (1 + (k * f0 / 4200.0) ** 2)                       # soft top end
    a *= 1 + 0.6 * np.exp(-((k * f0 - 1500) / 700.0) ** 2)        # presence formant
    # 4' footage (octave above) blended in
    a2 = np.zeros(K)
    for kk in range(2, K + 1, 2):
        a2[kk - 1] = 0.35 / (kk / 2)
    return wavetable(a + a2 * (1.0 / (1 + (k * f0 / 4200.0) ** 2)), 8192)


def organ(midi, dur, variant=0, decay=None):
    def mk():
        rng = np.random.default_rng(4000 + midi * 3 + variant)
        f0 = float(mtof(midi))
        L = dur + 0.06
        n = nsamp(L)
        t = tvec(n)
        vib = 1 + 0.0055 * np.sin(2 * np.pi * 6.1 * t + rng.uniform(0, 6))
        y = wt_osc(_organ_table(f0), f0 * vib, n, rng.uniform(0, 1))
        env = np.minimum(1, t / 0.005)
        k = nsamp(dur)
        if k < n:
            env[k:] *= np.exp(-tvec(n - k) / 0.012)
        if decay:
            env *= np.exp(-t / decay)
        y *= env
        ck = nsamp(0.002)
        y[:ck] += bp(rng.standard_normal(ck), 2000, 7000, 2) * 0.15
        return y / 1.6
    return cached(('organ', midi, round(dur, 3), variant, decay), mk)


# ============================================================================ SYNTH PLUCK (spectral decay = closing filter)
def synth_pluck(midi, dur=0.45, variant=0, bright=1.0):
    def mk():
        rng = np.random.default_rng(5000 + midi * 5 + variant)
        f0 = float(mtof(midi))
        n = nsamp(dur)
        t = tvec(n)
        y = np.zeros(n)
        K = int(min(12000, SR * 0.45) / f0)
        for det in (-0.003, 0.003):
            ph0 = rng.uniform(0, 1)
            for k in range(1, K + 1):
                fk = k * f0 * (1 + det)
                a = (1.0 / k) * (1 if k % 2 else 0.7)
                tau = 0.30 / (1 + (fk / (1400 * bright)) ** 1.6)
                L = min(n, int(tau * 7 * SR) + 32)
                y[:L] += a * np.exp(-t[:L] / tau) * np.sin(2 * np.pi * fk * t[:L] + 2 * np.pi * ph0 * k)
        y *= np.minimum(1, t / 0.0015) * np.exp(-t / 0.5)
        return norm(fade(y, 0, 0.03))
    return cached(('pluck', midi, dur, variant, bright), mk)


# ============================================================================ PAD (supersaw, filtered)
def pad_chord(midis, dur, attack=0.6, release=1.2, cutoff=2400.0, seed=0, voices=5, spread_cents=14.0):
    rng = np.random.default_rng(6000 + seed)
    n = nsamp(dur + release)
    t = tvec(n)
    y = np.zeros(n)
    for m in midis:
        f0 = float(mtof(m))
        for v in range(voices):
            dc = spread_cents * (v - (voices - 1) / 2) / ((voices - 1) / 2 + 1e-9)
            f = f0 * 2 ** (dc / 1200) * (1 + 0.0015 * np.sin(2 * np.pi * rng.uniform(0.1, 0.3) * t + rng.uniform(0, 6)))
            y += polyblep_saw(f, n, rng.uniform(0, 1))
    y = lp(y, cutoff, 2)
    y = lp(y, cutoff * 1.6, 2)
    env = np.where(t < attack, np.sin(0.5 * np.pi * np.minimum(t / attack, 1)) ** 2, 1.0)
    k = nsamp(dur)
    env[k:] *= np.exp(-tvec(n - k) / (release / 4))
    return norm(hp(y * env, 120, 2))


# ============================================================================ FX
def boom(length=3.0, f0=120.0, f1=34.0, tau_p=0.11, decay=0.9, seed=0):
    rng = np.random.default_rng(7000 + seed)
    n = nsamp(length)
    t = tvec(n)
    f = f1 + (f0 - f1) * np.exp(-t / tau_p)
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / decay) * np.minimum(1, t / 0.001)
    body = np.tanh(1.6 * body)
    thump = lp(rng.standard_normal(n), 220, 2) * np.exp(-t / 0.07)
    y = body + 0.6 * norm(thump)
    return norm(fade(hp(y, 22, 2), 0, 0.5))


def riser(dur, f_lo=350.0, f_hi=9000.0, seed=0, tone=True):
    n = nsamp(dur)
    t = tvec(n)
    sw = stft_noise_sweep(dur, f_lo, f_hi, width_oct=1.4, curve=1.5, seed=11 + seed)
    y = sw[:n]
    if tone:
        fr = 180.0 * (2 ** (3.2 * (t / dur) ** 1.6))
        ph = 2 * np.pi * np.cumsum(fr) / SR
        y = y + 0.25 * (np.sin(ph) + 0.3 * np.sin(2 * ph) + 0.15 * np.sin(1.5 * ph))
    env = (t / dur) ** 2.2
    return norm(y * env)


def reverse_crash(length=1.9, variant=3):
    c = crash(variant, length=3.8)[:nsamp(length)].copy()
    c = c[::-1]
    c *= np.linspace(0, 1, len(c)) ** 1.5
    return norm(fade(c, 0.05, 0.004))


def sparkle(midis, gap=0.035, seed=0, layer=2):
    """quick upward glock run, returns mono"""
    rng = np.random.default_rng(8000 + seed)
    tot = gap * len(midis) + 2.8
    n = nsamp(tot)
    y = np.zeros(n)
    for i, m in enumerate(midis):
        g = glock(m, layer, variant=i % 3, dur=2.6)
        s = nsamp(i * gap + rng.uniform(0, 0.004))
        y[s:s + len(g)] += g * (0.6 + 0.4 * i / max(1, len(midis) - 1))
    return y
