import pathlib, re, unicodedata
from collections import Counter
from fontTools.ttLib import TTFont
ROOT = pathlib.Path('/Users/alakazan/workplace/tme/musicSpace')
SCAN_DIRS = ['web', 'runtime-preview/src', 'server', 'src']
SKIP = {'node_modules', 'dist', 'dist-pages', 'vendor', 'public', '.git'}
cnt = Counter()
for base in SCAN_DIRS:
  p0 = ROOT / base
  if not p0.exists(): continue
  for path in p0.rglob('*'):
    if not path.is_file() or SKIP & set(path.relative_to(ROOT).parts): continue
    if path.suffix in ('.js', '.mjs', '.html', '.css', '.json'):
      for ch in path.read_text(errors='ignore'):
        cp = ord(ch)
        if cp > 0x7E and not (0x3400 <= cp <= 0x4DBF or 0x4E00 <= cp <= 0x9FFF or 0xF900 <= cp <= 0xFAFF):
          cnt[ch] += 1
fonts = {k: TTFont(f'/tmp/music-space-font-cache/{k}.ttf').getBestCmap() for k in ['display','marker','hand','note','logo','digits']}
BASE = [(0x20, 0x7E), (0xA0, 0xFF), (0x2010, 0x2027), (0x2030, 0x205E), (0x2190, 0x21FF), (0x2600, 0x27BF), (0x3000, 0x303F), (0xFF00, 0xFFEF)]
inbase = lambda cp: any(a <= cp <= b for a, b in BASE)
print('char  cp     count base  disp mark hand note logo digi  name')
for ch, n in sorted(cnt.items(), key=lambda x: -x[1]):
  cp = ord(ch)
  if cp in (0xFEFF,) or unicodedata.category(ch) in ('Cc','Cf','Zl','Zp'): continue
  row = ' '.join(('Y' if cp in fonts[k] else '.').center(4) for k in ['display','marker','hand','note','logo','digits'])
  print(f'{ch!s:4} U+{cp:04X} {n:6d} {"B" if inbase(cp) else "-":4} {row}  {unicodedata.name(ch, "?")[:40]}')
