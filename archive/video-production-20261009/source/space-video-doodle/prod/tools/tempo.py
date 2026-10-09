#!/usr/bin/env python3
"""Tempo maps: storyboard bars -> track bars -> seconds.

A tempo map (tools/tempo-maps/<id>.json) says which bar of the chosen music track plays under every storyboard bar
(SCRIPT.md / STORYBOARD.md are written in bars and beats: 90 bars, 4/4).  The compiler turns it into one sample-accurate
timeline (tools/tempo-maps/compiled/<id>.json) that BOTH the picture (dm/core.js: DM.T('51:1')) and the sound
(tools/music.py, tools/sfx.py, tools/qc.py) read, so a cut, a sticker and a splice can never drift apart.

  PY tools/tempo.py compile <id|all>        # validate + write compiled/<id>.json
  PY tools/tempo.py show <id>               # plan, splices (with harmonic/energy continuity), runtime, moments
  PY tools/tempo.py at <id> 51:1 31:3 ...   # seconds of storyboard positions under this map

Map file format (all bar numbers 1-based, 4/4):
  "track":  {"audio", "beats" (beats.json with bar_starts_s), "title", "artist", "licence", "proof", "credit"}
  "plan":   [{"sb": "21-48", "trk": "75-102", "why": "..."}, ...]   output order = plan order; sb ranges ascend.
            "sb" may name an inserted bar: "28+1" (first bar inserted after storyboard bar 28; see STORYBOARD §5 ADD-k).
  "cut":    [90, ...]        storyboard bars removed by the elastic plan (STORYBOARD §5 ✂ list); every storyboard bar 1..90
                             must be either planned once or cut.
  "tail_s": seconds the picture holds after the last bar (music rings / fades under the end card).
  "fade":   {"from": "88:1", "shape": "cos"}   music fade-out from this storyboard position to the end (or null = natural end).
  "xfade_ms": crossfade at every splice (ends on the downbeat, the incoming bar is at full level on its downbeat).
  "music_has": ["chime", "dings", "riser", "payoff_gap"]   cues the score already plays (SFX will not double them).
  "moments": {name: {"at": "51:1", "verdict": "...", "note": "..."}}   hand notes; music.py measures the real thing.
Semantics shared with dm/core.js (DM.T):  a position inside a cut bar has no time (an element that starts there never
appears); an end/exit inside a cut bar is clamped to the next kept bar; "91:1" (one after the last storyboard bar) is the end
of the bar grid.  Inserted bars "N+k:b" exist only in maps that plan them.
"""
import json, os, sys, math, re

HERE = os.path.dirname(os.path.abspath(__file__))
MAPS = os.path.join(HERE, 'tempo-maps')
COMPILED = os.path.join(MAPS, 'compiled')
SR = 48000
SB_BARS = 90          # storyboard length (SCRIPT.md / STORYBOARD.md), + optional tail bar 91
BPB = 4
ACTS = [('A0', 'HOOK 钩子', 1, 8), ('A1', 'PAIN 痛点', 9, 20), ('A2', 'ENTER 入场', 21, 28), ('A3', 'PHOTO + AI 照片与端侧 AI', 29, 40),
        ('A4', 'SAME MOMENT + EXCHANGE 同一刻与交换', 41, 54), ('A5', 'AFTER THE SWAP 交换之后', 55, 72), ('A6', 'WHY IT MATTERS 为什么值得做', 73, 82),
        ('A7', 'END CARD 片尾', 83, 90)]
# structural moments of the storyboard (STORYBOARD §0 key sync points) -> what music.py measures there
MOMENTS = [
    ('title_stop', '5:1', 'stop/silence just before 5:1, IMPACT on 5:1 (title)'),
    ('pain_sparse', '9:1', 'bars 9-18 sparse / half-time; build 19-20'),
    ('drop', '21:1', 'DROP on 21:1: the product appears, full groove'),
    ('ai_chime', '31:3', 'AI chime on 31:3 (the chip appears)'),
    ('payoff_gap', '50:4', 'one beat of silence on 50:4'),
    ('payoff', '51:1', 'PAYOFF 「交换已接受」: the biggest hit of the film'),
    ('social_groove', '55:1', 'second groove 55-72, highest energy'),
    ('break', '73:1', 'stop-time break 73-74'),
    ('lift', '75:1', 'final lift chorus from 75:1'),
    ('end_resolve', '83:1', 'end card: tag 83-84, big chord 85:1, resolve / ring out at the end'),
]


def load_map(mid):
    p = mid if mid.endswith('.json') else os.path.join(MAPS, mid + '.json')
    M = json.load(open(p))
    M['_path'] = os.path.abspath(p)
    return M


