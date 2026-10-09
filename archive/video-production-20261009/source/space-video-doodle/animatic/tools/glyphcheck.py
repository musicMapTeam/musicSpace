# Which characters of each text role are missing from the raw OFL/Apache TTFs?  usage: glyphcheck.py texts.json
import json, sys
from fontTools.ttLib import TTFont
FONTS = {k: f'/tmp/music-space-font-cache/{k}.ttf' for k in ['display','marker','hand','note','logo','digits']}
cmaps = {}
def cmap(k):
    if k not in cmaps: cmaps[k] = set(TTFont(FONTS[k], lazy=True).getBestCmap().keys())
    return cmaps[k]
texts = json.load(open(sys.argv[1]))
bad = 0
TRAPS = {'display': '入个·'}   # raw 站酷庆科黄油体: 入 draws like 几, 个 like 卜, no ·
for role, lines in texts.items():
    for line in lines:
        miss = sorted({c for c in line if c.strip() and ord(c) not in cmap(role)})
        trap = sorted({c for c in line if c in TRAPS.get(role, '')})
        if miss or trap:
            bad += 1; print(f'[{role}] {line!r}: missing {miss} traps {trap}')
print('checked', sum(len(v) for v in texts.values()), 'lines;', bad, 'with problems')
