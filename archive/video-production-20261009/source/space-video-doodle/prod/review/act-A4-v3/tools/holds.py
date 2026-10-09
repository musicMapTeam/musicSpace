# longest near-static stretch with the 12 fps boil removed (rhythm review #12): motion = mean |dI| (160x90 gray) between consecutive
# frames, boil-step frames skipped (the frame where floor(film_frame / 5) changes); prints the 5 longest runs under a threshold
import sys, json, subprocess, numpy as np
video = sys.argv[1]; thr = float(sys.argv[2]) if len(sys.argv) > 2 else 0.15
r = json.load(open(video[:-4] + '.render.json')); F0 = r['frames'][0]
raw = subprocess.run(['/opt/homebrew/bin/ffmpeg', '-v', 'error', '-i', video, '-vf', 'scale=160:90,format=gray', '-f', 'rawvideo', '-'], capture_output=True).stdout
fr = np.frombuffer(raw, np.uint8).reshape(-1, 90, 160).astype(np.float32)
d = np.abs(np.diff(fr, axis=0)).mean(axis=(1, 2))           # d[i] = motion from frame i to i+1
C = json.load(open(f"/tmp/space-video-doodle/prod/tools/tempo-maps/compiled/{r['map']}.json"))
def pos(t):
    for b in C['bars']:
        if b['t0'] <= t < b['t0'] + b['len']: return f"{b['sb']}:{1 + (t - b['t0']) / (b['len'] / 4):.2f}"
    return '?'
boil = [((F0 + i + 1) % 5 == 0) for i in range(len(d))]    # the step lands on film frames that are multiples of 5
runs, cur = [], None
for i, m in enumerate(d):
    if boil[i]: continue
    if m < thr:
        if cur is None: cur = [i, i]
        else: cur[1] = i
    else:
        if cur: runs.append(cur); cur = None
if cur: runs.append(cur)
runs = sorted(runs, key=lambda x: x[1] - x[0], reverse=True)[:5]
print(f'{len(fr)} frames; non-boil motion median {np.median([m for m, b in zip(d, boil) if not b]):.2f}, boil {np.median([m for m, b in zip(d, boil) if b]):.2f}')
for a, b in runs:
    t0 = (F0 + a) / 60; t1 = (F0 + b + 1) / 60
    print(f'  low-motion {t1 - t0:.2f} s  {pos(t0)} -> {pos(t1)}')
