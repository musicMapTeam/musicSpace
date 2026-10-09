#!/usr/bin/env python3
"""Music edit tool: renders the edited music bed of a tempo map (bar-accurate splices, short crossfades that END on the downbeat,
fade-out / natural ring under the end card), -16 LUFS integrated, true peak <= -1.0 dBTP, and measures what the edit really does.

  PY tools/music.py render <map|all>      -> audio/beds/<map>.wav (48 kHz / 24-bit) + .m4a preview + .report.json
  PY tools/music.py moments <map|all>     -> the storyboard's structural moments measured on the rendered bed (table)
  PY tools/music.py prepare original-124  -> (re)render the original score with the map's SCORE_CONFIG (only for maps with "render")

Report (audio/beds/<map>.report.json): segments and splices (with a click check), loudness before/after, limiter work, onsets vs the
beat grid (median offset of the strong onsets, share within +-20 ms), and every storyboard moment with a verdict
(title stop, pain sparse, drop, AI chime, payoff gap + payoff rank, social groove, break, lift, end resolve).
"""
import json, os, sys, subprocess
import numpy as np
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import tempo
from audiolib import SR, FF, decode, write_wav, ebur128, normalize, onset_env, beat_db, ONSET_BIAS_MS

BEDS = os.path.join(HERE, '..', 'audio', 'beds')
_decoded = {}


def track_audio(C):
    p = C['track']['audio']
    if p not in _decoded:
        _decoded[p] = decode(p)
    return _decoded[p]


def render_bed(C, xf_ms=None):
    """assemble the bed sample-accurately from the compiled map; returns (audio, splices)"""
    x = track_audio(C)
    xf_default = (C.get('xfade_ms', 20) if xf_ms is None else xf_ms)
    N = C['end_samples']
    def rms_db(a, b):
        seg = x[max(0, a):max(a + 1, b)]; return 20 * np.log10(np.sqrt((seg ** 2).mean() + 1e-18))
    out = np.zeros((N, 2))
    bars = C['bars']
    # contiguous runs of track bars
    runs = []
    for b in bars:
        if runs and not b['splice'] and b['trk'] == runs[-1][-1]['trk'] + 1:
            runs[-1].append(b)
        else:
            runs.append([b])
    # per-splice crossfade length (ends on the downbeat): default, or 60 ms when the music drops by > 6 dB at the splice
    xfs = [0]
    for i in range(1, len(runs)):
        prev, nxt = runs[i - 1][-1], runs[i][0]
        a = int(round(prev['src0'] * SR)); lp = rms_db(a, a + prev['n'])
        b = int(round(nxt['src0'] * SR)); ln = rms_db(b, b + int(nxt['n'] / 4))
        ms = xf_default if ln > lp - 6 else max(xf_default, 60)
        xfs.append(int(round(ms * SR / 1000)))
    splices = []
    for i, r in enumerate(runs):
        o0 = r[0]['s0']; o1 = r[-1]['s0'] + r[-1]['n']
        s0 = int(round(r[0]['src0'] * SR))
        last = (i == len(runs) - 1)
        if last:
            o1 = N                                   # the last run continues into the tail (ring / fade under the end card)
        pre = xfs[i] if i > 0 else 0
        xf_out = xfs[i + 1] if i + 1 < len(runs) else 0
        a, b = s0 - pre, s0 + (o1 - o0)
        seg = np.zeros((b - a, 2))
        aa, bb = max(0, a), min(len(x), b)
        if bb > aa:
            seg[aa - a:bb - a] = x[aa:bb]
        if i > 0:       # fade in over the pre-roll: equal power, full level on the downbeat
            w = np.sin(np.linspace(0, np.pi / 2, pre, endpoint=False))[:, None]
            seg[:pre] *= w
        else:
            f = int(0.002 * SR); seg[:f] *= np.linspace(0, 1, f)[:, None]
        if not last and xf_out > 0:   # fade out over the last xf samples of the run (the next run fades in over the same window)
            w = np.cos(np.linspace(0, np.pi / 2, xf_out, endpoint=False))[:, None]
            seg[-xf_out:] *= w
        out[o0 - pre:o1] += seg[:(o1 - (o0 - pre))]
        if i > 0:
            prev = runs[i - 1][-1]
            splices.append(dict(t=round(o0 / SR, 4), at=f"{r[0]['sb']}:1", from_trk=prev['trk'], to_trk=r[0]['trk'], xfade_ms=round(pre / SR * 1000, 1)))
    # fade-out under the end card (map "fade"), and a short safety fade at the very end
    tl = tempo.Timeline(C)
    if C.get('fade'):
        t0 = tl.tc(C['fade']['from']); a = int(t0 * SR); n = N - a
        k = np.linspace(0, 1, n)
        g = np.cos(k * np.pi / 2) ** 2 if C['fade'].get('shape', 'cos') == 'cos' else (1 - k) ** 2
        out[a:] *= g[:, None]
    f = int(0.25 * SR); out[-f:] *= np.linspace(1, 0, f)[:, None] ** 2
    return out, splices


