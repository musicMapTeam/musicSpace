import json, sys, numpy as np
sys.path.insert(0,'/tmp/space-video-doodle/animatic/music-pick')
from rhythm_compare import load
SR=22050
mix, bj = sys.argv[1], sys.argv[2]; b0, b1 = int(sys.argv[3]), int(sys.argv[4])
x = load(mix); bars = json.load(open(bj))['bar_starts_s']
def chroma(seg):
    n=8192; hop=2048; win=np.hanning(n)
    fr=np.lib.stride_tricks.sliding_window_view(seg,n)[::hop]*win
    S=np.abs(np.fft.rfft(fr,axis=1)).mean(0); f=np.fft.rfftfreq(n,1/SR)
    c=np.zeros(12); m=(f>55)&(f<2000)
    pc=(np.round(12*np.log2(f[m]/440.0))+9)%12
    for p,v in zip(pc.astype(int),S[m]**2): c[p]+=v
    return c/np.linalg.norm(c)
C={b:chroma(x[int(bars[b-1]*SR):int(bars[b]*SR)]) for b in range(b0,b1+1)}
names=['C','C#','D','D#','E','F','F#','G','G#','A','A#','B']
for b in range(b0,b1+1):
    top=np.argsort(C[b])[::-1][:3]
    print(b, ' '.join(names[i] for i in top), ' sim to:', ' '.join(f'{k}:{C[b]@C[k]:.2f}' for k in range(b0,b1+1) if k!=b and C[b]@C[k]>0.9))
