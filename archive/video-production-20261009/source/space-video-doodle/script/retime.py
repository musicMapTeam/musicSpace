#!/usr/bin/env python3
"""Retime the Music Space Doodle edit (out/timeline.json, bar:beat) to a real track.

  python3 retime.py --bpm 124                          # constant tempo, first downbeat at 0 s
  python3 retime.py --bpm 118 --offset 0.42            # first downbeat of the track at 0.42 s
  python3 retime.py --beatmap beatmap.json             # bar_starts_s from /tmp/space-video-prep/music/beatmap.py (tempo drift ok)
  python3 retime.py --beatmap beatmap.json --first-bar 3   # the edit's bar 1 = the track's bar 3 (skip a 2-bar intro)
  python3 retime.py --bpm 116 --bars 86                # apply the elastic plan: cut bars in priority order to reach 86 bars
  ... --out retimed.json --csv retimed.csv --srt narration.srt

Elastic plan (timeline.json "elastic"): cut = bars that can be removed (priority 1 first); add = bars that can be inserted (placeholders
named ADD-k, to be filled as described).  An event that STARTS in a removed bar is dropped; an event that ENDS in or after a removed bar is
shortened to the next kept bar.  Prints the runtime and what was cut/added.
"""
import argparse, csv, json, math, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ap = argparse.ArgumentParser()
ap.add_argument('--timeline', default=os.path.join(HERE, 'out', 'timeline.json'))
ap.add_argument('--bpm', type=float)
ap.add_argument('--offset', type=float, default=0.0, help='seconds of the first downbeat (with --bpm)')
ap.add_argument('--beatmap', help='JSON with bar_starts_s (and bpm) from beatmap.py')
ap.add_argument('--first-bar', type=int, default=1, help='track bar that the edit\'s bar 1 lands on (with --beatmap)')
ap.add_argument('--bars', type=int, help='target number of bars (elastic plan); default: as written')
ap.add_argument('--out')
ap.add_argument('--csv')
ap.add_argument('--srt')
a = ap.parse_args()
tl = json.load(open(a.timeline))
BPB = tl['beats_per_bar']
N0 = tl['bars']

# ---------------------------------------------------------------- elastic: which old bars survive, where bars are inserted
cut, added = set(), []          # added: list of (after_old_bar, n, label)
if a.bars and a.bars < N0:
    need = N0 - a.bars
    for c in sorted(tl['elastic']['cut'], key=lambda c: c['priority']):
        if len(cut) >= need:
            break
        cut.update(c['bars'])
elif a.bars and a.bars > N0:
    need = a.bars - N0
    got = 0
    for c in sorted(tl['elastic']['add'], key=lambda c: c['priority']):
        if got >= need:
            break
        added.append((c['after_bar'], c['bars'], f"ADD-{c['priority']}: {c['what']}"))
        got += c['bars']

new_bar = {}        # old bar -> new bar
nb = 0
ins_at = {}         # new bar index of each insertion
for ob in range(1, N0 + 1 + tl.get('tail_bars', 0)):
    if ob in cut:
        continue
    nb += 1
    new_bar[ob] = nb
    for after, n, label in added:
        if after == ob:
            ins_at[label] = (nb + 1, n)
            nb += n
N = nb - tl.get('tail_bars', 0)


