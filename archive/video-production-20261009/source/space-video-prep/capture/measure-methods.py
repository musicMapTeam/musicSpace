#!/usr/bin/env python3
"""Measure smoothness of every capture method that was tried on the same 10 s RC4 camera-move scenario (1920x1080, real Apple GPU).
For each method: frames delivered, UNIQUE frames (consecutive-frame mean diff >= 0.02 on a 480x270 grey proxy) during the motion windows, unique fps during motion, and the longest gap between two unique frames.
Sequence dirs (CDP screencast / screenshot loops) are timed from their concat.txt (real per-frame durations); webm/mp4 files are analysed at their native rate."""
import subprocess, sys, json, os, re, numpy as np
def gray_frames(args):
    raw = subprocess.check_output(['ffmpeg', '-v', 'error', *args, '-vf', 'scale=480:270,format=gray', '-fps_mode', 'passthrough', '-f', 'rawvideo', '-'])
    n = len(raw) // (480 * 270); return np.frombuffer(raw[:n * 480 * 270], dtype=np.uint8).reshape(n, 270, 480).astype(np.int16)
def report(name, a, ts):
    d = np.abs(a[1:] - a[:-1]).mean(axis=(1, 2)); uniq = d >= 0.02
    # motion windows: stretches where unique frames occur with gaps shorter than 0.4 s
    idx = np.where(uniq)[0]
    if len(idx) < 3: print(f'{name:28s} frames {len(a):4d}  (no motion detected)'); return
    wins = []; s = idx[0]; p = idx[0]
    for i in idx[1:]:
        if ts[i + 1] - ts[p + 1] > 0.4: wins.append((s, p)); s = i
        p = i
    wins.append((s, p))
    wins = [w for w in wins if ts[w[1] + 1] - ts[w[0] + 1] > 0.5]
    tot_t = sum(ts[w[1] + 1] - ts[w[0] + 1] for w in wins); tot_u = sum(int(uniq[w[0]:w[1] + 1].sum()) for w in wins)
    gaps = []
    for w in wins:
        u = [i for i in range(w[0], w[1] + 1) if uniq[i]]
        gaps += [ts[u[k + 1] + 1] - ts[u[k] + 1] for k in range(len(u) - 1)]
    print(f'{name:28s} frames {len(a):4d}  unique-fps in motion {tot_u / max(tot_t, 1e-9):5.1f}  longest gap {max(gaps) * 1000 if gaps else 0:6.0f} ms  p95 gap {np.percentile(gaps, 95) * 1000 if gaps else 0:5.0f} ms  (motion {tot_t:.1f} s in {len(wins)} windows)')
def seq(d):
    lines = open(os.path.join(d, 'concat.txt')).read().split('\n'); files = [re.search(r"'(.+)'", l).group(1) for l in lines if l.startswith('file')]
    durs = [float(l.split()[1]) for l in lines if l.startswith('duration')]; ts = np.concatenate([[0], np.cumsum(durs)])
    ext = os.path.splitext(files[0])[1]; tmp = '/tmp/_seq_%d' % os.getpid(); os.makedirs(tmp, exist_ok=True)
    for i, f in enumerate(files): os.symlink(f, f'{tmp}/f{i:06d}{ext}')
    a = gray_frames(['-framerate', '60', '-i', f'{tmp}/f%06d{ext}']); subprocess.call(['rm', '-rf', tmp]); return a, ts[:len(a) + 1]
base = '/tmp/space-video-prep/capture/runs'
for m in ['motion-cdpscreencast', 'motion-cdpshot', 'motion-shots', 'motion-shotspng', 'motion-pwonframe']:
    if os.path.exists(f'{base}/{m}/concat.txt'): a, ts = seq(f'{base}/{m}'); report(m, a, ts)
for name, f in [('playwright recordVideo', [x for x in os.listdir(f'{base}/pwvideo') if x.endswith('.webm')]), ('playwright screencast', ['screencast.webm'])]:
    p = f'{base}/pwvideo/{f[0]}' if name.startswith('playwright rec') else f'{base}/pwscreencast/{f[0]}'
    a = gray_frames(['-i', p]); report(name, a, np.arange(len(a) + 1) / 25.0)
for name, p in [('FRAME-STEPPED (virtual clock)', '/tmp/space-video-prep/clips/test-rc4-eventroom-10s.mp4')]:
    a = gray_frames(['-i', p]); report(name, a, np.arange(len(a) + 1) / 60.0)