def splice_clicks(y, splices, C):
    """click check: high-frequency (> 6 kHz) energy in a 4 ms window centred on the splice vs the louder of its neighbourhoods
    (t-24..t-8 ms, t+8..t+24 ms) = a local spike in dB; the same spike measured on the incoming bar's NATURAL downbeat in the track
    is subtracted (a drum hit on the downbeat is music, not a click).  > +6 dB above the natural downbeat = flagged."""
    from scipy.signal import butter, sosfiltfilt
    sos = butter(4, 6000, 'hp', fs=SR, output='sos')
    src = track_audio(C)
    def spike(sig, t):
        a = int((t - 0.06) * SR); b = int((t + 0.06) * SR)
        seg = sig[max(0, a):b].mean(axis=1)
        if a < 0:
            seg = np.concatenate([np.zeros(-a), seg])
        hp = sosfiltfilt(sos, seg)
        def e(t0, t1):
            i0, i1 = int((t0 - (t - 0.06)) * SR), int((t1 - (t - 0.06)) * SR); w = hp[i0:i1]
            return 20 * np.log10(np.sqrt((w ** 2).mean() + 1e-20))
        return e(t - 0.002, t + 0.002) - max(e(t - 0.024, t - 0.008), e(t + 0.008, t + 0.024))
    src0 = {b['k']: b['src0'] for b in C['bars']}
    out = []
    for s in splices:
        k = next(b['k'] for b in C['bars'] if abs(b['t0'] - s['t']) < 1e-3)
        so, sn = spike(y, s['t']), spike(src, src0[k])
        out.append(dict(s, hf_spike_db=round(float(so), 1), natural_spike_db=round(float(sn), 1), click=bool(so - sn > 6)))
    return out


def onsets_vs_grid(y, C):
    env, ft = onset_env(y)
    tl = tempo.Timeline(C)
    beats = []
    for b in C['bars']:
        for k in range(C['bpb']):
            beats.append(b['t0'] + k * b['len'] / C['bpb'])
    offs, strengths = [], []
    for t in beats:
        i0, i1 = np.searchsorted(ft, t - 0.07), np.searchsorted(ft, t + 0.07)
        if i1 <= i0:
            continue
        j = i0 + int(np.argmax(env[i0:i1]))
        offs.append(ft[j] - t); strengths.append(env[j])
    offs, strengths = np.array(offs), np.array(strengths)
    strong = strengths >= np.percentile(strengths, 50)
    o = offs[strong] * 1000 - ONSET_BIAS_MS
    return dict(beats=len(beats), median_offset_ms=round(float(np.median(o)), 1), p10_ms=round(float(np.percentile(o, 10)), 1), p90_ms=round(float(np.percentile(o, 90)), 1),
                within_20ms=f"{int((np.abs(o) <= 20).sum())}/{len(o)}",
                note=f'strongest onset within +-70 ms of every beat of the output grid (5 ms hop), upper half by strength, corrected for the detector bias ({ONSET_BIAS_MS} ms, calibrated on synthetic hits); + = music after the grid')


