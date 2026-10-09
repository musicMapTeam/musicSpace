# Font coverage audit for the Doodle fonts (read-only). Replicates app_chars() of scripts/fonts/build-doodle-fonts.py
# against the CURRENT tree and compares with the cmaps of the generated woff2 slices.
import importlib.util, json, pathlib, re, sys
from collections import defaultdict
from fontTools.ttLib import TTFont
ROOT = pathlib.Path('/Users/alakazan/workplace/tme/musicSpace')
spec = importlib.util.spec_from_file_location('bdf', ROOT / 'scripts/fonts/build-doodle-fonts.py')
bdf = importlib.util.module_from_spec(spec); spec.loader.exec_module(bdf)
OUT = ROOT / 'web/event-room/public/fonts/doodle'
CACHE = pathlib.Path('/tmp/music-space-font-cache')
ranked = bdf.app_chars()
app = set(ranked)
fams = defaultdict(dict)
for f in sorted(OUT.glob('*.woff2')):
    key, idx = f.stem.split('-')
    fams[key][f.name] = set(TTFont(f).getBestCmap().keys())
upstream = {k: set(TTFont(CACHE / f'{k}.ttf').getBestCmap().keys()) for k in fams if (CACHE / f'{k}.ttf').exists()}
report = {'app_chars_now': len(ranked)}
# Rebuild what the generator would have used at generation time is unknown; report vs now.
for key, slices in fams.items():
    cov = set().union(*slices.values())
    missing = [c for c in ranked if ord(c) not in cov]
    not_in_upstream = [c for c in missing if ord(c) not in upstream.get(key, set())]
    fixable = [c for c in missing if ord(c) in upstream.get(key, set())]
    report[key] = {'slices': {n: len(s) for n, s in slices.items()}, 'cjk_covered': sum(1 for c in ranked if ord(c) in cov),
                   'missing_count': len(missing), 'missing_fixable_by_rerun': ''.join(fixable), 'missing_absent_upstream': ''.join(not_in_upstream)}
# overlap check within each family
overlaps = {}
for key, slices in fams.items():
    names = list(slices)
    for i in range(len(names)):
        for j in range(i + 1, len(names)):
            inter = slices[names[i]] & slices[names[j]]
            # ignore glyphs every slice carries implicitly? report all
            if inter:
                overlaps[f'{names[i]}&{names[j]}'] = len(inter)
report['cmap_overlaps'] = overlaps
print(json.dumps(report, ensure_ascii=False, indent=1))