def rng(s):
    """'21-48' -> [21..48]; '7' -> [7]; '28+1' -> ['28+1']; '28+1-28+2' -> ['28+1','28+2']"""
    s = str(s).strip()
    if '+' in s:
        parts = s.split('-')
        if len(parts) == 1:
            return [s]
        a, b = parts
        base, k0 = a.split('+'); base2, k1 = b.split('+')
        assert base == base2, s
        return [f'{base}+{k}' for k in range(int(k0), int(k1) + 1)]
    if '-' in s:
        a, b = s.split('-')
        return list(range(int(a), int(b) + 1))
    return [int(s)]


def sb_key(label):
    """sort key of a storyboard bar label: 28 -> (28,0); '28+1' -> (28,1)"""
    if isinstance(label, int):
        return (label, 0)
    if '+' in str(label):
        a, b = str(label).split('+')
        return (int(a), int(b))
    return (int(label), 0)


def track_grid(M):
    B = json.load(open(M['track']['beats']))
    bars = list(B['bar_starts_s'])
    bar_s = float(B.get('bar_s') or (bars[1] - bars[0]))
    return B, bars, bar_s


def compile_map(M):
    B, starts, bar_s = track_grid(M)
    nb = len(starts)
    def tstart(n):          # 1-based track bar -> source seconds
        if n - 1 < nb:
            return starts[n - 1]
        return starts[-1] + (n - nb) * bar_s
    rows = []
    for p in M['plan']:
        sbs, trs = rng(p['sb']), rng(p['trk'])
        if len(sbs) != len(trs):
            raise SystemExit(f"{M['id']}: plan row {p['sb']} -> {p['trk']}: {len(sbs)} storyboard bars vs {len(trs)} track bars")
        for s, t in zip(sbs, trs):
            rows.append(dict(sb=str(s), trk=int(t), why=p.get('why', '')))
    # validation: order, coverage, cut
    keys = [sb_key(r['sb']) for r in rows]
    if keys != sorted(keys) or len(set(keys)) != len(keys):
        raise SystemExit(f"{M['id']}: storyboard bars must ascend without repeats in plan order: {[r['sb'] for r in rows]}")
    cut = set(int(c) for c in M.get('cut', []))
    planned = set(int(r['sb']) for r in rows if '+' not in r['sb'])
    tail_bar = SB_BARS + 1
    missing = [b for b in range(1, SB_BARS + 1) if b not in planned and b not in cut]
    both = sorted(planned & cut)
    if missing or both:
        raise SystemExit(f"{M['id']}: storyboard bars missing {missing}, planned and cut {both}")
    extra = sorted(b for b in planned if b > tail_bar or b < 1)
    if extra:
        raise SystemExit(f"{M['id']}: storyboard bars out of range {extra}")
    # sample-accurate output grid: contiguous runs of track bars keep their exact source spacing
    out = []
    pos = 0          # output sample index
    i = 0
    while i < len(rows):
        j = i
        while j + 1 < len(rows) and rows[j + 1]['trk'] == rows[j]['trk'] + 1:
            j += 1
        a, b = rows[i]['trk'], rows[j]['trk']
        s0 = tstart(a)
        run_start = pos
        for k in range(i, j + 1):
            n = rows[k]['trk']
            o0 = run_start + int(round((tstart(n) - s0) * SR))
            o1 = run_start + int(round((tstart(n + 1) - s0) * SR))
            out.append(dict(sb=rows[k]['sb'], trk=n, s0=o0, n=o1 - o0, src0=round(tstart(n), 6), why=rows[k]['why'],
                            splice_in=(k == i and i > 0)))
        pos = out[-1]['s0'] + out[-1]['n']
        i = j + 1
    grid_end = pos
    tail = float(M.get('tail_s', 0.0))
    end = grid_end + int(round(tail * SR))
    bars_out = []
    for k, r in enumerate(out):
        bars_out.append(dict(k=k + 1, sb=r['sb'], trk=r['trk'], t0=r['s0'] / SR, len=r['n'] / SR, s0=r['s0'], n=r['n'], src0=r['src0'], splice=r['splice_in']))
    C = dict(id=M['id'], label=M.get('label', M['id']), source=M['_path'], sr=SR, bpb=BPB, bpm=B.get('tempo_bpm') or B.get('bpm'),
             bar_s=bar_s, beat_s=bar_s / BPB, track=M['track'], bars=bars_out, cut=sorted(cut),
             added=[r['sb'] for r in rows if '+' in r['sb']], grid_end_s=grid_end / SR, grid_end_samples=grid_end,
             tail_s=tail, end_s=end / SR, end_samples=end, duration_s=end / SR,
             fade=M.get('fade'), xfade_ms=M.get('xfade_ms', 20), music_has=M.get('music_has', []), moments_notes=M.get('moments', {}),
             acts=[], moments=[])
    # acts and moments in output seconds
    tl = Timeline(C)
    for aid, title, b0, b1 in ACTS:
        t0 = tl.tc(f'{b0}:1'); t1 = tl.tc(f'{b1 + 1}:1')
        C['acts'].append(dict(id=aid, title=title, first_bar=b0, last_bar=b1, t0=round(t0, 6), t1=round(t1, 6)))
    for name, at, what in MOMENTS:
        C['moments'].append(dict(name=name, at=at, what=what, t=tl.t(at), note=C['moments_notes'].get(name)))
    return C


