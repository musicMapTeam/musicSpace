import re, sys
from pathlib import Path
ROOT = Path(sys.argv[1])
css = (ROOT / 'web/event-room/public/fonts/doodle/fonts.css').read_text()
cover = {}
for fam, rng in re.findall(r'font-family:"([^"]+)";src:[^;]+;font-display:swap;unicode-range:([^;}]+)', css):
    s = cover.setdefault(fam, set())
    for part in rng.split(','):
        part = part.strip()[2:]
        if '-' in part:
            a, b = part.split('-'); s.update(range(int(a, 16), int(b, 16) + 1))
        else:
            s.add(int(part, 16))
SCAN = ['web', 'runtime-preview/src', 'server', 'src']
SKIP = {'node_modules', 'dist', 'dist-pages', 'vendor', 'public', '.git'}
CJK = re.compile('[㐀-䶿一-鿿豈-﫿]')
chars = {}
for base in SCAN:
    p = ROOT / base
    if not p.exists(): continue
    for f in p.rglob('*'):
        if f.is_file() and not SKIP & set(f.relative_to(ROOT).parts) and f.suffix in ('.js', '.mjs', '.html', '.css', '.json'):
            for ch in set(CJK.findall(f.read_text(errors='ignore'))):
                chars.setdefault(ch, set()).add(str(f.relative_to(ROOT)))
print('families', {k: len(v) for k, v in cover.items()})
for fam in ['Doodle Display', 'Doodle Marker', 'Doodle Hand']:
    miss = sorted(ch for ch in chars if ord(ch) not in cover.get(fam, set()))
    print(fam, 'missing', len(miss), ''.join(miss[:80]))
    for ch in miss[:20]:
        print('   ', ch, sorted(chars[ch])[:4])
