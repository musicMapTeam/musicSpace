#!/usr/bin/env python3
"""Frame-level QC of a captured clip (decoded mp4, grey, 1/4 size).
- per-frame mean |dI| vs the previous frame; 'static' = < 0.15 grey levels (H.264 noise floor)
- stutter check: a static run of 1-3 frames whose neighbours both move strongly (> 0.6) while the motion continues
  is a duplicated frame inside motion -> listed under 'stutter' (should be empty)
- holds: static runs >= 0.5 s (fine when the product is still; listed so the editor knows where it can trim)
- motion segments: runs of moving frames, with the per-frame diff min/median
- black / blank frames (mean < 8 or > 250) and a coarse colour check (BT.709 tags) from ffprobe
usage: qc_clip.py clip.mp4 [out.json]
"""
import json, subprocess, sys
import numpy as np

FF, FP = '/opt/homebrew/bin/ffmpeg', '/opt/homebrew/bin/ffprobe'
src = sys.argv[1]
pr = json.loads(subprocess.run([FP, '-v', 'error', '-select_streams', 'v:0', '-show_entries',
                                'stream=width,height,avg_frame_rate,r_frame_rate,nb_frames,pix_fmt,codec_name,profile,color_space,color_transfer,color_primaries,color_range,bit_rate',
                                '-show_entries', 'format=duration,size', '-of', 'json', src], capture_output=True, text=True).stdout)
st = pr['streams'][0]
W, H = st['width'], st['height']
sw, sh = W // 4, H // 4
raw = subprocess.run([FF, '-v', 'error', '-i', src, '-vf', f'scale={sw}:{sh}:flags=area,format=gray', '-f', 'rawvideo', '-'], capture_output=True).stdout
f = np.frombuffer(raw, np.uint8).reshape(-1, sh, sw).astype(np.int16)
n = len(f)
d = np.abs(np.diff(f, axis=0)).mean(axis=(1, 2))      # d[i] = change from frame i to i+1
still = d < 0.15
fps = 60

def runs(mask):
    out, i = [], 0
    while i < len(mask):
        if mask[i]:
            j = i
            while j < len(mask) and mask[j]: j += 1
            out.append((i, j - i)); i = j
        else: i += 1
    return out

stutter = []
for s0, ln in runs(still):
    if ln > 3: continue
    a = d[s0 - 1] if s0 - 1 >= 0 else 0
    b = d[s0 + ln] if s0 + ln < len(d) else 0
    if a > 0.6 and b > 0.6:
        stutter.append({'frame': int(s0 + 1), 'dupFrames': int(ln), 'diffBefore': round(float(a), 2), 'diffAfter': round(float(b), 2)})
holds = [{'from': int(s0 + 1), 'frames': int(ln + 1), 'at_s': round((s0 + 1) / fps, 2), 'seconds': round((ln + 1) / fps, 2)} for s0, ln in runs(still) if ln + 1 >= 30]
moving = [(s0, ln) for s0, ln in runs(~still) if ln >= 4]
motion = [{'from': int(s0), 'to': int(s0 + ln), 'at_s': round(s0 / fps, 2), 'seconds': round(ln / fps, 2), 'minDiff': round(float(d[s0:s0 + ln].min()), 2), 'medDiff': round(float(np.median(d[s0:s0 + ln])), 2)} for s0, ln in moving]
means = f.mean(axis=(1, 2))
blank = [int(i) for i in np.where((means < 8) | (means > 250))[0]]
out = {
    'file': src.split('/')[-1], 'codec': f"{st.get('codec_name')} {st.get('profile')}", 'size': f'{W}x{H}', 'fps': st.get('avg_frame_rate'),
    'frames': n, 'seconds': round(n / fps, 3), 'pix_fmt': st.get('pix_fmt'),
    'colour': f"{st.get('color_primaries')}/{st.get('color_transfer')}/{st.get('color_space')}/{st.get('color_range')}",
    'bytes': int(pr['format']['size']), 'kbps': round(int(pr['format']['size']) * 8 / (n / fps) / 1000),
    'changedFrames': int((~still).sum()), 'staticFrames': int(still.sum()),
    'stutter_dupInsideMotion': stutter,
    'holds_over_0.5s': holds,
    'motionSegments_over_4f': motion,
    'blankFrames': blank,
    'meanDiff': round(float(d.mean()), 3),
}
js = json.dumps(out, ensure_ascii=False, indent=1)
if len(sys.argv) > 2:
    open(sys.argv[2], 'w').write(js)
    np.save(sys.argv[2].replace('.json', '.diff.npy'), d)
print(js)
