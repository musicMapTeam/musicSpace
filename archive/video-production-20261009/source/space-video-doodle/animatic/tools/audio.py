# Audio for the doodle-motion animatic: music edit on the bar grid + synthesized SFX on the scene's cue list + loudness.
#   python tools/audio.py <scene.info.json> <out_dir>
# Music: Wax Lyricist "Flipping In" (CC0 1.0; proof folder music-cc0/02-flipping-in__Wax-Lyricist).  Edit = FI bars 57-62 + FI bars 71-79
# (constant 123.00 BPM grid from beats.json; phrase-aligned splice, 12 ms equal-power crossfade).  Every SFX is synthesized here from
# sine/noise primitives (no samples, no third-party audio).  Output: animatic-mix.wav (music + SFX) and animatic-music.wav (music only),
# both 48 kHz / 24-bit, -16 LUFS integrated, true peak <= -1 dBTP (gain + 4x-oversampled look-ahead limiter, verified with ebur128).
import json, subprocess, sys, os, re, numpy as np
SR = 48000; FF = '/opt/homebrew/bin/ffmpeg'
FI = '/tmp/space-video-doodle/music-cc0/02-flipping-in__Wax-Lyricist/Wax_Lyricist_-_Flipping_In.mp3'
BEATS = '/tmp/space-video-doodle/music-cc0/02-flipping-in__Wax-Lyricist/beats.json'
LEAD = 0.010   # start every segment 10 ms before its downbeat so no transient is clipped (picture leads audio by 10 ms)

def decode(path):
    raw = subprocess.run([FF, '-v', 'error', '-i', path, '-f', 'f32le', '-ac', '2', '-ar', str(SR), '-'], capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.float32).reshape(-1, 2).astype(np.float64)

def music_edit(duration):
    x = decode(FI); bars = json.load(open(BEATS))['bar_starts_s']
    s1a, s1b = bars[56] - LEAD, bars[62] - LEAD          # bars 57..62 (bar n starts at bars[n-1])
    s2a = bars[70] - LEAD                                 # from bar 71
    seg1 = x[int(round(s1a * SR)):int(round(s1b * SR))]
    seg2 = x[int(round(s2a * SR)):int(round((s2a + duration - len(seg1) / SR + 0.05) * SR))]
    xf = int(0.012 * SR); w = np.linspace(0, np.pi / 2, xf)[:, None]
    head = seg1[:-xf]; tail = seg1[-xf:] * np.cos(w) + seg2[:xf] * np.sin(w)
    out = np.concatenate([head, tail, seg2[xf:]])[:int(round(duration * SR))]
    fo = int(0.9 * SR); out[-fo:] *= np.linspace(1, 0, fo)[:, None] ** 2
    return out, dict(seg1=[round(s1a, 4), round(s1b, 4)], seg2_from=round(s2a, 4), splice_at_s=round(len(seg1) / SR, 4))

# ---------------- SFX synthesis ----------------
rng = np.random.default_rng(1009)
def env(n, a, d, shape=1.0):
    t = np.arange(n) / SR; e = np.minimum(1, t / max(a, 1e-4)) * np.exp(-np.maximum(0, t - a) / d); return e ** shape
def bp(sig, lo, hi):   # FFT band-pass (zero phase) — short signals only
    F = np.fft.rfft(sig); f = np.fft.rfftfreq(len(sig), 1 / SR); m = ((f >= lo) & (f <= hi)).astype(float)
    m = np.convolve(m, np.hanning(9) / np.hanning(9).sum(), 'same'); return np.fft.irfft(F * m, len(sig))
def tone(f0, f1, n, wave='sin'):
    f = np.geomspace(f0, f1, n); ph = 2 * np.pi * np.cumsum(f) / SR
    return np.sin(ph) if wave == 'sin' else (2 / np.pi) * np.arcsin(np.sin(ph))