def moments(y, C):
    """measure the storyboard's structural moments on the rendered bed"""
    tl = tempo.Timeline(C); beat = C['beat_s']
    def lev(a, b):
        ta, tb = tl.t(a), tl.t(b)
        if ta is None or tb is None or tb <= ta:
            return None
        s = y[int(ta * SR):int(tb * SR)].mean(axis=1); return float(20 * np.log10(np.sqrt((s ** 2).mean() + 1e-18)))
    def lev_s(ta, tb):
        s = y[int(ta * SR):int(tb * SR)].mean(axis=1); return float(20 * np.log10(np.sqrt((s ** 2).mean() + 1e-18)))
    from scipy.signal import butter, sosfiltfilt
    low = sosfiltfilt(butter(4, [40, 160], 'bandpass', fs=SR, output='sos'), y.mean(axis=1))
    def lev_low(ta, tb):
        s = low[int(ta * SR):int(tb * SR)]; return float(20 * np.log10(np.sqrt((s ** 2).mean() + 1e-18)))
    def hit(pos, band='full'):
        t = tl.t(pos)
        if t is None:
            return None
        f = lev_s if band == 'full' else lev_low
        return f(t, t + beat) - f(t - beat, t)
    # all downbeat hits of the film, for the payoff rank
    dh = []
    for b in C['bars'][1:]:
        t = b['t0']; dh.append((lev_s(t, t + beat) - lev_s(t - beat, t), b['sb']))
    dh.sort(reverse=True)
    rank = lambda sb: next((i + 1 for i, (v, s) in enumerate(dh) if s == sb), None)
    env, ft = onset_env(y)
    def perc(ta, tb):
        i0, i1 = np.searchsorted(ft, ta), np.searchsorted(ft, tb); return float(env[i0:i1].mean()) if i1 > i0 else 0.0
    film_med = float(np.median([lev_s(b['t0'], b['t0'] + b['len']) for b in C['bars']]))
    film_perc = perc(0, C['grid_end_s'])
    R = {}
    def put(name, verdict, **kw):
        R[name] = dict(verdict=verdict, **{k: (round(v, 1) if isinstance(v, float) else v) for k, v in kw.items()})
    # title stop
    stop = None if lev('4:1', '4:3') is None or lev('4:4', '5:1') is None else lev('4:4', '5:1') - lev('4:1', '4:3')
    h5 = hit('5:1'); after = lev('5:1', '7:1'); before = lev('3:1', '5:1')
    v = 'yes' if (stop is not None and stop <= -10) else ('drop-on-5' if (after is not None and before is not None and after <= before - 4) else 'no')
    put('title_stop', v, silence_before_5_1_db=stop, hit_5_1_db=h5, level_5_6_vs_3_4_db=None if after is None or before is None else after - before)
    # pain sparse
    lp = lev('9:1', '19:1'); tp0, tp1 = tl.tc('9:1'), tl.tc('19:1')
    pr = perc(tp0, tp1) / (film_perc + 1e-12)
    put('pain_sparse', 'yes' if (lp is not None and lp <= film_med - 4) or pr < 0.6 else ('partial' if lp is not None and lp <= film_med - 2 else 'no'),
        level_vs_film_median_db=None if lp is None else lp - film_med, onset_density_vs_film=pr)
    # drop
    hd = hit('21:1'); hdl = hit('21:1', 'low'); ld = None if lev('21:1', '29:1') is None or lev('9:1', '19:1') is None else lev('21:1', '29:1') - lev('9:1', '19:1')
    put('drop', 'yes' if (hd or 0) >= 6 or (hdl or 0) >= 6 or ((ld or 0) >= 4 and max(hd or 0, hdl or 0) >= 2) else ('weak' if max(hd or 0, hdl or 0) >= 2 or (ld or 0) >= 2 else 'no'),
        hit_21_1_db=hd, hit_21_1_low_db=hdl, level_21_28_vs_pain_db=ld, rank_among_downbeats=rank('21'))
    # AI chime: does the music itself put an onset on 31:3?
    t = tl.t('31:3'); has = 'chime' in C.get('music_has', [])
    put('ai_chime', 'music' if has else 'sfx', at_s=t)
    # payoff gap + payoff
    gap = None if lev('50:4', '51:1') is None or lev('50:1', '50:4') is None else lev('50:4', '51:1') - lev('50:1', '50:4')
    hp = hit('51:1'); rk = rank('51')
    put('payoff', 'yes' if rk is not None and rk <= 2 and (hp or 0) >= 6 else ('partial' if rk is not None and rk <= 5 else 'weak'),
        hit_51_1_db=hp, rank_among_downbeats=rk, of=len(dh), gap_50_4_db=gap, biggest_downbeat=f"{dh[0][1]}:1 ({dh[0][0]:+.1f} dB)")
    # social groove
    ls = lev('55:1', '73:1')
    put('social_groove', 'yes' if ls is not None and ls >= film_med - 0.5 else 'partial', level_vs_film_median_db=None if ls is None else ls - film_med)
    # break (vs the two output bars before it) and lift
    t73 = tl.t('73:1'); t75 = tl.tc('75:1')
    lb = lb2 = None
    if t73 is not None:
        lb = lev_s(t73, t75); lb2 = lev_s(max(0, t73 - 2 * C['bar_s']), t73)
    put('break', 'yes' if lb is not None and lb <= lb2 - 3 else ('partial' if lb is not None and lb <= lb2 - 1 else 'no'), level_73_74_vs_2_bars_before_db=None if lb is None else lb - lb2)
    hl = hit('75:1'); hll = hit('75:1', 'low'); ll = None if lev('75:1', '83:1') is None or t73 is None else lev('75:1', '83:1') - lb
    put('lift', 'yes' if max(hl or 0, hll or 0) >= 4 or (ll or 0) >= 4 else ('partial' if max(hl or 0, hll or 0) >= 1.5 or (ll or 0) >= 1.5 else 'no'), hit_75_1_db=hl, hit_75_1_low_db=hll, level_75_82_vs_break_db=ll)
    # end resolve
    end = C['end_s']; tail = lev_s(end - 0.1, end); card = lev_s(tl.tc('83:1'), end)
    natural = C.get('fade') is None
    put('end_resolve', ('natural' if natural else 'fade') + (' (ends in silence)' if tail < -45 else ' (NOT silent at the end)'), last_100ms_db=tail, end_card_level_db=card)
    return R