class Timeline:
    """Same semantics as dm/core.js DM.T / DM.Tc (keep them in sync)."""

    def __init__(self, C):
        self.C = C
        self.idx = {b['sb']: b for b in C['bars']}
        self.order = [b['sb'] for b in C['bars']]
        self.bpb = C['bpb']

    def _parse(self, pos):
        if isinstance(pos, (int, float)):
            return None, float(pos)
        s = str(pos)
        if ':' in s:
            a, b = s.split(':')
        else:
            a, b = s, '1'
        return a, float(b)

    def _bar_time(self, label, beat):
        bar = self.idx[label]
        return bar['t0'] + (beat - 1) / self.bpb * bar['len']

    def t(self, pos):
        """seconds of a storyboard position, or None if its bar is cut / not in this map"""
        label, beat = self._parse(pos)
        if label is None:
            return beat
        base, k = (label.split('+') + ['0'])[:2] if '+' in label else (label, '0')
        # carry beats outside 1..bpb+1 into neighbouring storyboard bars (plain bars only)
        if '+' not in label:
            n = int(base)
            while beat >= self.bpb + 1:
                beat -= self.bpb; n += 1
            while beat < 1:
                beat += self.bpb; n -= 1
            label = str(n)
            if label not in self.idx:
                if n == self._last_plain() + 1 and beat == 1:
                    return self.C['grid_end_s']
                return None
            return self._bar_time(label, beat)
        if label not in self.idx:
            return None
        return self._bar_time(label, beat)

    def _last_plain(self):
        return max(int(x) for x in self.order if '+' not in x)

    def tc(self, pos):
        """clamped: a cut bar maps to the start of the next kept bar (or the grid end)"""
        v = self.t(pos)
        if v is not None:
            return v
        label, beat = self._parse(pos)
        n = int(label.split('+')[0])
        for m in range(n + 1, SB_BARS + 3):
            if str(m) in self.idx:
                return self.idx[str(m)]['t0']
        return self.C['grid_end_s']

    def pos(self, t):
        """output seconds -> (storyboard label, beat float, output bar k)"""
        bars = self.C['bars']
        lo, hi = 0, len(bars) - 1
        if t >= self.C['grid_end_s']:
            last = bars[-1]
            return last['sb'], 1 + (t - last['t0']) / last['len'] * self.bpb, last['k']
        while lo < hi:
            mid = (lo + hi + 1) // 2
            if bars[mid]['t0'] <= t + 1e-9:
                lo = mid
            else:
                hi = mid - 1
        b = bars[lo]
        return b['sb'], 1 + (t - b['t0']) / b['len'] * self.bpb, b['k']

    def grid_error_ms(self, t, div=4):
        """distance of t to the nearest 1/div-beat grid point of its output bar (ms)"""
        sb, beat, k = self.pos(t)
        b = self.C['bars'][k - 1]
        step = b['len'] / self.bpb / div
        x = (t - b['t0']) / step
        return abs(x - round(x)) * step * 1000.0


def compiled_path(mid):
    return os.path.join(COMPILED, mid + '.json')


def load_compiled(mid, rebuild=True):
    p = compiled_path(mid)
    src = os.path.join(MAPS, mid + '.json')
    if rebuild and (not os.path.exists(p) or os.path.getmtime(p) < os.path.getmtime(src)):
        write_compiled(mid)
    return json.load(open(p))


def write_compiled(mid):
    M = load_map(mid)
    C = compile_map(M)
    os.makedirs(COMPILED, exist_ok=True)
    json.dump(C, open(compiled_path(mid), 'w'), ensure_ascii=False, indent=1)
    return C


def all_ids():
    return sorted(f[:-5] for f in os.listdir(MAPS) if f.endswith('.json'))


def fmt_s(x):
    m, s = divmod(x, 60)
    return f'{int(m)}:{s:05.2f}'


