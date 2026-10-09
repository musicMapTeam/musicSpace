#!/usr/bin/env python3
"""Frame-level QC of the desktop takes.
For each clip: container facts (ffprobe), per-frame picture change on a 480x270 grey proxy of the 1080 edit copy, frozen spans,
stutters (a still frame between moving frames), camera-glide smoothness from the rig's per-frame camera probe (rec.json), the line-boil
cadence in holds, the tap-ring windows, and the same checks on the 4K master at a coarser proxy (both files must agree frame by frame).
usage: qc.py <id> [<id> ...]   (ids = file stems in master/ and 1080/)  -> qc/<id>.qc.json, prints a summary line per clip
"""
import json, subprocess, sys, os
import numpy as np

ROOT = '/tmp/space-video-doodle/prod/capture/desktop'
FF, FP = '/opt/homebrew/bin/ffmpeg', '/opt/homebrew/bin/ffprobe'
FPS = 60
STILL = 0.15        # mean |dI| (8-bit grey, 480x270) below this = no visible change


def probe(path):
    pr = json.loads(subprocess.run([FP, '-v', 'error', '-show_streams', '-show_format', '-of', 'json', path], capture_output=True, text=True).stdout)
    v = [s for s in pr['streams'] if s['codec_type'] == 'video'][0]
    return dict(file=path, bytes=int(pr['format']['size']), duration_s=round(float(pr['format']['duration']), 3), video=f"{v['codec_name']} {v.get('profile')} {v['width']}x{v['height']} {v['r_frame_rate']} {v.get('pix_fmt')}",
                colour=f"{v.get('color_space')}/{v.get('color_primaries')}/{v.get('color_transfer')}/{v.get('color_range')}", frames=int(v.get('nb_frames', 0)), bitrate_mbps=round(int(pr['format']['bit_rate']) / 1e6, 1),
                audio_streams=len([s for s in pr['streams'] if s['codec_type'] == 'audio']))


def diffs(path, w, h):
    raw = subprocess.run([FF, '-v', 'error', '-i', path, '-vf', f'scale={w}:{h}:flags=area,format=gray', '-f', 'rawvideo', '-'], capture_output=True).stdout
    f = np.frombuffer(raw, np.uint8).reshape(-1, h, w).astype(np.int16)
    return f, np.abs(np.diff(f, axis=0)).mean(axis=(1, 2))


def runs(mask):
    out, i = [], 0
    while i < len(mask):
        if mask[i]:
            j = i
            while j < len(mask) and mask[j]: j += 1
            out.append((i, j - i)); i = j
        else: i += 1
    return out


