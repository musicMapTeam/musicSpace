"""Shared audio helpers for the production tools (numpy/scipy; ffmpeg only for decoding, encoding and the BS.1770 meter).
Nobody can listen on this machine: everything here is judged by measurement (ebur128 loudness + true peak, onsets vs grid)."""
import json, os, re, subprocess
import numpy as np
from scipy.signal import resample_poly
from scipy.ndimage import minimum_filter1d, uniform_filter1d

SR = 48000
FF = '/opt/homebrew/bin/ffmpeg'
FP = '/opt/homebrew/bin/ffprobe'


def decode(path, sr=SR, ch=2):
    raw = subprocess.run([FF, '-v', 'error', '-i', path, '-f', 'f32le', '-ac', str(ch), '-ar', str(sr), '-'], capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.float32).reshape(-1, ch).astype(np.float64)


def write_wav(path, x, bits=24):
    os.makedirs(os.path.dirname(os.path.abspath(path)), exist_ok=True)
    codec = {16: 'pcm_s16le', 24: 'pcm_s24le', 32: 'pcm_f32le'}[bits]
    subprocess.run([FF, '-y', '-v', 'error', '-f', 'f64le', '-ar', str(SR), '-ac', str(x.shape[1]), '-i', '-', '-c:a', codec, path],
                   input=np.ascontiguousarray(x, dtype=np.float64).tobytes(), check=True)


def ebur128(path_or_array):
    """integrated loudness (LUFS), true peak (dBTP), LRA (LU) via ffmpeg ebur128=peak=true"""
    if isinstance(path_or_array, np.ndarray):
        inp = ['-f', 'f64le', '-ar', str(SR), '-ac', str(path_or_array.shape[1]), '-i', '-']
        data = np.ascontiguousarray(path_or_array, dtype=np.float64).tobytes()
    else:
        inp = ['-i', path_or_array]; data = None
    r = subprocess.run([FF, '-hide_banner', '-nostats', *inp, '-af', 'ebur128=peak=true', '-f', 'null', '-'], input=data, capture_output=True).stderr.decode('utf8', 'replace')
    I = float(re.findall(r'I:\s+(-?[\d.]+|-inf) LUFS', r)[-1]) if re.findall(r'I:\s+(-?[\d.]+) LUFS', r) else -70.0
    TP = float(re.findall(r'Peak:\s+(-?[\d.]+|-inf) dBFS', r)[-1]) if re.findall(r'Peak:\s+(-?[\d.]+) dBFS', r) else -120.0
    LRA = float(re.findall(r'LRA:\s+(-?[\d.]+) LU', r)[-1]) if re.findall(r'LRA:\s+(-?[\d.]+) LU', r) else 0.0
    return dict(I=I, TP=TP, LRA=LRA)


def true_peak_limit(x, ceiling_db=-1.5, lookahead_ms=1.5, smooth_ms=1.0):
    """look-ahead true-peak limiter: 4x oversampled peak detector -> minimum filter (look-ahead) -> moving average (no instant steps).
    The averaged gain is <= the needed gain everywhere (an average of window minima), so 4x inter-sample peaks stay under the ceiling."""
    c = 10 ** (ceiling_db / 20)
    up = np.stack([resample_poly(x[:, k], 4, 1) for k in range(x.shape[1])], axis=1)
    n = x.shape[0]
    pk = np.abs(up[:n * 4]).max(axis=1).reshape(n, 4).max(axis=1)
    g = np.minimum(1.0, c / np.maximum(pk, 1e-12))
    L = max(1, int(lookahead_ms * SR / 1000)); M = max(1, int(smooth_ms * SR / 1000))
    g1 = minimum_filter1d(g, size=2 * L + 1, mode='nearest')
    g2 = uniform_filter1d(g1, size=M, mode='nearest')
    g2 = np.minimum(g2, g1)
    return x * g2[:, None], float(20 * np.log10(g2.min()))


def normalize(x, target=-16.0, ceiling_db=-1.5, tol=0.1, max_iter=4):
    """gain to `target` LUFS integrated + true-peak limit; iterates because limiting lowers the loudness a little"""
    m0 = ebur128(x); g = target - m0['I']; y = x; red = 0.0
    for it in range(max_iter):
        y, red = true_peak_limit(x * 10 ** (g / 20), ceiling_db)
        m = ebur128(y)
        if abs(m['I'] - target) <= tol and m['TP'] <= -1.2:
            break
        g += target - m['I']
        if m['TP'] > -1.2:
            ceiling_db -= 0.3
    return y, dict(gain_db=round(g, 2), before=m0, after=m, limiter_max_reduction_db=round(red, 2), ceiling_db=ceiling_db)


# onset_env() finds a sharp onset ~10 ms early (log spectral flux sees the window's leading edge first): measured on synthetic
# kick/snare hits at exact times over a pad + noise floor (2026-10-07): median -10.3 ms (kick -11.1, snare -9.3, p10/p90 -12.7/-7.8).
ONSET_BIAS_MS = -10.3


def onset_env(x, hop=240):
    """spectral-flux onset envelope (mono, 40 Hz - 10 kHz), hop 5 ms at 48 kHz; returns (env, frame_times)"""
    from scipy.signal import stft
    m = x.mean(axis=1) if x.ndim == 2 else x
    f, t, Z = stft(m, SR, nperseg=2048, noverlap=2048 - hop, boundary=None, padded=False)
    band = (f >= 40) & (f <= 10000)
    S = np.log1p(1000 * np.abs(Z[band]))
    flux = np.maximum(0, np.diff(S, axis=1)).sum(axis=0)
    flux = np.concatenate([[0], flux])
    flux = flux - uniform_filter1d(flux, 41)          # remove the slow trend
    flux = np.maximum(flux, 0)
    return flux / (flux.max() + 1e-12), t   # t = frame centres (a sharp onset peaks when it crosses the window centre)


def beat_db(x, times, win):
    """RMS dB of the window [t, t+win) for every t"""
    m = x.mean(axis=1) if x.ndim == 2 else x
    out = []
    for t in times:
        a, b = int(t * SR), int((t + win) * SR)
        s = m[max(0, a):max(a + 1, b)]
        out.append(20 * np.log10(np.sqrt((s ** 2).mean() + 1e-18)))
    return np.array(out)