def show(mid):
    C = load_compiled(mid)
    print(f"{C['id']}: {C['label']}")
    print(f"  track {C['track'].get('artist')} - {C['track'].get('title')} ({C['bpm']} BPM, bar {C['bar_s']:.4f} s), licence {C['track'].get('licence')}")
    print(f"  {len(C['bars'])} output bars, cut {C['cut'] or '-'}, inserted {C['added'] or '-'}; grid {fmt_s(C['grid_end_s'])} + tail {C['tail_s']} s = {fmt_s(C['end_s'])} ({C['end_s']:.2f} s)")
    feats = bar_features(C)
    runs = []
    for b in C['bars']:
        if runs and not b['splice'] and b['trk'] == runs[-1][-1]['trk'] + 1:
            runs[-1].append(b)
        else:
            runs.append([b])
    print('  plan (output time  storyboard -> track):')
    for r in runs:
        a, z = r[0], r[-1]
        cont = ''
        if feats and a['splice']:
            prev_out = C['bars'][a['k'] - 2]['trk']
            cs, de, own = splice_quality(feats, prev_out, a['trk'])
            cont = f"   splice {prev_out}->{a['trk']}: harmony {cs:.2f}, level step {de:+.1f} dB (track's own step into {a['trk']}: {own:+.1f} dB)"
        print(f"   {fmt_s(a['t0'])}  sb {a['sb']}-{z['sb']} -> trk {a['trk']}-{z['trk']}{cont}")
    print('  acts:')
    for a in C['acts']:
        print(f"   {a['id']:3s} bars {a['first_bar']:2d}-{a['last_bar']:2d}  {fmt_s(a['t0'])}-{fmt_s(a['t1'])}  {a['title']}")
    print('  moments (storyboard -> output s; notes from the map):')
    for m in C['moments']:
        t = m['t']
        print(f"   {m['name']:13s} {m['at']:6s} {('%.3f' % t) if t is not None else ' cut  ':>8s}  {(m['note'] or {}).get('verdict', '') if isinstance(m['note'], dict) else ''}")


def bar_features(C):
    """per-bar features of the track (tools/trackbars.py), cached in audio/analysis/<map>.bars.json"""
    key = os.path.basename(os.path.dirname(os.path.abspath(C['track']['beats'])))
    cache = os.path.join(HERE, '..', 'audio', 'analysis', key + '.bars.json')
    try:
        if not os.path.exists(cache):
            sys.path.insert(0, HERE)
            import trackbars
            F = trackbars.features(C['track']['beats'], C['track']['audio'])
            os.makedirs(os.path.dirname(cache), exist_ok=True)
            json.dump(F, open(cache, 'w'))
        F = json.load(open(cache))
        return {r['bar']: r for r in F['rows']}
    except Exception as e:   # analysis is optional
        print('  (no bar features:', e, ')')
        return None


def splice_quality(feats, out_bar, in_bar):
    """harmonic continuity of out_bar -> in_bar: best of (out_bar ~ the bar that precedes in_bar in the track) and
    (in_bar ~ the bar that follows out_bar in the track); 1 = sounds like a passage the track itself plays.
    level step = rms(in_bar) - rms(out_bar) at the splice, and the track's own step into in_bar for comparison"""
    a = chroma_sim(feats, out_bar, in_bar - 1)
    b = chroma_sim(feats, in_bar, out_bar + 1)
    vals = [v for v in (a, b) if v == v]
    cs = max(vals) if vals else float('nan')
    de = energy(feats, in_bar) - energy(feats, out_bar)
    own = energy(feats, in_bar) - energy(feats, in_bar - 1) if in_bar - 1 in feats else float('nan')
    return cs, de, own


def chroma_sim(feats, a, b):
    if a not in feats or b not in feats:
        return float('nan')
    va, vb = feats[a]['chroma_vec'], feats[b]['chroma_vec']
    return sum(x * y for x, y in zip(va, vb))


def energy(feats, n):
    return feats[n]['rms'] if n in feats else float('nan')


if __name__ == '__main__':
    if len(sys.argv) < 3:
        print(__doc__); sys.exit(1)
    cmd, mid = sys.argv[1], sys.argv[2]
    ids = all_ids() if mid == 'all' else [mid]
    if cmd == 'compile':
        for i in ids:
            C = write_compiled(i)
            print(f"compiled {i}: {len(C['bars'])} bars, {C['end_s']:.3f} s -> {compiled_path(i)}")
    elif cmd == 'show':
        for i in ids:
            show(i); print()
    elif cmd == 'at':
        C = load_compiled(mid); tl = Timeline(C)
        for p in sys.argv[3:]:
            v = tl.t(p)
            print(p, 'cut' if v is None else f'{v:.4f}', f'(clamped {tl.tc(p):.4f})')
    else:
        print(__doc__); sys.exit(1)
