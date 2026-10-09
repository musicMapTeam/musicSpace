#!/usr/bin/env python3
"""Fills the SCRIPT/STORYBOARD templates with the generated fragments.  run after build.py (and glyph_check.cjs)."""
import json, os, re
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '..', 'out')
DOCS = os.path.join(HERE, '..')
rd = lambda n: open(os.path.join(OUT, n)).read().rstrip('\n')
tl = json.load(open(os.path.join(OUT, 'timeline.json')))
checks = '\n'.join(l for l in rd('checks.txt').split('\n') if not l.startswith('PASS  shot '))
try:
    g = json.load(open(os.path.join(OUT, 'glyphs.json')))
    glyphs = ', '.join(f"{k} {v['checked']} chars, missing {v['missing'] or 'none'}" for k, v in g.items())
except FileNotFoundError:
    glyphs = 'not run'
shots = tl['shots']
gfx = [s for s in shots if s['src'].startswith('GFX')]
real = [s for s in shots if not s['src'].startswith('GFX')]
dur = lambda ss: sum(s['t_out_124'] - s['t_in_124'] for s in ss)
fill = {
    'script_table': rd('script_table.md'), 'narration_plain': rd('narration_plain.txt').strip('\n'), 'sources_table': rd('sources_table.md'),
    'checks': checks, 'glyphs': glyphs, 'acts_table': rd('acts_table.md'), 'storyboard_overview': rd('storyboard_overview.md'),
    'storyboard_shots': rd('storyboard_shots.md'), 'tempo_table': rd('tempo_table.md'),
    'max_gap': (lambda m: f"{m.group(1)} beats ({m.group(2)} s at 124 BPM)" if m else 'n/a')(re.search(r'longest gap between visual events = ([\d.]+) beats = ([\d.]+) s', checks)),
    'n_shots': str(len(shots)), 'n_real': str(len(real)), 'n_gfx': str(len(gfx)), 'real_share': f"{100 * dur(real) / (dur(real) + dur(gfx)):.0f} %",
}
for name in ('SCRIPT', 'STORYBOARD'):
    s = open(os.path.join(HERE, f'{name}.tmpl.md')).read()
    for k, v in fill.items():
        s = s.replace('{{' + k + '}}', v)
    left = re.findall(r'\{\{(\w+)\}\}', s)
    assert not left, f'{name}: unfilled {left}'
    open(os.path.join(DOCS, f'{name}.md'), 'w').write(s)
    print('wrote', name + '.md', len(s), 'chars')

# ---- FORM-DRAFT.md (texts and counts from form_text.py, so the counted text is exactly the printed text)
import sys
sys.path.insert(0, HERE)
import form_text as F  # noqa: E402
s = open(os.path.join(HERE, 'FORM-DRAFT.tmpl.md')).read()
for name, text in F.VARIANTS:
    s = s.replace('{{' + name + '_len_nonl}}', str(len(text.replace('\n', ''))))
    s = s.replace('{{' + name + '_len}}', str(len(text)))
    s = s.replace('{{' + name + '}}', text)
s = s.replace('{{MAIN_DEMO_margin}}', str(300 - len(F.MAIN_DEMO)))
left = re.findall(r'\{\{(\w+)\}\}', s)
assert not left, f'FORM-DRAFT: unfilled {left}'
open(os.path.join(DOCS, 'FORM-DRAFT.md'), 'w').write(s)
print('wrote FORM-DRAFT.md', len(s), 'chars')
