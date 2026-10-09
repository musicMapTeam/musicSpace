import time, numpy as np
from dsp import *
import instruments as I

def f0_est(y, fmin=30, fmax=4000):
    # FFT peak with parabolic interpolation on a windowed segment (after attack)
    s = y[nsamp(0.05):nsamp(0.05)+nsamp(0.5)]
    w = np.hanning(len(s)); N = 1<<20
    S = np.abs(np.fft.rfft(s*w, N)); f = np.fft.rfftfreq(N, 1/SR)
    band = (f>fmin)&(f<fmax)
    i = np.argmax(S*band)
    a,b,c = np.log(S[i-1:i+2]+1e-12); p = 0.5*(a-c)/(a-2*b+c)
    return (i+p)*SR/N

def cents(f, m): return 1200*np.log2(f/mtof(m))
for name, fn in [('kick', lambda: I.kick(0)), ('snare', lambda: I.snare(0)), ('clap', lambda: I.clap(0)),
                 ('hatC', lambda: I.hat(0)), ('hatO', lambda: I.hat(0, True)), ('tamb', lambda: I.tamb(0)),
                 ('shaker', lambda: I.shaker(0)), ('crash', lambda: I.crash(0)), ('tom', lambda: I.tom(110.0)),
                 ('boom', lambda: I.boom()), ('riser', lambda: I.riser(3.87)), ('rcrash', lambda: I.reverse_crash())]:
    t0=time.time(); y=fn(); dt=time.time()-t0
    print(f'{name:7s} {len(y)/SR:5.2f}s  {dt*1000:7.1f} ms  nan={np.isnan(y).any()} peak={np.max(np.abs(y)):.2f} start={y[0]:.3f} end={y[-1]:.4f}')
for kind in ['elec','ac','mute','clean','bass']:
    for m in ([40,45,50,55,59,64,69] if kind!='bass' else [28,33,38,43]):
        t0=time.time(); y=I.string_note(m, 1.2 if kind!='mute' else 0.4, kind, 2, 0); dt=time.time()-t0
        f=f0_est(y, 30, 2000)
        # partial ratios check: fundamental may be weak for pickup comb, check nearest harmonic
        print(f'{kind:5s} m{m} f0est {f:8.2f} target {mtof(m):8.2f} cents {cents(f,m):+6.1f}  {dt*1000:6.1f}ms nan={np.isnan(y).any()}')
t0=time.time()
w = I.whistle_line([(0,0.24,86,1),(0.24,0.12,90,1),(0.36,0.85,93,1),(1.21,0.24,90,0.9)], 2.0)
print('whistle', time.time()-t0, 'nan', np.isnan(w).any())
seg = w[nsamp(0.5):nsamp(1.0)]
print('whistle long-note pitch', f0_est(np.concatenate([np.zeros(nsamp(0.05)), seg, np.zeros(nsamp(0.6))]), 300, 4000), 'target', mtof(93))
for m in [86, 93, 98]:
    g = I.glock(m); print('glock', m, f0_est(g, 300, 5000), mtof(m))
t0=time.time(); o=I.organ(62, 1.0); print('organ', time.time()-t0, f0_est(o, 100, 2000), mtof(62))
t0=time.time(); p=I.synth_pluck(74); print('pluck', time.time()-t0, f0_est(np.concatenate([p,np.zeros(nsamp(0.4))]), 100, 3000), mtof(74))
t0=time.time(); pd=I.pad_chord([50,57,62,66], 4.0); print('pad', time.time()-t0, np.isnan(pd).any())
t0=time.time(); b=I.bass_note(38, 0.2); print('bass', time.time()-t0, len(b)/SR)
