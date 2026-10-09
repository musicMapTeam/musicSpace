# QC for doodle-motion renders.   python tools/qc.py <video.mp4> <scene.info.json> <report.json>
# Checks: container/codec/fps/colour tags, duration, size, loudness (ebur128: I, TP, LRA), silences, black frames, frozen picture
# (ffmpeg freezedetect at -60 dB / 2.5 s), longest low-motion stretch (pixel motion on a 160x90 proxy), longest gap between visual
# events (scene log), event-to-beat alignment, reading time of every on-screen line (>= 0.25 s per character and >= 0.9 s),
# and that the product-footage feed advances every frame where it should (no stale/duplicated screenshots).
import json, re, subprocess, sys, numpy as np
FF, FP = '/opt/homebrew/bin/ffmpeg', '/opt/homebrew/bin/ffprobe'
video, infof, outf = sys.argv[1], sys.argv[2], sys.argv[3]
info = json.load(open(infof)); fps = info['fps']; beat = 60 / info['bpm']; rep = {'file': video}
pr = json.loads(subprocess.run([FP, '-v', 'error', '-show_streams', '-show_format', '-of', 'json', video], capture_output=True, text=True).stdout)
v = [s for s in pr['streams'] if s['codec_type'] == 'video'][0]; a = [s for s in pr['streams'] if s['codec_type'] == 'audio']
rep['container'] = dict(duration_s=round(float(pr['format']['duration']), 3), bytes=int(pr['format']['size']), video=f"{v['codec_name']} {v.get('profile')} {v['width']}x{v['height']} {v['r_frame_rate']} {v.get('pix_fmt')}",
                        colour=f"{v.get('color_space')}/{v.get('color_primaries')}/{v.get('color_transfer')}/{v.get('color_range')}", frames=int(v.get('nb_frames', 0)),
                        audio=(f"{a[0]['codec_name']} {a[0]['sample_rate']} Hz {a[0]['channels']} ch" if a else None))
def ff_af(filt):
    return subprocess.run([FF, '-hide_banner', '-nostats', '-i', video, '-af', filt, '-f', 'null', '-'], capture_output=True, text=True).stderr
if a:
    e = ff_af('ebur128=peak=true')
    rep['loudness'] = dict(I_LUFS=float(re.findall(r'I:\s+(-?[\d.]+) LUFS', e)[-1]), TP_dBTP=float(re.findall(r'Peak:\s+(-?[\d.]+) dBFS', e)[-1]), LRA_LU=float(re.findall(r'LRA:\s+(-?[\d.]+) LU', e)[-1]))
    sd = ff_af('silencedetect=n=-50dB:d=0.8'); rep['silences_over_0.8s'] = re.findall(r'silence_start: ([\d.]+)', sd)
vf = subprocess.run([FF, '-hide_banner', '-nostats', '-i', video, '-vf', 'freezedetect=n=-60dB:d=2.5,blackdetect=d=0.4:pix_th=0.05', '-an', '-f', 'null', '-'], capture_output=True, text=True).stderr
rep['frozen_over_2.5s'] = re.findall(r'freeze_start: ([\d.]+)', vf); rep['black_over_0.4s'] = re.findall(r'black_start:([\d.]+)', vf)
# motion proxy
raw = subprocess.run([FF, '-v', 'error', '-i', video, '-vf', 'scale=160:90:flags=area,format=gray', '-f', 'rawvideo', '-'], capture_output=True).stdout
fr = np.frombuffer(raw, np.uint8).reshape(-1, 90, 160).astype(np.float32); d = np.abs(np.diff(fr, axis=0)).mean(axis=(1, 2))
def longest_below(x, thr):
    best = cur = 0; start = bs = 0
    for i, val in enumerate(x):
        if val < thr: cur += 1; start = start if cur > 1 else i
        else: cur = 0
        if cur > best: best, bs = cur, start
    return best / fps, bs / fps
lb, at = longest_below(d, 0.15)
rep['motion'] = dict(mean_abs_diff=round(float(d.mean()), 3), frames_without_any_change=int((d == 0).sum()), longest_low_motion_s=round(lb, 2), at_s=round(at, 2), threshold='mean |dI| < 0.15 (8-bit, 160x90)')
# scene-side rhythm checks
ev = sorted(e['t'] for e in info['events']); gaps = np.diff([0] + ev + [info['duration']])
rep['events'] = dict(count=len(ev), longest_gap_s=round(float(gaps.max()), 3), longest_gap_at_s=round(float(([0] + ev)[int(gaps.argmax())]), 3), events_per_second=round(len(ev) / info['duration'], 2))
def grid_err(g): off = [((t - info['offset']) / g) % 1 for t in ev]; return [min(o, 1 - o) * g * 1000 for o in off]
e8, e16 = grid_err(beat / 2), grid_err(beat / 4)
fq = [abs(round(t * fps) / fps - t) * 1000 for t in ev]
rep['beat_alignment'] = dict(on_8th_grid=f"{sum(e < 1 for e in e8)}/{len(ev)}", on_16th_grid=f"{sum(e < 1 for e in e16)}/{len(ev)}", worst_vs_16th_ms=round(max(e16), 2),
                             frame_quantisation_ms_max=round(max(fq), 2), note='visual events vs the music grid (8ths / 16ths), then the frame they land on (60 fps)')
rt = []; merged = []
for tx in sorted(info.get('texts', []), key=lambda x: x['t0']):   # the same line carried across a cut counts as one window
    m = next((m for m in merged if m['text'] == tx['text'] and abs(tx['t0'] - m['t1']) < 0.1), None)
    if m: m['t1'] = max(m['t1'], tx['t1'])
    else: merged.append(dict(tx))
for tx in merged:
    n = len(re.sub(r'[\s，。、！？…·：；,.!?]', '', tx['text'])); need = max(0.9, 0.25 * n); have = tx['t1'] - tx['t0']
    rt.append(dict(text=tx['text'], chars=n, on_s=round(have, 2), need_s=round(need, 2), ok=have + 1e-6 >= need))
rep['reading_time'] = dict(lines=len(rt), failing=[r for r in rt if not r['ok']], all=rt)
# feed advance (phone screen region, bar 13 of the animatic: the capture plays 1:1 there)
if 'feedCheck' in info.get('marks', {}):
    x0, y0, x1, y1, t0, t1 = info['marks']['feedCheck']
    raw2 = subprocess.run([FF, '-v', 'error', '-ss', str(t0), '-t', str(t1 - t0), '-i', video, '-vf', f'crop={x1 - x0}:{y1 - y0}:{x0}:{y0},format=gray', '-f', 'rawvideo', '-'], capture_output=True).stdout
    g = np.frombuffer(raw2, np.uint8).reshape(-1, y1 - y0, x1 - x0).astype(np.float32); dd = np.abs(np.diff(g, axis=0)).mean(axis=(1, 2))
    rep['feed_advance'] = dict(frames=len(g), identical_consecutive=int((dd < 0.02).sum()), min_diff=round(float(dd.min()), 3))
json.dump(rep, open(outf, 'w'), indent=1, ensure_ascii=False)
short = {k: v for k, v in rep.items() if k not in ('reading_time',)}; short['reading_time'] = {'lines': rep['reading_time']['lines'], 'failing': rep['reading_time']['failing']}
print(json.dumps(short, indent=1, ensure_ascii=False))
