#!/usr/bin/env python3
"""Write beats.json for each pick (grid, sections, edit points, loop/extension suggestions, preview info, cross-checks)
and copy the deep analysis + tag summaries into the pick folder.
usage: finalize.py PICK_DIR ANALYSIS_DIR AUDIO_FILE_IN_PICK PREVIEW_FILE PREVIEW_START [--tags-key KEY] [--old OLD_BEATMAP_JSON]"""
import sys, os, json, shutil, hashlib, argparse, subprocess
import numpy as np
sys.path.insert(0, os.path.dirname(__file__))
import deep

ap = argparse.ArgumentParser()
ap.add_argument('pick'); ap.add_argument('adir'); ap.add_argument('audio'); ap.add_argument('preview'); ap.add_argument('pstart', type=float)
ap.add_argument('--tags-key', default=None); ap.add_argument('--old', default=None); ap.add_argument('--old-analyze', default=None)
a = ap.parse_args()
A = json.load(open(os.path.join(a.adir, 'analysis.json')))
audio = os.path.join(a.pick, a.audio)
sha = hashlib.sha256(open(audio, 'rb').read()).hexdigest()
bar = A['tempo']['bar_s']
starts = A['grid']['bar_starts_s']
bars = A['bars']
rms = np.array([b['rms_db'] for b in bars])

# per-bar chroma + energy for loop search
y = deep.decode(audio)
f, S = deep.stft_mag(y, n=4096, hop=1024)
fps = deep.SR / 1024
C = deep.chroma_frames(S, f)
feat = []
for b0 in starts:
    i0, i1 = int(b0 * fps), int((b0 + bar) * fps)
    c = C[:, i0:i1].sum(1) if i1 > i0 else np.zeros(12)
    feat.append(c / (np.linalg.norm(c) + 1e-9))
feat = np.array(feat)
loops = []
for L in (8, 4):
    for i in range(0, len(starts) - L - 1):
        j = i + L
        if j >= len(feat) or rms[i] < rms.max() - 8 or rms[j - 1] < rms.max() - 8:
            continue
        sim = float(feat[i] @ feat[j])            # bar after the block looks like the block's first bar -> jump back is seamless
        sim_prev = float(feat[i - 1] @ feat[j - 1]) if i > 0 else 0.0   # bar before the block looks like the block's last bar
        drms = abs(rms[i] - rms[j]) + abs(rms[i - 1] - rms[j - 1]) if i > 0 else 9
        score = sim + sim_prev - 0.1 * drms
        loops.append(dict(bars=[i + 1, j], t=[starts[i], round(starts[j], 3)], length_s=round(L * bar, 3), chroma_sim_entry=round(sim, 3),
                          chroma_sim_exit=round(sim_prev, 3), rms_step_db=round(drms, 2), score=round(score, 3)))
loops.sort(key=lambda d: -d['score'])
best_loops = []
for lp in loops:
    if all(abs(lp['bars'][0] - b['bars'][0]) >= 4 for b in best_loops):
        best_loops.append(lp)
    if len(best_loops) >= 3:
        break

secs = A['sections']
edit_points = []
for k, s in enumerate(secs):
    if k == 0:
        continue
    step = s['rms_db'] - secs[k - 1]['rms_db']
    kind = 'entry/drop (energy up)' if step >= 2.5 else 'breakdown (energy down)' if step <= -2.5 else 'section change'
    edit_points.append(dict(t=s['t'][0], bar=s['bars'][0], kind=kind, rms_step_db=round(step, 1)))