def noise(n): return rng.standard_normal(n)
def norm(sig, peak=1.0): return sig / (np.abs(sig).max() + 1e-12) * peak
def sfx(kind, note=0):
    st = 2 ** (note / 12)
    if kind == 'slap':      # paper slapped onto paper: bright noise snap + soft body thump
        n = int(0.16 * SR); s = bp(noise(n), 900 * st, 5200) * env(n, 0.001, 0.018) * 1.0 + tone(130 * st, 75, n) * env(n, 0.002, 0.045) * 0.9
        return norm(s, 0.9)
    if kind == 'stamp':     # rubber stamp: low thud + tiny click
        n = int(0.22 * SR); s = tone(95, 55, n) * env(n, 0.002, 0.07) + bp(noise(n), 300, 2400) * env(n, 0.0005, 0.012) * 0.6
        return norm(s, 0.85)
    if kind == 'impact':    # title slam: sub drop + paper snap + mid body
        n = int(0.6 * SR); s = tone(70 * st, 38, n) * env(n, 0.003, 0.16) * 1.0 + bp(noise(n), 1200, 7000) * env(n, 0.0005, 0.022) * 0.55 + tone(230, 140, n) * env(n, 0.002, 0.05) * 0.35
        return norm(s, 1.0)
    if kind == 'boom':      # the drop: bigger, longer sub + airy burst
        n = int(1.1 * SR); s = tone(62, 33, n) * env(n, 0.004, 0.32) + bp(noise(n), 2000, 9000) * env(n, 0.002, 0.18) * 0.22 + tone(180, 90, n) * env(n, 0.003, 0.09) * 0.4
        return norm(s, 1.0)
    if kind == 'pop':       # sticker pop: fast upward blip + click
        n = int(0.09 * SR); s = tone(620 * st, 1250 * st, n) * env(n, 0.002, 0.03) + bp(noise(n), 2000, 6000) * env(n, 0.0003, 0.004) * 0.3
        return norm(s, 0.8)
    if kind == 'squeak':    # marker on paper: narrow noise with a wobbling centre
        n = int(0.24 * SR); t = np.arange(n) / SR; base = noise(n)
        out = np.zeros(n); seg = int(0.02 * SR)
        for i in range(0, n, seg):
            c = 2600 + 350 * np.sin(2 * np.pi * 7 * t[i]); out[i:i + seg] = bp(base[i:i + seg], c - 500, c + 500)[:len(out[i:i + seg])]
        return norm(out * env(n, 0.03, 0.12) * np.hanning(n) ** 0.3, 0.5)
    if kind == 'whoosh':    # band-pass sweep of noise
        n = int(0.36 * SR); base = noise(n); out = np.zeros(n); seg = int(0.012 * SR)
        for i in range(0, n, seg):
            k = i / n; c = 400 * (3000 / 400) ** k; out[i:i + seg] = bp(base[i:i + seg], c * 0.6, c * 1.6)[:len(out[i:i + seg])]
        return norm(out * np.sin(np.pi * np.arange(n) / n) ** 1.5, 0.75)
    if kind == 'swap':      # zip: rising triangle glide + noise
        n = int(0.2 * SR); s = tone(320, 980, n, 'tri') * env(n, 0.01, 0.09) * 0.7 + bp(noise(n), 3000, 8000) * env(n, 0.005, 0.05) * 0.3
        return norm(s, 0.8)
    if kind == 'heart':     # soft boop
        n = int(0.18 * SR); return norm(tone(440, 690, n) * env(n, 0.012, 0.07), 0.75)
    if kind == 'click':
        n = int(0.05 * SR); return norm(bp(noise(n), 1500, 6000) * env(n, 0.0002, 0.003) + tone(1000, 900, n) * env(n, 0.001, 0.008) * 0.5, 0.7)
    if kind == 'riser':     # noise swell with a rising band into the next downbeat (~1.2 s)
        n = int(1.25 * SR); base = noise(n); out = np.zeros(n); seg = int(0.01 * SR)
        for i in range(0, n, seg):
            k = i / n; c = 300 * (5000 / 300) ** k; out[i:i + seg] = bp(base[i:i + seg], c * 0.7, c * 1.4)[:len(out[i:i + seg])]
        return norm(out * (np.arange(n) / n) ** 2.2, 0.6)
    raise ValueError(kind)