def render(mid, write=True):
    C = tempo.load_compiled(mid)
    raw, splices = render_bed(C)
    y, norm = normalize(raw, -16.0)
    rep = dict(map=mid, label=C['label'], track=C['track'], duration_s=round(C['end_s'], 3), bars=len(C['bars']), cut=C['cut'], added=C['added'],
               splices=splice_clicks(y, splices, C), loudness=norm, onsets_vs_grid=onsets_vs_grid(y, C), moments=moments(y, C))
    if write:
        os.makedirs(BEDS, exist_ok=True)
        wav = os.path.join(BEDS, mid + '.wav'); write_wav(wav, y, 24)
        subprocess.run([FF, '-y', '-v', 'error', '-i', wav, '-c:a', 'aac', '-b:a', '256k', os.path.join(BEDS, mid + '.m4a')], check=True)
        rep['files'] = dict(wav=os.path.abspath(wav), m4a=os.path.abspath(os.path.join(BEDS, mid + '.m4a')))
        json.dump(rep, open(os.path.join(BEDS, mid + '.report.json'), 'w'), ensure_ascii=False, indent=1)
    return rep


def bed_path(mid):
    return os.path.join(BEDS, mid + '.wav')


def ensure_bed(mid):
    """render the bed if missing or older than its compiled map / track"""
    C = tempo.load_compiled(mid)
    p = bed_path(mid)
    src = [tempo.compiled_path(mid), C['track']['audio']]
    if not os.path.exists(p) or any(os.path.getmtime(p) < os.path.getmtime(s) for s in src if os.path.exists(s)):
        render(mid)
    return p


def prepare(mid):
    M = tempo.load_map(mid); R = M.get('render')
    if not R:
        print(mid, 'has no render section'); return
    os.makedirs(R['out'], exist_ok=True)
    cfgp = os.path.join(R['out'], 'score-config.json'); json.dump(R['score_config'], open(cfgp, 'w'))
    env = dict(os.environ, PYTHONDONTWRITEBYTECODE='1', SCORE_CONFIG=cfgp, SCORE_OUT=R['out'])
    subprocess.run(['nice', '-n', '19', R['python'], R['generator']], env=env, check=True)


def summary(reps):
    names = ['title_stop', 'pain_sparse', 'drop', 'ai_chime', 'payoff', 'social_groove', 'break', 'lift', 'end_resolve']
    print(f"{'map':16s} {'dur':>7s}  " + '  '.join(f'{n[:11]:11s}' for n in names))
    for r in reps:
        print(f"{r['map']:16s} {r['duration_s']:7.2f}  " + '  '.join(f"{r['moments'][n]['verdict'][:11]:11s}" for n in names))


if __name__ == '__main__':
    if len(sys.argv) < 3:
        print(__doc__); sys.exit(1)
    cmd, mid = sys.argv[1], sys.argv[2]
    ids = [i for i in tempo.all_ids()] if mid == 'all' else [mid]
    if cmd == 'render':
        reps = []
        for i in ids:
            r = render(i); reps.append(r)
            L = r['loudness']['after']
            print(f"{i}: {r['duration_s']} s, {len(r['splices'])} splices ({sum(s["click"] for s in r["splices"])} flagged), I {L['I']} LUFS, TP {L['TP']} dBTP, LRA {L['LRA']}, "
                  f"limiter {r['loudness']['limiter_max_reduction_db']} dB, onsets median {r['onsets_vs_grid']['median_offset_ms']} ms ({r['onsets_vs_grid']['within_20ms']} within 20 ms)")
        summary(reps)
    elif cmd == 'moments':
        reps = []
        for i in ids:
            p = os.path.join(BEDS, i + '.report.json')
            r = json.load(open(p)) if os.path.exists(p) else render(i)
            reps.append(r)
            print(i)
            for k, v in r['moments'].items():
                print(f'   {k:13s} {json.dumps(v, ensure_ascii=False)}')
        summary(reps)
    elif cmd == 'prepare':
        prepare(mid)
    else:
        print(__doc__); sys.exit(1)
