#!/usr/bin/env python3
"""analyze a numbered frame sequence dir (f%06d.png|jpg): zero-diff stats per motion run.
usage: analyze-seq.py DIR FPS"""
import sys, subprocess, numpy as np, os
d=sys.argv[1]; fps=float(sys.argv[2])
ext='png' if os.path.exists(d+'/f000000.png') else 'jpg'
raw=subprocess.check_output(['ffmpeg','-v','error','-framerate',str(fps),'-i',f'{d}/f%06d.{ext}','-vf','scale=480:270,format=gray','-fps_mode','passthrough','-f','rawvideo','-'])
n=len(raw)//(480*270)
a=np.frombuffer(raw[:n*480*270],dtype=np.uint8).reshape(n,270,480).astype(np.int16)
dd=np.abs(a[1:]-a[:-1]).mean(axis=(1,2))
print(n,'frames',f'@{fps}fps')
act=dd>0.05
runs=[];i=0
while i<len(act):
    if act[i]:
        j=i;k=i;gap=0
        while k<len(act) and (act[k] or gap<4):
            if act[k]: j=k;gap=0
            else: gap+=1
            k+=1
        runs.append((i,j));i=j+1
    else:i+=1
for (i,j) in runs:
    seg=dd[i:j+1]
    if len(seg)<4: continue
    print(f'motion {i/fps:.2f}-{j/fps:.2f}s: {len(seg)} frames, zero-diff {(seg<0.02).sum()}, mean {seg.mean():.2f}')
    print('   '+' '.join(f'{x:.1f}' for x in seg[:80]))
