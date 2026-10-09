import subprocess, sys, numpy as np
path=sys.argv[1]
w,h=480,270
raw=subprocess.check_output(['ffmpeg','-v','error','-i',path,'-vf',f'scale={w}:{h},format=gray','-f','rawvideo','-'])
n=len(raw)//(w*h)
a=np.frombuffer(raw[:n*w*h],dtype=np.uint8).reshape(n,h,w).astype(np.int16)
d=np.abs(a[1:]-a[:-1]).mean(axis=(1,2))
# find active runs (diff>0.05) allowing 3-frame gaps
act=d>0.05
runs=[];i=0
while i<len(act):
    if act[i]:
        j=i;gap=0
        k=i
        while k<len(act) and (act[k] or gap<4):
            if act[k]: j=k; gap=0
            else: gap+=1
            k+=1
        runs.append((i,j));i=j+1
    else:i+=1
fps=60
for (i,j) in runs:
    seg=d[i:j+1]
    print(f'run {i/fps:.2f}s-{j/fps:.2f}s len={len(seg)} frames, zero-diff(<0.02)={int((seg<0.02).sum())}, mean={seg.mean():.2f} ')
    print('   ', ' '.join(f'{x:.1f}' for x in seg[:60]))
