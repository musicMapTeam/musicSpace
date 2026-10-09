import sys, numpy as np, subprocess, json
from scipy.signal import welch
def load(path, sr=44100, maxsec=None):
    cmd=['ffmpeg','-v','error','-i',path,'-ac','1','-ar',str(sr),'-f','f32le','-']
    if maxsec: cmd[3:3]=['-t',str(maxsec)]
    raw=subprocess.run(cmd,capture_output=True).stdout
    return np.frombuffer(raw,dtype=np.float32), sr
bands=[(20,60),(60,120),(120,250),(250,500),(500,1000),(1000,2000),(2000,4000),(4000,8000),(8000,12000),(12000,16000)]
def ltas(path):
    x,sr=load(path)
    f,p=welch(x,sr,nperseg=8192)
    tot=p.sum()
    out=[]
    for lo,hi in bands:
        m=(f>=lo)&(f<hi); out.append(10*np.log10(p[m].sum()/tot+1e-12))
    # crest factor / peak
    peak=np.max(np.abs(x)); rms=np.sqrt(np.mean(x**2))
    # spectral centroid
    cen=(f*p).sum()/p.sum()
    return out, 20*np.log10(peak+1e-9), 20*np.log10(rms+1e-9), cen
for name,path in [('original-v2','original-v2/space-original-v2_-16LUFS_48k24.wav'),
                  ('ocean-breeze','02-ocean-breeze__HoliznaCC0/HoliznaCC0_-_Ocean_Breeze.mp3'),
                  ('orbs','01-orbs-in-a-photo__HoliznaCC0/HoliznaCC0_-_Orbs_In_A_Photo.mp3'),
                  ('walking','03-walking-away__HoliznaCC0/HoliznaCC0_-_Walking_Away.mp3')]:
    o,pk,rms,cen=ltas(path)
    print(f"{name:14s} peak {pk:6.1f} rms {rms:6.1f} centroid {cen:6.0f} Hz | "+' '.join(f"{v:6.1f}" for v in o))
print('bands', bands)
