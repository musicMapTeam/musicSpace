import numpy as np, os, sys
from scipy import signal
from scipy.io import wavfile
SR=48000
OUT=sys.argv[1] if len(sys.argv)>1 else 'out'
fc = 1000 * 2.0 ** (np.arange(-17, 14) / 3.0)
def to(x):
    f,P=signal.welch(x,SR,nperseg=8192)
    return np.array([10*np.log10(np.sum(P[(f>=c/2**(1/6))&(f<c*2**(1/6))])*(f[1]-f[0])+1e-20) for c in fc])
sr,M=wavfile.read(f'{OUT}/master_float.wav'); m=to(M.mean(1)); ref=m.max()
print('band   ' + ' '.join(f'{(str(int(c)) if c<1000 else str(round(c/1000,1))+"k"):>6s}' for c in fc))
print('master ' + ' '.join(f'{v-ref:6.1f}' for v in m))
for f in sorted(os.listdir(f'{OUT}/stems')):
    sr,x=wavfile.read(f'{OUT}/stems/'+f); s=to(x.mean(1))
    print(f'{f.split("_")[0]:7s}' + ' '.join(f'{v-ref:6.1f}' for v in s))
