# Verification experiment (writes only to /tmp): first-screen characters forced into slice 0, BASE trimmed to used symbols.
import sys, importlib.util, pathlib, json
sys.dont_write_bytecode = True
ROOT = pathlib.Path('/Users/alakazan/workplace/tme/musicSpace')
spec = importlib.util.spec_from_file_location('bdf', ROOT / 'scripts/fonts/build-doodle-fonts.py')
bdf = importlib.util.module_from_spec(spec); spec.loader.exec_module(bdf)
OUT = pathlib.Path(sys.argv[1]); OUT.mkdir(parents=True, exist_ok=True)
text = (ROOT / 'web/event-room/index.html').read_text() + (ROOT / 'web/static-runtime/showcase/copy.js').read_text()
for vp in ('phone', 'desktop'):
    text += json.dumps(json.load(open(f'/tmp/space-doodle/verify-7/runs/text-{vp}.json'))['text'], ensure_ascii=False)
first = list(dict.fromkeys(bdf.CJK.findall(text)))
ranked = bdf.app_chars(); fs_ = set(first)
ranked0 = first + [c for c in ranked if c not in fs_]
ext = [c for c in bdf.gb2312_level1() if c not in set(ranked)]
used = set()
for base in bdf.SCAN_DIRS:
    p0 = ROOT / base
    if not p0.exists(): continue
    for p in p0.rglob('*'):
        if p.is_file() and p.suffix in ('.js', '.mjs', '.html', '.css', '.json') and not (bdf.SKIP & set(p.relative_to(ROOT).parts)):
            used.update(ord(c) for c in p.read_text(errors='ignore') if 0x2190 <= ord(c) <= 0x21FF or 0x2600 <= ord(c) <= 0x27BF or 0xFF00 <= ord(c) <= 0xFFEF)
lean = bdf.ranges_to_points([(0x20, 0x7E), (0xA0, 0xFF), (0x2010, 0x2027), (0x2030, 0x205E), (0x3000, 0x303F), (0xFF01, 0xFF5E), (0xFFE0, 0xFFE6)]) + sorted(used)
n0 = max(300, len(first)); cuts = [n0, n0 + 400, n0 + 900]
sl = [ranked0[:cuts[0]], ranked0[cuts[0]:cuts[1]], ranked0[cuts[1]:cuts[2]], ranked0[cuts[2]:]]
print('first-screen CJK chars:', len(first), 'slice0 size', n0)
css = []
for key, src in bdf.SOURCES.items():
    path = bdf.CACHE / f'{key}.ttf'
    if src['slices'] == 'latin': plan = [bdf.ranges_to_points(bdf.LATIN)]
    elif src['slices'] == 'note': plan = [lean + [ord(c) for c in dict.fromkeys(list(bdf.NOTE_PHRASES) + ranked[:bdf.CUTS[0]])]]
    else:
        plan = [lean + [ord(c) for c in sl[0]]] + [[ord(c) for c in s] for s in sl[1:]]
        if src['slices'] == 'app+ext': plan.append([ord(c) for c in ext])
    for i, pts in enumerate(plan):
        o = OUT / f'{key}-{i}.woff2'; present = bdf.build_slice(path, src['family'], pts, o)
        if not present: continue
        css.append(f'@font-face{{font-family:"{src["family"]}";src:url("./{o.name}") format("woff2");font-display:swap;unicode-range:{bdf.unicode_range(present)}}}')
        print(f'{o.name:16s} {len(present):5d} cps {o.stat().st_size/1024:7.1f} KB')
(OUT / 'fonts.css').write_text('\n'.join(css) + '\n')
