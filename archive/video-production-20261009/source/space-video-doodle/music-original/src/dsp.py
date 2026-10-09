"""DSP helpers for the Music Space doodle score (100 % our own code, numpy + scipy only).

Everything runs at SR = 48 kHz in float64/float32 numpy arrays.  Stereo tracks are shape (2, n).
"""
import numpy as np
from scipy import signal
from scipy.ndimage import minimum_filter1d, uniform_filter1d

SR = 48000


# ----------------------------------------------------------------------------- basic helpers
def secs(n):
    return n / SR


def nsamp(t):
    return int(round(t * SR))


def mtof(m):
    return 440.0 * 2.0 ** ((np.asarray(m, dtype=float) - 69.0) / 12.0)


def db(x):
    return 20.0 * np.log10(np.maximum(np.abs(x), 1e-12))


def undb(d):
    return 10.0 ** (np.asarray(d, dtype=float) / 20.0)


def pan_gains(pan):
    """equal-power pan law, pan in -1..1"""
    ang = (np.clip(pan, -1, 1) + 1.0) * np.pi / 4.0
    return np.cos(ang), np.sin(ang)


def fade(x, fin=0.0, fout=0.0):
    x = np.array(x, dtype=np.float64, copy=True)
    n = x.shape[-1]
    a = min(nsamp(fin), n)
    b = min(nsamp(fout), n)
    if a > 0:
        x[..., :a] *= np.sin(np.linspace(0, np.pi / 2, a)) ** 2
    if b > 0:
        x[..., n - b:] *= np.cos(np.linspace(0, np.pi / 2, b)) ** 2
    return x


# ----------------------------------------------------------------------------- filters (RBJ biquads + butterworth)
def _sos(b, a):
    b = np.asarray(b, float) / a[0]
    a = np.asarray(a, float) / a[0]
    return np.concatenate([b, a])[None, :]


def biquad(kind, f0, q=0.707, gain_db=0.0, sr=SR):
    A = 10 ** (gain_db / 40.0)
    w0 = 2 * np.pi * min(f0, sr * 0.49) / sr
    cw, sw = np.cos(w0), np.sin(w0)
    alpha = sw / (2 * q)
    if kind == 'peak':
        b = [1 + alpha * A, -2 * cw, 1 - alpha * A]
        a = [1 + alpha / A, -2 * cw, 1 - alpha / A]
    elif kind == 'lowshelf':
        sA = np.sqrt(A)
        b = [A * ((A + 1) - (A - 1) * cw + 2 * sA * alpha), 2 * A * ((A - 1) - (A + 1) * cw), A * ((A + 1) - (A - 1) * cw - 2 * sA * alpha)]
        a = [(A + 1) + (A - 1) * cw + 2 * sA * alpha, -2 * ((A - 1) + (A + 1) * cw), (A + 1) + (A - 1) * cw - 2 * sA * alpha]
    elif kind == 'highshelf':
        sA = np.sqrt(A)
        b = [A * ((A + 1) + (A - 1) * cw + 2 * sA * alpha), -2 * A * ((A - 1) + (A + 1) * cw), A * ((A + 1) + (A - 1) * cw - 2 * sA * alpha)]
        a = [(A + 1) - (A - 1) * cw + 2 * sA * alpha, 2 * ((A - 1) - (A + 1) * cw), (A + 1) - (A - 1) * cw - 2 * sA * alpha]
    elif kind == 'lp':
        b = [(1 - cw) / 2, 1 - cw, (1 - cw) / 2]
        a = [1 + alpha, -2 * cw, 1 - alpha]
    elif kind == 'hp':
        b = [(1 + cw) / 2, -(1 + cw), (1 + cw) / 2]
        a = [1 + alpha, -2 * cw, 1 - alpha]
    elif kind == 'bp':
        b = [alpha, 0, -alpha]
        a = [1 + alpha, -2 * cw, 1 - alpha]
    else:
        raise ValueError(kind)
    return _sos(b, a)


def butter(kind, fc, order=2, sr=SR):
    if kind in ('lp', 'low'):
        return signal.butter(order, min(fc, sr * 0.49), 'low', fs=sr, output='sos')
    if kind in ('hp', 'high'):
        return signal.butter(order, fc, 'high', fs=sr, output='sos')
    if kind in ('bp', 'band'):
        lo, hi = fc
        return signal.butter(order, [lo, min(hi, sr * 0.49)], 'band', fs=sr, output='sos')
    raise ValueError(kind)