BASE_DB = {'slap': -16, 'stamp': -17, 'impact': -12, 'boom': -9, 'pop': -20, 'squeak': -26, 'whoosh': -19, 'swap': -18, 'heart': -19, 'click': -22, 'riser': -18}

def sfx_bus(cues, duration):
    bus = np.zeros((int(round(duration * SR)) + SR, 2)); used = {}
    for c in cues:
        k = c['kind']
        if k not in BASE_DB: continue
        s = sfx(k, c.get('note', 0) * (1 if k in ('slap', 'pop', 'impact') else 0) % 12) * 10 ** ((BASE_DB[k] + c.get('gain', 0)) / 20)
        i = int(round((c['t'] + LEAD) * SR))
        if k == 'riser': i = max(0, i)                       # starts on its cue, swells into the next downbeat
        pan = max(-0.6, min(0.6, c.get('pan', 0))); L, R = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
        j = min(len(bus), i + len(s)); bus[i:j, 0] += s[:j - i] * L * 1.41; bus[i:j, 1] += s[:j - i] * R * 1.41; used[k] = used.get(k, 0) + 1
    return bus[:int(round(duration * SR))], used

def write_wav(path, x):
    p = subprocess.run([FF, '-y', '-v', 'error', '-f', 'f64le', '-ar', str(SR), '-ac', '2', '-i', '-', '-c:a', 'pcm_f32le', path], input=x.astype(np.float64).tobytes(), check=True)
def measure(path):
    r = subprocess.run([FF, '-hide_banner', '-nostats', '-i', path, '-af', 'ebur128=peak=true', '-f', 'null', '-'], capture_output=True, text=True).stderr
    I = float(re.findall(r'I:\s+(-?[\d.]+) LUFS', r)[-1]); TP = float(re.findall(r'Peak:\s+(-?[\d.]+) dBFS', r)[-1]); LRA = float(re.findall(r'LRA:\s+(-?[\d.]+) LU', r)[-1])
    return dict(I=I, TP=TP, LRA=LRA)
def master(src, dst, target=-16.0):
    m = measure(src); g = target - m['I']
    for it in range(3):   # gain, 4x-oversampled look-ahead limiter at -1.5 dBFS, back to 48k/24-bit; re-measure and nudge
        subprocess.run([FF, '-y', '-v', 'error', '-i', src, '-af', f'volume={g:.2f}dB,aresample=192000,alimiter=limit=0.83:attack=4:release=60:level=disabled,aresample=48000', '-c:a', 'pcm_s24le', dst], check=True)
        m2 = measure(dst)
        if abs(m2['I'] - target) <= 0.15 and m2['TP'] <= -1.0: break
        g += target - m2['I']
    return dict(gain_db=round(g, 2), before=m, after=m2)

if __name__ == '__main__':
    info = json.load(open(sys.argv[1])); out = sys.argv[2]; os.makedirs(out, exist_ok=True)
    dur = info['duration']; mus, edit = music_edit(dur)
    bus, used = sfx_bus(info['cues'], dur)
    write_wav(f'{out}/_music_raw.wav', mus); write_wav(f'{out}/_mix_raw.wav', mus + bus); write_wav(f'{out}/_sfx_raw.wav', bus)
    r1 = master(f'{out}/_music_raw.wav', f'{out}/animatic-music.wav'); r2 = master(f'{out}/_mix_raw.wav', f'{out}/animatic-mix.wav')
    sm = measure(f'{out}/_sfx_raw.wav'); mm = measure(f'{out}/_music_raw.wav')
    rep = dict(edit=edit, duration=dur, sfx_counts=used, sfx_vs_music_LU=round(sm['I'] - mm['I'], 1), music=r1, mix=r2)
    json.dump(rep, open(f'{out}/audio-report.json', 'w'), indent=1); print(json.dumps(rep, indent=1))
    for f in ['_music_raw.wav', '_mix_raw.wav', '_sfx_raw.wav']: os.remove(f'{out}/{f}')
