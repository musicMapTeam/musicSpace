import sys, importlib.util, pathlib, re
sys.dont_write_bytecode = True
ROOT = pathlib.Path('/Users/alakazan/workplace/tme/musicSpace')
spec = importlib.util.spec_from_file_location('bdf', ROOT / 'scripts/fonts/build-doodle-fonts.py')
bdf = importlib.util.module_from_spec(spec); spec.loader.exec_module(bdf)
ranked = bdf.app_chars()
used = set()
for base in bdf.SCAN_DIRS:
    p0 = ROOT / base
    if not p0.exists(): continue
    for p in p0.rglob('*'):
        if p.is_file() and p.suffix in ('.js', '.mjs', '.html', '.css', '.json') and not (bdf.SKIP & set(p.relative_to(ROOT).parts)):
            used.update(ord(c) for c in p.read_text(errors='ignore') if 0x2190 <= ord(c) <= 0x21FF or 0x2600 <= ord(c) <= 0x27BF or 0xFF00 <= ord(c) <= 0xFFEF)
lean = bdf.ranges_to_points([(0x20, 0x7E), (0xA0, 0xFF), (0x2010, 0x2027), (0x2030, 0x205E), (0x3000, 0x303F), (0xFF01, 0xFF5E), (0xFFE0, 0xFFE6)]) + sorted(used)
out = pathlib.Path('/tmp/space-doodle/verify-7/exp')
for key in ['hand', 'marker', 'display']:
    src = bdf.SOURCES[key]; path = bdf.CACHE / f'{key}.ttf'
    for label, base in [('full', bdf.ranges_to_points(bdf.BASE)), ('lean', lean)]:
        o = out / f'{key}-0-{label}.woff2'
        present = bdf.build_slice(path, src['family'], base + [ord(c) for c in ranked[:bdf.CUTS[0]]], o)
        print(f'{key}-0 {label}: {len(present)} cps {o.stat().st_size/1024:.1f} KB')