def chain(*soss):
    return np.concatenate(soss, axis=0)


def filt(x, sos):
    """apply sos along the last axis (mono or stereo)"""
    return signal.sosfilt(sos, x, axis=-1)


def hp(x, fc, order=2):
    return filt(x, butter('hp', fc, order))


def lp(x, fc, order=2):
    return filt(x, butter('lp', fc, order))


def bp(x, lo, hi, order=2):
    return filt(x, butter('bp', (lo, hi), order))


def eq(x, *bands):
    """bands: tuples (kind, f0, q, gain_db)"""
    if not bands:
        return x
    return filt(x, chain(*[biquad(k, f, q, g) for (k, f, q, g) in bands]))


# ----------------------------------------------------------------------------- envelopes
def env_exp(n, tau, attack=0.0005):
    t = np.arange(n) / SR
    e = np.exp(-t / max(tau, 1e-5))
    if attack > 0:
        a = np.minimum(1.0, t / attack)
        e *= np.sin(a * np.pi / 2) ** 2
    return e


def adsr(n, a=0.005, d=0.1, s=0.7, r=0.1, hold=None):
    """hold = note-off time in seconds (release starts there); returns envelope of length n"""
    t = np.arange(n) / SR
    e = np.where(t < a, t / max(a, 1e-6), s + (1 - s) * np.exp(-(t - a) / max(d, 1e-6)))
    if hold is not None:
        k = nsamp(hold)
        if k < n:
            lvl = e[k] if k < n else e[-1]
            tr = (np.arange(n - k)) / SR
            e[k:] = lvl * np.exp(-tr / max(r, 1e-6))
    return e


def release_tail(x, t_off, rel):
    """multiply mono x by a smooth release starting at t_off seconds, ending ~5*rel later (then truncate)"""
    k = nsamp(t_off)
    if k >= len(x):
        return x
    m = min(len(x), k + nsamp(rel * 6) + 1)
    y = x[:m].copy()
    tr = np.arange(m - k) / SR
    y[k:] *= np.exp(-tr / max(rel, 1e-5))
    # last few samples to exactly zero
    z = min(64, m - k)
    y[m - z:] *= np.linspace(1, 0, z)
    return y


# ----------------------------------------------------------------------------- track buffer
class Track:
    def __init__(self, total_s, name=''):
        self.n = nsamp(total_s)
        self.buf = np.zeros((2, self.n), dtype=np.float64)
        self.name = name

    def add(self, mono, t, pan=0.0, gain=1.0):
        i = nsamp(t)
        if i >= self.n or len(mono) == 0:
            return
        j0 = 0
        if i < 0:                       # never cut an attack: events jittered before 0 start at 0
            i = 0
        m = min(len(mono) - j0, self.n - i)
        if m <= 0:
            return
        gl, gr = pan_gains(pan)
        seg = mono[j0:j0 + m] * gain
        self.buf[0, i:i + m] += seg * gl
        self.buf[1, i:i + m] += seg * gr

    def add_st(self, st, t, gain=1.0):
        i = nsamp(t)
        if i >= self.n:
            return
        j0 = 0
        if i < 0:
            i = 0
        m = min(st.shape[1] - j0, self.n - i)
        if m <= 0:
            return
        self.buf[:, i:i + m] += st[:, j0:j0 + m] * gain


