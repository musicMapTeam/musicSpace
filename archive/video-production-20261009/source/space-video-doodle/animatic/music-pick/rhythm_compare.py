# Objective rhythm comparison of the candidate tracks (nobody can listen here).
# Per track: pulse clarity (onset autocorrelation at the beat lag), on-beat salience
# (spectral-flux energy within +-25 ms of grid beats vs. elsewhere), share of beats that
# carry a clear onset, drum-stem share, and per-bar stem energy around the edit window.
import json, subprocess, sys, numpy as np
SR = 22050
def load(path, sr=SR):
    raw = subprocess.run(['/opt/homebrew/bin/ffmpeg','-v','error','-i',path,'-ac','1','-ar',str(sr),'-f','f32le','-'],capture_output=True,check=True).stdout
    return np.frombuffer(raw, dtype=np.float32).copy()
def flux(x, sr=SR, hop=128, n=1024):
    win = np.hanning(n).astype(np.float32)
    frames = np.lib.stride_tricks.sliding_window_view(x, n)[::hop] * win
    S = np.abs(np.fft.rfft(frames, axis=1))
    f = np.fft.rfftfreq(n, 1/sr); band = (f>=40)&(f<=8000)
    L = np.log1p(100*S[:,band])
    d = np.maximum(0, np.diff(L, axis=0)).sum(1)
    d = np.concatenate([[0], d]); t = (np.arange(len(d))*hop + n/2)/sr
    return t, d
def metrics(path, beats, t0, t1, stem_dir=None, lag=0.0):
    x = load(path); t, d = flux(x)
    m = (t>=t0)&(t<t1); tt, dd = t[m], d[m]
    dd = dd - np.convolve(dd, np.ones(64)/64, 'same')  # remove slow trend
    dd = np.maximum(dd, 0)
    B = np.array([b for b in beats if t0 <= b < t1])
    near = np.zeros_like(tt, dtype=bool)
    for b in B: near |= np.abs(tt-b) <= 0.025
    sal = dd[near].mean()/max(1e-9, dd[~near].mean())
    thr = np.median(dd)+3*np.median(np.abs(dd-np.median(dd)))
    hit = np.mean([dd[np.abs(tt-b)<=0.03].max() > thr for b in B]) if len(B) else 0
    hop_s = tt[1]-tt[0]; beat = np.median(np.diff(B)); L = int(round(beat/hop_s))
    z = dd-dd.mean(); ac = np.correlate(z, z, 'full')[len(z)-1:]; ac /= ac[0]
    pulse = ac[L-2:L+3].max()
    return dict(onbeat_salience=round(float(sal),2), beats_with_clear_onset=round(float(hit),2), pulse_autocorr=round(float(pulse),2))
def stem_bars(stem_dir, bars, lag=0.050):
    out = {}
    for s in ['drums','bass','other']:
        y = load(f'{stem_dir}/{s}.mp3'); 
        e = []
        for (a,b) in bars:
            i0, i1 = int((a+lag)*SR), int((b+lag)*SR)
            seg = y[i0:i1]; e.append(10*np.log10(np.mean(seg**2)+1e-12))
        out[s] = [float(v) for v in e]
    return out
if __name__ == '__main__':
    C = json.load(open(sys.argv[1]))
    res = {}
    for c in C:
        bj = json.load(open(c['beats'])); beats = bj['beat_times_s']; bars = bj['bar_starts_s']
        r = {'bpm': bj['tempo_bpm'], 'window_s': c['win']}
        r.update(metrics(c['file'], beats, *c['win']))
        b0, b1 = c['bars']
        bb = [(bars[i-1], bars[i]) for i in range(b0, b1+1)]
        sb = stem_bars(c['stems'], bb)
        r['per_bar_db'] = {f'bar{b0+i}': {k: round(v[i],1) for k,v in sb.items()} for i in range(len(bb))}
        res[c['id']] = r
        print(c['id'], {k:v for k,v in r.items() if k!='per_bar_db'}, flush=True)
        for k,v in r['per_bar_db'].items(): print('   ', k, v)
    json.dump(res, open(sys.argv[2],'w'), indent=1)
