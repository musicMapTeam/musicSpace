import sys, pathlib
from fontTools.ttLib import TTFont
old_dir, new_dir = pathlib.Path(sys.argv[1]), pathlib.Path(sys.argv[2])
for new in sorted(new_dir.glob('*.woff2')):
    old = old_dir / new.name
    a, b = TTFont(old), TTFont(new)
    diffs = []
    if sorted(a.keys()) != sorted(b.keys()): diffs.append('table set')
    for tag in a.keys():
        if tag == 'GlyphOrder' or tag not in b: continue
        if tag == 'head':
            for attr in ('modified', 'checkSumAdjustment'):
                setattr(a['head'], attr, 0); setattr(b['head'], attr, 0)
        if a.getTableData(tag) != b.getTableData(tag) if tag != 'head' else a['head'].compile(a) != b['head'].compile(b):
            diffs.append(tag)
    ca, cb = set(a.getBestCmap()), set(b.getBestCmap())
    print(f'{new.name:22s} cmap {"same" if ca == cb else f"DIFF +{len(cb-ca)} -{len(ca-cb)}"}; tables differing beyond head timestamp: {diffs or "none"}')