# ----------------------------------------------------------------------------- reverb / delay
def make_ir(rt60=1.8, pre=0.012, damp_hz=6000, size=1.0, er=True, seed=7, width=1.0, lo_rt_scale=1.0):
    """synthetic stereo IR: early reflections + decorrelated exponentially decaying noise with
    frequency-dependent decay (highs die faster).  returns (2, n) with unit energy per channel."""
    rng = np.random.default_rng(seed)
    n = nsamp(rt60 * 1.4 + pre + 0.05)
    t = np.arange(n) / SR
    out = np.zeros((2, n))
    for c in range(2):
        noise = rng.standard_normal(n)
        lo = lp(noise, 600, 2)
        hi = hp(noise, 4000, 2)
        mid = noise - lo - hi
        k = 6.908 / rt60
        dec = (lo * np.exp(-t * k / lo_rt_scale) + mid * np.exp(-t * k) + hi * np.exp(-t * k * 1.9))
        dec = lp(dec, damp_hz, 2)
        # smooth onset of the diffuse tail
        dec *= np.minimum(1.0, t / (0.02 * size + 1e-3))
        out[c] = dec
    if er:
        taps = rng.uniform(0.004, 0.045 * size, 14)
        gains = rng.uniform(0.25, 0.7, 14) * np.exp(-taps / (0.04 * size))
        for tp, g in zip(taps, gains):
            ch = rng.integers(0, 2)
            idx = nsamp(tp)
            if idx < n:
                out[ch, idx] += g * 3.0
                out[1 - ch, min(n - 1, idx + rng.integers(5, 40))] += g * 1.6
    # width: mix channels toward mono
    m = 0.5 * (out[0] + out[1])
    out = m + (out - m) * width
    out = np.concatenate([np.zeros((2, nsamp(pre))), out], axis=1)
    for c in range(2):
        out[c] /= np.sqrt(np.sum(out[c] ** 2)) + 1e-12
    return out


def convolve_reverb(x, ir, wet=0.25, dry=1.0):
    """x stereo (2,n); feed the mono sum of x into a stereo IR (cheap, wide)"""
    mono = 0.5 * (x[0] + x[1])
    n = x.shape[1]
    w = np.stack([signal.fftconvolve(mono, ir[0])[:n], signal.fftconvolve(mono, ir[1])[:n]])
    return dry * x + wet * w, w


def reverb_send(x, ir):
    mono = 0.5 * (x[0] + x[1])
    n = x.shape[1]
    return np.stack([signal.fftconvolve(mono, ir[0])[:n], signal.fftconvolve(mono, ir[1])[:n]])


def pingpong(x, delay_s, fb=0.35, taps=4, lp_hz=5000, hp_hz=300, first_side=1):
    """non-recursive ping-pong delay (sum of taps), returns wet only.  x stereo"""
    n = x.shape[1]
    mono = 0.5 * (x[0] + x[1])
    mono = hp(lp(mono, lp_hz, 2), hp_hz, 2)
    out = np.zeros((2, n))
    g = 1.0
    cur = mono
    for k in range(1, taps + 1):
        d = nsamp(delay_s * k)
        if d >= n:
            break
        g *= fb if k > 1 else 1.0
        side = (first_side + k + 1) % 2
        out[side, d:] += cur[:n - d] * g
        cur = lp(cur, lp_hz * 0.8, 1)  # each repeat a bit darker
    return out


# ----------------------------------------------------------------------------- dynamics
def sidechain_env(n, times, depth_db=6.0, attack=0.004, release=0.14, vels=None, shape=1.6):
    """deterministic ducking gain (n samples) from trigger times (s).  depth in dB at velocity 1.
    curve: linear dip over `attack` ending at the trigger, then exp(-(x/release)^shape) recovery."""
    g = np.zeros(n)
    L = nsamp(attack + release * 4)
    tt = np.arange(L) / SR
    curve = np.where(tt < attack, tt / attack, np.exp(-np.maximum(tt - attack, 0) ** shape / release ** shape))
    for k, t0 in enumerate(times):
        v = 1.0 if vels is None else vels[k]
        i0 = nsamp(t0) - nsamp(attack)
        if i0 >= n:
            continue
        j0 = 0
        if i0 < 0:
            j0 = -i0
            i0 = 0
        m = min(L - j0, n - i0)
        if m <= 0:
            continue
        np.maximum(g[i0:i0 + m], curve[j0:j0 + m] * v, out=g[i0:i0 + m])
    return undb(-depth_db * g)


