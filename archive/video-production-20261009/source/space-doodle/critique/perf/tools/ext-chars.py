import importlib.util, pathlib, re, collections, json
from fontTools.ttLib import TTFont
ROOT = pathlib.Path('/Users/alakazan/workplace/tme/musicSpace')
spec = importlib.util.spec_from_file_location('bdf', ROOT / 'scripts/fonts/build-doodle-fonts.py')
bdf = importlib.util.module_from_spec(spec); spec.loader.exec_module(bdf)
OUT = ROOT / 'web/event-room/public/fonts/doodle'
cm = {f.stem: set(TTFont(f).getBestCmap()) for f in OUT.glob('*.woff2')}
ranked = bdf.app_chars()
# where does each char live per family
for fam in ('display', 'marker', 'hand'):
    where = collections.defaultdict(list)
    for c in ranked:
        hit = [k for k in cm if k.startswith(fam + '-') and ord(c) in cm[k]]
        where[hit[0] if hit else 'NONE'].append(c)
    print(fam, {k: len(v) for k, v in sorted(where.items())})
    for k in sorted(where):
        if k.endswith('-4') or k == 'NONE':
            print('  ', k, ''.join(where[k]))
# Which source files contain the chars that live in ext slices?
ext = set(c for c in ranked if any(ord(c) in cm[k] for k in ('hand-4',)))
hits = collections.defaultdict(set)
for base in bdf.SCAN_DIRS:
    for path in (ROOT / base).rglob('*'):
        if not path.is_file() or bdf.SKIP & set(path.relative_to(ROOT).parts): continue
        if path.suffix in ('.js', '.mjs', '.html', '.css', '.json'):
            t = path.read_text(errors='ignore')
            for c in ext:
                if c in t: hits[str(path.relative_to(ROOT))].add(c)
for p, cs in sorted(hits.items()):
    print(p, ''.join(sorted(cs)))