tags = None
if a.tags_key:
    T = {}
    for fjs in ['/tmp/space-video-doodle/music-cc0/_deep/tags.json', '/tmp/space-video-doodle/music-cc0/_deep/tags2.json']:
        if os.path.exists(fjs):
            T.update(json.load(open(fjs)))
    for k, v in T.items():
        if k.startswith(a.tags_key):
            ml = v['music_labels']
            tags = dict(model='MIT/ast-finetuned-audioset-10-10-0.4593 (AudioSet AST), mean sigmoid over %d x 10.24 s windows' % v['windows'],
                        top15=v['top15'], selected={k2: ml[k2] for k2 in ['Singing', 'Speech', 'Vocal music', 'Guitar', 'Electric guitar', 'Bass guitar', 'Drum kit', 'Drum machine',
                                                                       'Brass instrument', 'Trumpet', 'Trombone', 'Saxophone', 'Synthesizer', 'Piano', 'Organ', 'Rock music', 'Pop music',
                                                                       'Funk', 'Disco', 'Electronic music', 'House music', 'Video game music', 'Happy music', 'Funny music',
                                                                       'Exciting music', 'Sad music', 'Tender music', 'Angry music'] if k2 in ml})
old = json.load(open(a.old)) if a.old and os.path.exists(a.old) else None
olda = None
if a.old_analyze and os.path.exists(a.old_analyze):
    for r in json.load(open(a.old_analyze)):
        if r['file'] in os.path.basename(a.old_analyze) or True:
            pass
out = dict(
    file=a.audio, sha256=sha, duration_s=A['duration_s'],
    tempo_bpm=A['tempo']['bpm'], beat_s=A['tempo']['beat_s'], bar_s=bar, time_signature='4/4 (assumed; drum pattern repeats every 4 beats)',
    first_downbeat_s=A['grid']['first_downbeat_s'], first_active_downbeat_s=A['grid'].get('first_active_downbeat_s'),
    downbeat_evidence=dict(margin=A['grid']['downbeat_margin'], scores_by_phase=A['grid']['downbeat_scores'],
                           note='margin = gap between best and second-best phase (kick-on-1 + chord change + backbeat z-scores); < 0.3 means check one bar on the waveform'),
    tempo_stability=dict(beat_phase_residual_sd_ms=A['tempo']['drift_ms']['resid_sd'], beat_phase_residual_max_ms=A['tempo']['drift_ms']['resid_max_abs'],
                         windows=A['tempo']['drift_ms']['windows'], note='residual of local beat alignment vs the global constant-tempo grid, 16-beat windows'),
    n_bars=A['grid']['n_bars'], bar_starts_s=starts,
    sections=secs, edit_points=edit_points,
    strongest_30s=dict(start_s=a.pstart, end_s=round(a.pstart + 30, 3), start_bar=int(np.argmin(np.abs(np.array(starts) - a.pstart))) + 1, preview_file=os.path.basename(a.preview)),
    loop_for_extension=best_loops,
    key=A['key'], loudness_full_track=A['loudness'],
    stems_demucs_htdemucs=A['stems'],
    audioset_tags=tags,
    crosscheck_old_beatmap_py=(dict(bpm=old['bpm'], first_downbeat_s=old['first_downbeat_s'], downbeat_offset_beats=old['downbeat_offset_beats']) if old else None),
    method='tools/deep.py: spectral-flux onset envelope (40-8000 Hz, hop 5.8 ms), autocorrelation tempo + octave check, comb fit over the whole track, '
           'beat-phase drift regression, +30 ms onset-bias correction (calibrated on synthetic hits), downbeat from kick/chord-change/backbeat evidence; '
           'sections from bar-level novelty + >=4 dB energy steps; stems by Demucs htdemucs (encoder delay removed). Nobody listened to the audio.')
json.dump(out, open(os.path.join(a.pick, 'beats.json'), 'w'), indent=1, ensure_ascii=False)
shutil.copy(os.path.join(a.adir, 'analysis.json'), os.path.join(a.pick, 'analysis-deep.json'))
shutil.copy(os.path.join(a.adir, 'analysis.png'), os.path.join(a.pick, 'analysis-deep.png'))
print(json.dumps(dict(pick=a.pick, bpm=out['tempo_bpm'], first_downbeat=out['first_downbeat_s'], loops=best_loops[:2], edit_points=edit_points[:12]), ensure_ascii=False))