def env_follow_db(x_mono, attack=0.01, release=0.15, dec=32, rms_win=0.01):
    """decimated envelope follower (dB), returns envelope at full rate"""
    sq = x_mono ** 2
    w = max(1, nsamp(rms_win))
    p = uniform_filter1d(sq, w)
    pd = p[::dec]
    lvl = 10 * np.log10(pd + 1e-12)
    a_att = np.exp(-dec / (attack * SR))
    a_rel = np.exp(-dec / (release * SR))
    out = np.empty_like(lvl)
    s = lvl[0]
    for i, v in enumerate(lvl):
        if v > s:
            s = a_att * s + (1 - a_att) * v
        else:
            s = a_rel * s + (1 - a_rel) * v
        out[i] = s
    full = np.interp(np.arange(len(x_mono)), np.arange(len(out)) * dec, out)
    return full


def compressor(x, thresh_db=-18, ratio=2.0, attack=0.015, release=0.18, knee=6.0, makeup_db=0.0, detector=None):
    """stereo-linked feed-forward compressor (decimated detector).  returns (y, gr_db)"""
    det = 0.5 * (x[0] + x[1]) if detector is None else detector
    lvl = env_follow_db(det, attack, release)
    over = lvl - thresh_db
    # soft knee
    gr = np.where(over <= -knee / 2, 0.0,
                  np.where(over >= knee / 2, over * (1 - 1 / ratio),
                           (1 - 1 / ratio) * (over + knee / 2) ** 2 / (2 * knee)))
    g = undb(-gr + makeup_db)
    return x * g, gr


def soft_clip(x, drive=1.0):
    return np.tanh(x * drive) / np.tanh(drive)


# ----------------------------------------------------------------------------- loudness (ITU-R BS.1770-4) and true peak
def k_weight(x):
    # coefficients for 48 kHz from ITU-R BS.1770
    b1 = [1.53512485958697, -2.69169618940638, 1.19839281085285]
    a1 = [1.0, -1.69065929318241, 0.73248077421585]
    b2 = [1.0, -2.0, 1.0]
    a2 = [1.0, -1.99004745483398, 0.99007225036621]
    y = signal.lfilter(b1, a1, x, axis=-1)
    return signal.lfilter(b2, a2, y, axis=-1)


def block_loudness(x, block=0.4, overlap=0.75):
    """returns (block start times, loudness per block in LUFS) for stereo x"""
    y = k_weight(x)
    bl = nsamp(block)
    hop = max(1, int(bl * (1 - overlap)))
    sq = y ** 2
    csum = np.concatenate([np.zeros((sq.shape[0], 1)), np.cumsum(sq, axis=1)], axis=1)
    starts = np.arange(0, sq.shape[1] - bl + 1, hop)
    ms = (csum[:, starts + bl] - csum[:, starts]) / bl
    z = ms.sum(axis=0)
    L = -0.691 + 10 * np.log10(z + 1e-15)
    return starts / SR, L, z


def integrated_lufs(x):
    _, L, z = block_loudness(x)
    g1 = L > -70
    if not np.any(g1):
        return -70.0
    zr = z[g1].mean()
    Lr = -0.691 + 10 * np.log10(zr) - 10
    g2 = g1 & (L > Lr)
    return float(-0.691 + 10 * np.log10(z[g2].mean()))


def short_term(x, win=3.0, hop=0.1):
    y = k_weight(x)
    bl = nsamp(win)
    h = nsamp(hop)
    sq = (y ** 2).sum(axis=0)
    cs = np.concatenate([[0], np.cumsum(sq)])
    starts = np.arange(0, len(sq) - bl + 1, h)
    ms = (cs[starts + bl] - cs[starts]) / bl
    return starts / SR, -0.691 + 10 * np.log10(ms + 1e-15)


def lra(x):
    t, st = short_term(x, 3.0, 0.1)
    st = st[st > -70]
    if len(st) == 0:
        return 0.0
    rel = -0.691 + 10 * np.log10(np.mean(10 ** ((st + 0.691) / 10))) - 20
    st = st[st > rel]
    return float(np.percentile(st, 95) - np.percentile(st, 10))


def true_peak_db(x, os=4):
    m = 0.0
    for c in range(x.shape[0]):
        y = signal.resample_poly(x[c], os, 1)
        m = max(m, float(np.max(np.abs(y))))
    return 20 * np.log10(m + 1e-12)