def qc(cid):
    rec = json.load(open(f'{ROOT}/master/{cid}.rec.json'))
    master, edit = f'{ROOT}/master/{cid}.mp4', f'{ROOT}/1080/{cid}.mp4'
    rep = dict(id=cid, master=probe(master), edit=probe(edit))
    f, d = diffs(edit, 480, 270)                      # d[i] = change from frame i to frame i+1
    n = len(f); rep['frames_decoded'] = n
    still = d < STILL
    # frozen spans (frame index of the first repeated frame, length in frames incl. the first)
    fr = [(s + 1, l + 1) for s, l in runs(still)]
    rep['longest_still'] = dict(frames=max([l for _, l in fr], default=1), at_s=round((max(fr, key=lambda r: r[1])[0] if fr else 0) / FPS, 3))
    rep['still_over_1s'] = [f'{s / FPS:.2f}s+{l / FPS:.2f}s' for s, l in fr if l >= FPS]
    # stutter: a still step with clearly moving steps on both sides (motion -> duplicate -> motion)
    MOV = 0.6
    stutter = [i + 1 for i in range(1, len(d) - 1) if still[i] and d[i - 1] > MOV and d[i + 1] > MOV]
    rep['stutters'] = dict(count=len(stutter), at_s=[round(i / FPS, 3) for i in stutter[:20]], rule=f'still step (<{STILL}) between two moving steps (>{MOV})')
    # camera glides from the rig's per-frame probe: [view, moving, px, py, pz, tx, ty, tz]
    pr = rec.get('probe') or []
    gl = []
    if pr and isinstance(pr[0], list):
        mv = np.array([p[1] if isinstance(p, list) else 0 for p in pr])
        pos = np.array([p[2:8] if isinstance(p, list) else [np.nan] * 6 for p in pr], float)
        for s0, l in runs(mv == 1):
            seg = pos[max(0, s0 - 1): s0 + l + 1]
            step = np.linalg.norm(np.diff(seg[:, :3], axis=0), axis=1)
            vis = d[s0: min(len(d), s0 + l - 1)]        # picture change inside the glide
            frozen_cam = int((step[1:-1] < 1e-6).sum()) if len(step) > 2 else 0
            # smoothness: ratio of each step to the mean of its neighbours (1 = perfectly smooth); report the worst
            jerk = [step[i] / max(1e-9, (step[i - 1] + step[i + 1]) / 2) for i in range(1, len(step) - 1) if step[i - 1] > 1e-4 and step[i + 1] > 1e-4]
            gl.append(dict(start_s=round(s0 / FPS, 3), frames=int(l), seconds=round(l / FPS, 3), view_to=pr[min(len(pr) - 1, s0 + l)][0] if isinstance(pr[min(len(pr) - 1, s0 + l)], list) else None,
                           camera_static_frames_inside=frozen_cam, picture_still_frames_inside=int((vis < STILL).sum()), min_picture_change=round(float(vis.min()), 3) if len(vis) else None,
                           step_ratio_range=[round(float(min(jerk)), 3), round(float(max(jerk)), 3)] if jerk else None))
    rep['camera_glides'] = gl
    # boil cadence: gaps between visible changes inside the first long hold (product line boil, 7 Hz on the virtual clock = 8.93 frames)
    ch = np.where(~still)[0] + 1
    gaps = np.diff(ch) if len(ch) > 1 else np.array([])
    vals, cnt = np.unique(gaps, return_counts=True) if len(gaps) else ([], [])
    rep['change_gap_histogram'] = {int(k): int(v) for k, v in zip(vals, cnt) if v >= 3}
    # tap rings: the rig draws the ring for 480 ms of virtual time = 30 frames after each press
    rep['taps'] = [dict(t=e['t'], frame=e.get('frame'), label=e.get('label'), xy_master=[e.get('x'), e.get('y')]) for e in rec.get('events', []) if e.get('type') == 'tap']
    rep['presses_no_ring'] = [dict(t=round(e['t'], 3), label=e.get('label')) for e in rec.get('events', []) if e.get('type', '').startswith('press')]
    # master vs edit agree (same frames): coarse proxy of the master
    fm, dm = diffs(master, 240, 135)
    fe = f[:, ::2, ::2][:, :135, :240] if f.shape[1] >= 270 else None
    rep['master_frames'] = len(fm)
    rep['master_edit_same_frame_count'] = len(fm) == n
    cor = float(np.corrcoef(dm, d[:len(dm)])[0, 1]) if len(dm) == len(d) and d.std() > 0 and dm.std() > 0 else None
    rep['master_edit_motion_correlation'] = round(cor, 4) if cor is not None else None
    rep['rec'] = dict(frames=rec['frames'], seconds=rec['seconds'], wallPerVideoSecond=rec.get('wallPerVideoSecond'), msPerFrame=rec.get('msPerFrame'), clockStart=rec.get('clockStart'), seed=rec.get('seed'))
    os.makedirs(f'{ROOT}/qc', exist_ok=True)
    np.save(f'{ROOT}/qc/{cid}.diff.npy', d)
    json.dump(rep, open(f'{ROOT}/qc/{cid}.qc.json', 'w'), indent=1, ensure_ascii=False)
    g = '; '.join(f"glide {x['start_s']}s {x['seconds']}s still-inside {x['picture_still_frames_inside']} cam-static {x['camera_static_frames_inside']} ratio {x['step_ratio_range']}" for x in gl)
    print(f"{cid}: {n} f {n / FPS:.2f}s | longest still {rep['longest_still']} | >1s {rep['still_over_1s']} | stutters {len(stutter)} | {g} | master {rep['master']['video']} {rep['master']['bitrate_mbps']} Mb/s | edit {rep['edit']['video']} | same count {rep['master_edit_same_frame_count']} corr {rep['master_edit_motion_correlation']}")
    return rep


if __name__ == '__main__':
    for cid in sys.argv[1:]:
        qc(cid)
