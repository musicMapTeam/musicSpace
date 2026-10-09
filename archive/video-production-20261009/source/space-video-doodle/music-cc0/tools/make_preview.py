#!/usr/bin/env python3
"""Cut a bar-aligned preview and loudness-normalise it.
usage: make_preview.py SRC START_S DUR_S OUT.m4a [--target -16] [--fade-in 0.03] [--fade-out 1.5]
Two steps: (1) cut + fades to a 48 kHz float WAV, measure EBU R128 integrated loudness; (2) apply the exact gain to reach the
target (pure gain, no compression), soft safety limiter only if the true peak would exceed -1.5 dBTP, encode AAC-LC 256 kb/s.
Prints the measured loudness of the final m4a."""
import sys, subprocess, re, argparse, os, json, tempfile

ap = argparse.ArgumentParser()
ap.add_argument('src'); ap.add_argument('start', type=float); ap.add_argument('dur', type=float); ap.add_argument('out')
ap.add_argument('--target', type=float, default=-16.0); ap.add_argument('--fade-in', type=float, default=0.03); ap.add_argument('--fade-out', type=float, default=1.5)
a = ap.parse_args()


def meas(p):
    r = subprocess.run(['ffmpeg', '-hide_banner', '-nostats', '-i', p, '-af', 'ebur128=peak=true', '-f', 'null', '-'], capture_output=True, text=True).stderr
    g = lambda pat: float(re.findall(pat, r)[-1])
    return dict(I=g(r'I:\s+(-?[\d.]+) LUFS'), LRA=g(r'LRA:\s+([\d.]+) LU'), TP=g(r'Peak:\s+(-?[\d.]+) dBFS'))


tmp = tempfile.mkdtemp()
w1 = os.path.join(tmp, 'cut.wav')
af = f"afade=t=in:st=0:d={a.fade_in},afade=t=out:st={a.dur - a.fade_out:.3f}:d={a.fade_out}"
subprocess.run(['ffmpeg', '-v', 'error', '-y', '-ss', f'{a.start:.3f}', '-t', f'{a.dur:.3f}', '-i', a.src, '-af', af, '-ar', '48000', '-ac', '2', '-c:a', 'pcm_f32le', w1], check=True)
m1 = meas(w1)
gain = a.target - m1['I']
limiter = (m1['TP'] + gain) > -1.5
w2 = os.path.join(tmp, 'gain.wav')
for it in range(5):
    chain = f'volume={gain:.2f}dB' + (',alimiter=limit=0.84:level=disabled:attack=2:release=60' if limiter else '')
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', w1, '-af', chain, '-c:a', 'pcm_f32le', w2], check=True)
    m = meas(w2)
    if abs(m['I'] - a.target) <= 0.1 or not limiter:
        break
    gain += a.target - m['I']
subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', w2, '-c:a', 'aac', '-b:a', '256k', '-ar', '48000', '-movflags', '+faststart',
                '-metadata', f'comment=preview {a.start:.3f}-{a.start + a.dur:.3f}s of {os.path.basename(a.src)}, normalised to {a.target} LUFS', a.out], check=True)
m2 = meas(a.out)
print(json.dumps(dict(out=a.out, src=os.path.basename(a.src), start_s=round(a.start, 3), dur_s=a.dur, cut_loudness=m1, gain_db=round(gain, 2),
                      limiter=limiter, final_loudness=m2)))