def tp_limiter(x, ceiling_db=-1.5, lookahead=0.005, release=0.08, os=4):
    """true-peak lookahead limiter.  gain computed from 4x oversampled peaks, smoothed so it reaches
    the needed reduction before each peak (min-filter + box smoothing), with an exponential release."""
    c = undb(ceiling_db)
    n = x.shape[1]
    pk = np.zeros(n)
    for ch in range(x.shape[0]):
        y = signal.resample_poly(x[ch], os, 1)
        y = np.abs(y[:n * os]).reshape(n, os).max(axis=1)
        pk = np.maximum(pk, np.abs(x[ch]))
        pk = np.maximum(pk, y)
    need = np.minimum(1.0, c / np.maximum(pk, 1e-12))
    L = max(1, nsamp(lookahead))
    g = minimum_filter1d(need, size=2 * L + 1, mode='nearest')
    g = uniform_filter1d(g, size=L, mode='nearest')
    # release smoothing at decimated rate (attack instant, release exp)
    dec = 16
    gd = minimum_filter1d(g, size=dec, mode='nearest')[::dec]
    a = np.exp(-dec / (release * SR))
    out = np.empty_like(gd)
    s = 1.0
    for i, v in enumerate(gd):
        s = v if v < s else a * s + (1 - a) * v
        out[i] = s
    gf = np.interp(np.arange(n), np.arange(len(out)) * dec, out)
    gf = np.minimum(gf, g)  # never less reduction than the smoothed requirement
    return x * gf, gf


# ----------------------------------------------------------------------------- band-limited oscillators
def polyblep_saw(freq, n, phase0=0.0):
    """freq: scalar or array (Hz) of length n.  naive saw corrected with PolyBLEP"""
    f = np.broadcast_to(np.asarray(freq, float), (n,)) if np.ndim(freq) == 0 else np.asarray(freq, float)
    dt = f / SR
    ph = (phase0 + np.cumsum(dt) - dt[0]) % 1.0
    y = 2 * ph - 1
    # residual near discontinuity
    m1 = ph < dt
    t1 = ph[m1] / dt[m1]
    y[m1] -= (t1 + t1 - t1 * t1 - 1)
    m2 = ph > 1 - dt
    t2 = (ph[m2] - 1) / dt[m2]
    y[m2] -= (t2 * t2 + t2 + t2 + 1)
    return y


def wavetable(harm_amps, size=4096):
    """one-cycle table from harmonic amplitudes (index 0 = fundamental)"""
    k = np.arange(1, len(harm_amps) + 1)
    x = np.arange(size) / size
    tab = np.zeros(size)
    for kk, a in zip(k, harm_amps):
        if a != 0:
            tab += a * np.sin(2 * np.pi * kk * x)
    return tab


def wt_osc(tab, freq, n, phase0=0.0):
    f = np.broadcast_to(np.asarray(freq, float), (n,)) if np.ndim(freq) == 0 else np.asarray(freq, float)
    ph = (phase0 + np.cumsum(f / SR) - f[0] / SR) % 1.0
    size = len(tab)
    pos = ph * size
    i0 = pos.astype(np.int64) % size
    fr = pos - np.floor(pos)
    i1 = (i0 + 1) % size
    return tab[i0] * (1 - fr) + tab[i1] * fr


def stft_noise_sweep(dur, f_lo, f_hi, width_oct=1.0, curve=1.0, seed=3, n_fft=2048, hop=256):
    """white noise shaped in the STFT domain by a moving band (log-frequency gaussian) from f_lo to f_hi"""
    rng = np.random.default_rng(seed)
    n = nsamp(dur)
    x = rng.standard_normal(n + n_fft)
    f, t, Z = signal.stft(x, fs=SR, nperseg=n_fft, noverlap=n_fft - hop, boundary=None, padded=True)
    tt = np.clip(t / dur, 0, 1) ** curve
    fc = f_lo * (f_hi / f_lo) ** tt
    lf = np.log2(np.maximum(f, 1.0))[:, None]
    mask = np.exp(-0.5 * ((lf - np.log2(fc)[None, :]) / (width_oct / 2.355)) ** 2)
    import warnings
    with warnings.catch_warnings():
        warnings.simplefilter('ignore')
        _, y = signal.istft(Z * mask, fs=SR, nperseg=n_fft, noverlap=n_fft - hop, boundary=False)
    y = y[:n]
    return y / (np.max(np.abs(y)) + 1e-12)
