#!/usr/bin/env python3
"""Builds the timing tables, the machine-readable timeline and the checks from edit_data.py.

usage: python3 build.py            -> writes ../out/timeline.json, ../out/*.md fragments, ../out/checks.txt; prints the checks
"""
import json, math, os, re, sys
from fractions import Fraction

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import edit_data as E  # noqa: E402

OUT = os.path.join(HERE, '..', 'out')
os.makedirs(OUT, exist_ok=True)
BPB = 4


def parse(pos):
    """'12:3.5' -> absolute beat index from 0 (bar 1 beat 1 = 0)."""
    bar, beat = pos.split(':')
    return (int(bar) - 1) * BPB + (float(beat) - 1)


def fmt_pos(b):
    bar = int(b // BPB) + 1
    beat = b - (bar - 1) * BPB + 1
    beat_s = ('%g' % beat)
    return f'{bar}:{beat_s}'


def sec(b, bpm=E.BPM_REF, offset=0.0):
    return offset + b * 60.0 / bpm


def mmss(s):
    m = int(s // 60)
    return f'{m}:{s - 60 * m:05.2f}'


CJK = re.compile(r'[㐀-鿿豈-﫿]')
RUN = re.compile(r'[A-Za-z0-9][A-Za-z0-9:./]*')


def plain(text):
    return text.replace('⟦', '').replace('⟧', '')


def units(text):
    t = plain(text)
    n = len(CJK.findall(t))
    n += len(RUN.findall(t))
    return n


def keyed(text):
    """⟦x⟧ -> 【x】 for markdown; newline -> ' / '."""
    return text.replace('⟦', '**【').replace('⟧', '】**').replace('\n', ' / ')


FONT = {'D': 'Display 站酷庆科黄油体', 'M': 'Marker 霞鹜漫黑', 'H': 'Hand 悠哉', 'N': 'Note 龙藏体', 'L': 'Logo Luckiest Guy', 'G': 'Digits 得意黑'}
SIZE = {'XXL': 240, 'XL': 180, 'L': 128, 'M': 84, 'S': 56, 'XS': 36}

shots = []
for s in E.SHOTS:
    a, b = parse(s['start']), parse(s['end'])
    shots.append({**s, 'a': a, 'b': b})
texts = []
for t in E.TEXT:
    a, b = parse(t['start']), parse(t['end'])
    texts.append({**t, 'a': a, 'b': b, 'units': units(t['text'])})

END_BEAT = E.BARS * BPB          # 90 bars -> beat 360 = 91:1
checks = []


def check(ok, level, msg):
    checks.append(('PASS' if ok else level, msg))


# 1. shots are contiguous from 1:1 to 91:1
pos = 0
for s in shots:
    check(abs(s['a'] - pos) < 1e-9, 'FAIL', f"shot {s['id']} starts at {s['start']} (expected {fmt_pos(pos)})")
    pos = s['b']
check(abs(pos - END_BEAT) < 1e-9, 'FAIL', f'last shot ends at {fmt_pos(pos)} (expected {fmt_pos(END_BEAT)})')

# 2. reading time for titles and notes: >= 0.25 s per unit (WARN below, FAIL below 0.20), and >= 0.9 s
read_rows = []
for t in texts:
    dur = sec(t['b']) - sec(t['a'])
    per = dur / max(1, t['units'])
    t['dur'] = dur
    t['per'] = per
    if t['kind'] in ('title', 'note'):
        if dur < 0.9 or per < 0.20:
            lvl = 'FAIL'
        elif per < 0.25:
            lvl = 'WARN'
        else:
            lvl = 'PASS'
        t['read'] = lvl
        if lvl != 'PASS':
            checks.append((lvl, f"{t['id']} 「{plain(t['text'])}」 {t['units']} units on screen {dur:.2f} s = {per:.2f} s/unit"))
    else:
        t['read'] = '-'
check(all(t['read'] in ('PASS', '-') for t in texts), 'WARN', 'reading time of every title/note >= 0.25 s per unit and >= 0.9 s')

# 3. at most two LAYERED titles (shadow/sticker/highlight recipes) and three narration lines on screen at any moment
PLAIN = {'ink', 'fine', 'chip'}
bounds = sorted({t['a'] for t in texts} | {t['b'] for t in texts})
worst_l = worst_n = 0
for i in range(len(bounds) - 1):
    mid = (bounds[i] + bounds[i + 1]) / 2
    on = [t for t in texts if t['kind'] == 'title' and t['a'] <= mid < t['b']]
    lay = [t['id'] for t in on if t['style'] not in PLAIN]
    if len(lay) > 2:
        checks.append(('FAIL', f'{len(lay)} layered titles on screen at {fmt_pos(mid)}: {lay}'))
    if len(on) > 3:
        checks.append(('FAIL', f'{len(on)} narration lines on screen at {fmt_pos(mid)}: {[t["id"] for t in on]}'))
    worst_l = max(worst_l, len(lay)); worst_n = max(worst_n, len(on))
check(worst_l <= 2, 'FAIL', f'max layered titles on screen at once = {worst_l} (limit 2, doodle.md §2.2)')
check(worst_n <= 3, 'FAIL', f'max narration lines on screen at once = {worst_n} (limit 3)')

# 4. Display font glyph traps (raw 站酷庆科黄油体: 入 looks like 几, 个 looks like 卜, no ·)
for t in texts:
    if t['font'] == 'D':
        bad = [c for c in plain(t['text']) if c in '入个·']
        if bad:
            checks.append(('FAIL', f"{t['id']} uses {bad} in the Display font"))
check(not any(c for t in texts if t['font'] == 'D' for c in plain(t['text']) if c in '入个·'), 'FAIL', 'no 入 / 个 / · in Display-font lines')

# 5. symbols that the raw Marker font lacks (the product moved them to marker-symbols.woff2)
SYM = set('↗✓♡♫✦✧☾↩↔▾▴℗')
for t in texts:
    if t['font'] == 'M':
        bad = [c for c in plain(t['text']) if c in SYM]
        if bad:
            checks.append(('WARN', f"{t['id']} uses {bad} with the Marker font: load the product's marker-symbols.woff2 (fonts.css) or draw the arrow"))

# 6. no hold: max gap between visual events (shot motion + text entrances + cuts) <= 4 beats
events = set()
for s in shots:
    events.add(s['a'])
    for p, _ in s['motion']:
        events.add(parse(p))
for t in texts:
    events.add(t['a'])
ev = sorted(e for e in events if e < END_BEAT)
gaps = [(ev[i + 1] - ev[i], ev[i]) for i in range(len(ev) - 1)]
gaps.append((END_BEAT - ev[-1], ev[-1]))
mx = max(gaps)
for g, at in gaps:
    if g > 4:
        checks.append(('FAIL', f'no visual event for {g:g} beats after {fmt_pos(at)}'))
check(mx[0] <= 4, 'FAIL', f'longest gap between visual events = {mx[0]:g} beats = {sec(mx[0]):.2f} s at {E.BPM_REF} BPM (after {fmt_pos(mx[1])}); limit 4 beats (1.94 s) < 2.5 s')

# 6b. every narration line fits its zone (per line; trailing punctuation hangs at 0.5 em; key words scale 1.4/1.25/1.2 for 1-2/3/4+ chars)
ZONE = {'L1': 960, 'L2': 980, 'L4': 1100, 'L6': 1680, 'L7': 1680}
PUNCT = set('，。、？！：；…')
def key_scale(k):
    n = len([c for c in k if not c.isspace()])
    return 1.4 if n <= 2 else (1.25 if n == 3 else 1.2)
def line_width(line, size):
    w = 0.0
    keys = re.findall('⟦(.+?)⟧', line)
    sc = {k: key_scale(k) for k in keys}
    parts = re.split('(⟦.+?⟧)', line)
    for part in parts:
        f = 1.0
        if part.startswith('⟦'):
            f = sc[part[1:-1]]; part = part[1:-1]
        for ch in part:
            w += (0.55 if re.match(r'[A-Za-z0-9:./ ]', ch) else 1.0) * size * f
    stripped = line.replace('⟦', '').replace('⟧', '')
    if stripped and stripped[-1] in PUNCT:
        w -= 0.5 * size
    return w
over = []
try:
    MEASURED = json.load(open(os.path.join(OUT, 'widths.json')))   # real widths from measure_widths.cjs (raw TTFs in Chrome)
except FileNotFoundError:
    MEASURED = {}
worst_fit = (0, '')
for t in texts:
    if t['kind'] != 'title':
        continue
    sh = next(s_ for s_ in shots if s_['a'] <= t['a'] < s_['b'])
    lay = sh['layout'].split(' ')
    # a shot that changes layout ('L2 -> L6') uses the later layout for text that starts in its second half
    zone_lay = lay[-1] if len(lay) > 1 and t['a'] >= (sh['a'] + sh['b']) / 2 else lay[0]
    zone = ZONE.get(zone_lay, 1680)
    for i, ln in enumerate(t['text'].split('\n')):
        key = f"{t['id']}#{i}"
        if key in MEASURED:
            w = MEASURED[key] - (0.5 * SIZE[t['size']] if plain(ln) and plain(ln)[-1] in PUNCT else 0)
        else:
            w = line_width(ln, SIZE[t['size']])
        worst_fit = max(worst_fit, (w / zone, f"{t['id']} 「{plain(ln)}」 {w:.0f}/{zone}px"))
        t.setdefault('width', 0)
        t['width'] = max(t['width'], w)
        if w > zone:
            over.append(f"{t['id']} 「{plain(ln)}」 ~{w:.0f}px > {zone}px ({sh['id']} {sh['layout']})")
for o in over:
    checks.append(('FAIL', 'too wide: ' + o))
check(not over, 'FAIL', f"every narration line fits its layout zone (L1 960 / L2 980 / L4 die card 1100 / L6-L7 1680 px; per line; {'measured in Chrome' if MEASURED else 'estimated'}; tightest {worst_fit[0]:.0%}: {worst_fit[1]})")

# 7. runtime
total = sec(END_BEAT)
check(170 <= total <= 178, 'FAIL', f'runtime {E.BARS} bars = {total:.2f} s ({mmss(total)}); with the tail bar {sec(END_BEAT + 4):.2f} s ({mmss(sec(END_BEAT + 4))}); target 2:50-2:58')

# ---------------------------------------------------------------- outputs
def text_rows(act):
    rows = []
    for t in texts:
        if not (act[2] <= int(t['a'] // BPB) + 1 <= act[3]):
            continue
        rows.append(t)
    return sorted(rows, key=lambda t: (t['a'], t['id']))


lines = []
for act in E.ACTS:
    a0, a1 = (act[2] - 1) * BPB, act[3] * BPB
    lines.append(f"\n### {act[0]} · {act[1]} — bars {act[2]}–{act[3]} · {mmss(sec(a0))}–{mmss(sec(a1))}\n")
    lines.append(f"*{act[4]}*\n")
    lines.append('| ID | in → out (bar:beat) | @124 BPM | 文字（【】= 重点词：放大、变色） | 字体 / 字号 / 配方 | 位置 | 入场 | 字数 · 秒/字 |')
    lines.append('|---|---|---|---|---|---|---|---|')
    for t in text_rows(act):
        kind = '' if t['kind'] == 'title' else f" *({t['kind']})*"
        rd = f"{t['units']} · {t['per']:.2f}" + (f" {t['read']}" if t['read'] not in ('PASS', '-') else '')
        lines.append(f"| {t['id']} | {t['start']} → {t['end']} | {mmss(sec(t['a']))}–{mmss(sec(t['b']))} | {keyed(t['text'])}{kind} | {t['font']} {SIZE[t['size']]}px · {t['style']} | {t['pos']} | {t['fx']} | {rd} |")
open(os.path.join(OUT, 'script_table.md'), 'w').write('\n'.join(lines) + '\n')

# plain narration (titles + notes only) for proofreading
pl = []
for act in E.ACTS:
    pl.append(f'\n【{act[1]}】')
    for t in text_rows(act):
        if t['kind'] in ('title', 'note'):
            pl.append(f"  {mmss(sec(t['a']))}  {plain(t['text']).replace(chr(10), '｜')}")
        else:
            pl.append(f"  {mmss(sec(t['a']))}    [{t['kind']}] {plain(t['text']).replace(chr(10), ' / ')}")
open(os.path.join(OUT, 'narration_plain.txt'), 'w').write('\n'.join(pl) + '\n')

# sources table
src = ['| ID | 文字 | 产品依据（界面文字或事实） |', '|---|---|---|']
for t in texts:
    if t['src']:
        src.append(f"| {t['id']} | {plain(t['text']).replace(chr(10), ' / ')} | {t['src']} |")
open(os.path.join(OUT, 'sources_table.md'), 'w').write('\n'.join(src) + '\n')

# storyboard shot table
sb = []
for act in E.ACTS:
    a0, a1 = (act[2] - 1) * BPB, act[3] * BPB
    sb.append(f"\n### {act[0]} · {act[1]} — bars {act[2]}–{act[3]} ({mmss(sec(a0))}–{mmss(sec(a1))})\n")
    sb.append(f"Music: {act[5]}.\n")
    for s in shots:
        bar0 = int(s['a'] // BPB) + 1
        if not (act[2] <= bar0 <= act[3]):
            continue
        tids = [t['id'] for t in texts if s['a'] <= t['a'] < s['b']]
        bars = (s['b'] - s['a']) / BPB
        sb.append(f"#### {s['id']} · {s['start']} → {s['end']} · {bars:g} bar{'s' if bars != 1 else ''} · {mmss(sec(s['a']))}–{mmss(sec(s['b']))} · layout {s['layout']}" + (f" · ✂ {s['elastic']}" if s['elastic'] else ''))
        sb.append('')
        sb.append(f"- **Source:** {s['src']}")
        sb.append(f"- **We see:** {s['see']}")
        sb.append(f"- **Doodle treatment:** {s['treat']}")
        sb.append('- **On the beat:** ' + ' · '.join(f"`{p}` {w}" for p, w in s['motion']))
        sb.append('- **Text:** ' + (', '.join(f"{t['id']} 「{plain(t['text']).replace(chr(10), ' / ')}」 `{t['start']}`" for t in sorted(texts, key=lambda t: (t['a'], t['id'])) if t['id'] in tids) or '—'))
        sb.append('- **SFX:** ' + ' · '.join(f"`{p}` {w}" for p, w in s['sfx']))
        sb.append('')
open(os.path.join(OUT, 'storyboard_shots.md'), 'w').write('\n'.join(sb) + '\n')

# acts table
at = ['| Act | bars | @124 BPM | what it does | music |', '|---|---|---|---|---|']
for act in E.ACTS:
    a0, a1 = (act[2] - 1) * BPB, act[3] * BPB
    at.append(f"| {act[0]} {act[1]} | {act[2]}–{act[3]} ({act[3] - act[2] + 1}) | {mmss(sec(a0))}–{mmss(sec(a1))} | {act[4]} | {act[5]} |")
open(os.path.join(OUT, 'acts_table.md'), 'w').write('\n'.join(at) + '\n')

# compact overview table (one row per shot)
ov = ['| Shot | bars | @124 BPM | layout | source | one line |', '|---|---|---|---|---|---|']
for s in shots:
    bars = (s['b'] - s['a']) / BPB
    one = s['see'].split('. ')[0]
    if len(one) > 120:
        one = one[:117] + '…'
    src_ = s['src'].split(' (')[0]
    if len(src_) > 64:
        src_ = src_[:61] + '…'
    ov.append(f"| {s['id']} | {s['start']}→{s['end']} ({bars:g}) | {mmss(sec(s['a']))}–{mmss(sec(s['b']))} | {s['layout']} | {src_} | {one} |")
open(os.path.join(OUT, 'storyboard_overview.md'), 'w').write('\n'.join(ov) + '\n')

# tempo table for the elastic plan
cut_order = [c for c in sorted(E.ELASTIC['cut'])]
add_order = [a for a in sorted(E.ELASTIC['add'])]
tt = ['| track tempo | bar | bars that fit 170–178 s | use | runtime | how |', '|---|---|---|---|---|---|']
for bpm in (108, 110, 112, 114, 116, 118, 120, 122, 124, 126, 128, 130, 132, 134):
    L = 240.0 / bpm
    lo, hi = math.ceil(170 / L), math.floor(178 / L)
    tgt = round(174 / L)
    tgt = max(lo, min(hi, tgt))
    n = tgt
    how = []
    if n < E.BARS:
        need = E.BARS - n
        got = 0
        for pr, bars_, what in cut_order:
            if got >= need:
                break
            how.append(f"✂{pr} (bar {','.join(map(str, bars_))})")
            got += len(bars_)
        n = E.BARS - got
    elif n > E.BARS:
        need = n - E.BARS
        got = 0
        for pr, after, k, what in add_order:
            if got >= need:
                break
            how.append(f"+{pr} ({k} after bar {after})")
            got += k
        n = E.BARS + got
    ok = 170 <= n * L <= 178
    tt.append(f"| {bpm} BPM | {L:.3f} s | {lo}–{hi} | {n} | {mmss(n * L)}{'' if ok else ' ⚠'} | {', '.join(how) if how else 'as written'} |")
open(os.path.join(OUT, 'tempo_table.md'), 'w').write('\n'.join(tt) + '\n')

# machine-readable timeline
tl = dict(
    title='Music Space — Doodle video (script + storyboard, bar/beat timeline)',
    note='Positions are bar:beat (1-based, 4/4). t_s_124 = seconds at 124 BPM with the first downbeat at 0 s. Retime with retime.py.',
    bpm_ref=E.BPM_REF, beats_per_bar=BPB, bars=E.BARS, tail_bars=E.TAIL_BARS,
    acts=[dict(id=a[0], title=a[1], first_bar=a[2], last_bar=a[3], purpose=a[4], music=a[5]) for a in E.ACTS],
    shots=[dict(id=s['id'], start=s['start'], end=s['end'], beat_in=s['a'], beat_out=s['b'], t_in_124=round(sec(s['a']), 3), t_out_124=round(sec(s['b']), 3),
                layout=s['layout'], src=s['src'], see=s['see'], treat=s['treat'],
                motion=[dict(at=p, beat=parse(p), t_124=round(sec(parse(p)), 3), what=w) for p, w in s['motion']],
                sfx=[dict(at=p, beat=parse(p), t_124=round(sec(parse(p)), 3), what=w) for p, w in s['sfx']], elastic=s['elastic']) for s in shots],
    text=[dict(id=t['id'], start=t['start'], end=t['end'], beat_in=t['a'], beat_out=t['b'], t_in_124=round(sec(t['a']), 3), t_out_124=round(sec(t['b']), 3),
               text=plain(t['text']), text_marked=t['text'], key=re.findall('⟦(.+?)⟧', t['text']), font=t['font'], font_name=FONT[t['font']], size=t['size'], size_px=SIZE[t['size']],
               style=t['style'], pos=t['pos'], fx=t['fx'], kind=t['kind'], units=t['units'], source=t['src']) for t in texts],
    elastic=dict(cut=[dict(priority=p, bars=b, what=w) for p, b, w in cut_order], add=[dict(priority=p, after_bar=a, bars=k, what=w) for p, a, k, w in add_order]),
)
json.dump(tl, open(os.path.join(OUT, 'timeline.json'), 'w'), ensure_ascii=False, indent=1)

with open(os.path.join(OUT, 'checks.txt'), 'w') as fh:
    for lvl, msg in checks:
        fh.write(f'{lvl:5s} {msg}\n')
for lvl, msg in checks:
    print(f'{lvl:5s} {msg}')
print(f"\nshots {len(shots)}, text events {len(texts)} (titles {sum(t['kind']=='title' for t in texts)}), runtime {mmss(total)}")