def remap(beat, is_end=False):
    """old absolute beat -> new absolute beat, or None if it starts in a cut bar."""
    ob = int(beat // BPB) + 1
    off = beat - (ob - 1) * BPB
    if ob in new_bar:
        return (new_bar[ob] - 1) * BPB + off
    if not is_end:
        return None
    nxt = ob
    while nxt not in new_bar and nxt <= N0 + 1:
        nxt += 1
    if nxt in new_bar:
        return (new_bar[nxt] - 1) * BPB
    return N * BPB


# ---------------------------------------------------------------- seconds
if a.beatmap:
    bm = json.load(open(a.beatmap))
    bars_s = bm['bar_starts_s']
    bar_len_default = 240.0 / bm.get('bpm', tl['bpm_ref'])

    def seconds(beat):
        bar = int(beat // BPB) + a.first_bar          # 1-based track bar
        off = beat - (int(beat // BPB)) * BPB
        if bar - 1 >= len(bars_s):
            return bars_s[-1] + (bar - len(bars_s)) * bar_len_default + off * bar_len_default / BPB
        start = bars_s[bar - 1]
        blen = (bars_s[bar] - start) if bar < len(bars_s) else bar_len_default
        return start + off * blen / BPB
    tempo_note = f"beat map {a.beatmap} (bpm {bm.get('bpm')}), edit bar 1 = track bar {a.first_bar}"
else:
    bpm = a.bpm or tl['bpm_ref']

    def seconds(beat):
        return a.offset + beat * 60.0 / bpm
    tempo_note = f'{bpm:g} BPM, first downbeat at {a.offset:g} s'


def pos(beat):
    bar = int(beat // BPB) + 1
    return f"{bar}:{beat - (bar - 1) * BPB + 1:g}"


out = dict(source=os.path.abspath(a.timeline), tempo=tempo_note, bars=N, cut_bars=sorted(cut), inserted=[dict(label=k, at_bar=v[0], bars=v[1]) for k, v in ins_at.items()],
           runtime_s=None, runtime_with_tail_s=None, shots=[], text=[])
for s in tl['shots']:
    i, o = remap(s['beat_in']), remap(s['beat_out'], True)
    if i is None or o is None or o <= i:
        continue
    mot = []
    for m in s['motion']:
        b = remap(m['beat'])
        if b is not None and b < o:
            mot.append(dict(at=pos(b), t=round(seconds(b), 3), what=m['what']))
    sfx = []
    for m in s['sfx']:
        b = remap(m['beat'])
        if b is not None and b < o:
            sfx.append(dict(at=pos(b), t=round(seconds(b), 3), what=m['what']))
    out['shots'].append(dict(id=s['id'], start=pos(i), end=pos(o), t_in=round(seconds(i), 3), t_out=round(seconds(o), 3), dur=round(seconds(o) - seconds(i), 3),
                             layout=s['layout'], src=s['src'], motion=mot, sfx=sfx))
for label, (at, n) in ins_at.items():
    b0 = (at - 1) * BPB
    out['shots'].append(dict(id=label.split(':')[0], start=pos(b0), end=pos(b0 + n * BPB), t_in=round(seconds(b0), 3), t_out=round(seconds(b0 + n * BPB), 3),
                             dur=round(seconds(b0 + n * BPB) - seconds(b0), 3), layout='see STORYBOARD', src=label, motion=[], sfx=[]))
out['shots'].sort(key=lambda s: s['t_in'])
for t in tl['text']:
    i, o = remap(t['beat_in']), remap(t['beat_out'], True)
    if i is None or o is None or o <= i:
        continue
    out['text'].append(dict(id=t['id'], start=pos(i), end=pos(o), t_in=round(seconds(i), 3), t_out=round(seconds(o), 3), text=t['text'], key=t['key'],
                            font=t['font'], size_px=t['size_px'], style=t['style'], pos=t['pos'], fx=t['fx'], kind=t['kind']))
end_b = N * BPB
out['runtime_s'] = round(seconds(end_b), 3)
out['runtime_with_tail_s'] = round(seconds(end_b + BPB * tl.get('tail_bars', 0)), 3)

if a.out:
    json.dump(out, open(a.out, 'w'), ensure_ascii=False, indent=1)
if a.csv:
    with open(a.csv, 'w', newline='') as fh:
        w = csv.writer(fh)
        w.writerow(['kind', 'id', 'start', 'end', 't_in', 't_out', 'what'])
        for s in out['shots']:
            w.writerow(['shot', s['id'], s['start'], s['end'], s['t_in'], s['t_out'], s['src']])
            for m in s['motion']:
                w.writerow(['motion', s['id'], m['at'], '', m['t'], '', m['what']])
            for m in s['sfx']:
                w.writerow(['sfx', s['id'], m['at'], '', m['t'], '', m['what']])
        for t in out['text']:
            w.writerow(['text', t['id'], t['start'], t['end'], t['t_in'], t['t_out'], t['text']])
if a.srt:
    def ts(x):
        ms = int(round(x * 1000))
        return f"{ms // 3600000:02d}:{ms // 60000 % 60:02d}:{ms // 1000 % 60:02d},{ms % 1000:03d}"
    rows = [t for t in out['text'] if t['kind'] in ('title', 'note', 'fine')]
    with open(a.srt, 'w') as fh:
        for k, t in enumerate(rows, 1):
            fh.write(f"{k}\n{ts(t['t_in'])} --> {ts(t['t_out'])}\n{t['text']}\n\n")

m, s_ = divmod(out['runtime_s'], 60)
print(f"{tempo_note}: {N} bars, runtime {int(m)}:{s_:05.2f} (+tail {out['runtime_with_tail_s']:.2f} s); cut bars {sorted(cut) or '-'}; inserted {list(ins_at) or '-'}")
if not (170 <= out['runtime_s'] <= 180):
    print('WARNING: runtime outside 2:50-3:00; choose --bars (see STORYBOARD.md tempo table)')
