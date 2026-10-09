# Experiment only (writes to /tmp): the Doodle fonts re-sliced so that every character of the first screen is in slice 0,
# and slice 0 carries only the symbols the UI uses. Reuses the functions of scripts/fonts/build-doodle-fonts.py unchanged.
import sys; sys.dont_write_bytecode = True
import importlib.util, pathlib, re, json
ROOT = pathlib.Path('/Users/alakazan/workplace/tme/musicSpace')
spec = importlib.util.spec_from_file_location('bdf', ROOT / 'scripts/fonts/build-doodle-fonts.py')
bdf = importlib.util.module_from_spec(spec); spec.loader.exec_module(bdf)
OUT = pathlib.Path(sys.argv[1]); OUT.mkdir(parents=True, exist_ok=True)
# First screen: the static page markup (loading screen, header, presence card, nav, footer, desktop caption) + the lobby copy.
first_text = (ROOT / 'web/event-room/index.html').read_text()
first_text += json.dumps(json.load(open('/tmp/space-doodle/critique/perf/first-screen-text-phone.json')), ensure_ascii=False)
first = list(dict.fromkeys(bdf.CJK.findall(first_text)))
ranked = bdf.app_chars()
ranked0 = first + [c for c in ranked if c not in set(first)]
app_set = set(ranked)
ext = [c for c in bdf.gb2312_level1() if c not in app_set]
# Lean base: ASCII, Latin-1, general punctuation, CJK punctuation, fullwidth ASCII forms, and the symbols the UI uses.
used_symbols = set()
for base in ['web/event-room', 'web/static-runtime', 'web/event-client', 'web/js']:
    for p in (ROOT / base).rglob('*'):
        if p.is_file() and p.suffix in ('.js', '.html', '.css') and not (bdf.SKIP & set(p.relative_to(ROOT).parts)):
            used_symbols.update(ord(c) for c in re.findall('[℀-⯿]', p.read_text(errors='ignore')))
lean = bdf.ranges_to_points([(0x20, 0x7E), (0xA0, 0xFF), (0x2010, 0x2027), (0x2030, 0x205E), (0x3000, 0x303F), (0xFF01, 0xFF5E), (0xFFE0, 0xFFE6)]) + sorted(used_symbols)
N0 = max(300, len(first) + 120)
cuts = [N0, N0 + 400, N0 + 900]
slices_app = [ranked0[:cuts[0]], ranked0[cuts[0]:cuts[1]], ranked0[cuts[1]:cuts[2]], ranked0[cuts[2]:]]
css, report = [], []
for key, src in bdf.SOURCES.items():
    path = bdf.fetch(key, src)
    if src['slices'] == 'latin': plan = [bdf.ranges_to_points(bdf.LATIN)]
    elif src['slices'] == 'note': plan = [lean + [ord(c) for c in dict.fromkeys(bdf.NOTE_PHRASES)]]
    else:
        plan = [lean + [ord(c) for c in slices_app[0]]] + [[ord(c) for c in s] for s in slices_app[1:]]
        if src['slices'] == 'app+ext': plan.append([ord(c) for c in ext])
    for index, points in enumerate(plan):
        out = OUT / f'{key}-{index}.woff2'
        present = bdf.build_slice(path, src['family'], points, out)
        if not present: continue
        css.append(f'@font-face{{font-family:"{src["family"]}";src:url("./{out.name}") format("woff2");font-display:swap;unicode-range:{bdf.unicode_range(present)}}}')
        report.append(f'{out.name:16s} {len(present):5d} cps {out.stat().st_size / 1024:7.1f} KB')
(OUT / 'fonts.css').write_text('\n'.join(css) + '\n')
print('first-screen CJK chars:', len(first), 'slice0 CJK:', cuts[0])
print('\n'.join(report))
