import json, subprocess, sys, numpy as np
from scipy.signal import butter, sosfilt
SR=44100
def load(p):
    raw=subprocess.run(['/opt/homebrew/bin/ffmpeg','-v','error','-i',p,'-ac','1','-ar',str(SR),'-f','f32le','-'],capture_output=True,check=True).stdout
    return np.frombuffer(raw,dtype=np.float32).copy()
f, bj, b0, b1 = sys.argv[1], sys.argv[2], int(sys.argv[3]), int(sys.argv[4])
x=load(f); bars=json.load(open(bj))['bar_starts_s']
bands={'sub40-120':(40,120),'low120-400':(120,400),'mid400-2k':(400,2000),'hi2k-6k':(2000,6000),'air6k-14k':(6000,14000)}
fx={k:sosfilt(butter(4,[a,b],btype='band',fs=SR,output='sos'),x) for k,(a,b) in bands.items()}
print('bar  t0      ', '  '.join(f'{k:>10}' for k in bands), ' full')
for i in range(b0,b1+1):
    a,b=bars[i-1],bars[i]; s0,s1=int(a*SR),int(b*SR)
    row=[10*np.log10(np.mean(fx[k][s0:s1]**2)+1e-12) for k in bands]
    full=10*np.log10(np.mean(x[s0:s1]**2)+1e-12)
    print(f'{i:3d} {a:7.2f}  ','  '.join(f'{v:10.1f}' for v in row), f'{full:6.1f}')
