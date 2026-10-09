# Which scanned source characters each Doodle family covers (from fonts.css unicode-ranges), split room vs map.
import re, sys, pathlib
ROOT = pathlib.Path(sys.argv[1])
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
CJK = re.compile('[㐀-䶿一-鿿豈-﫿]')
room, mapc, where = set(), set(), {}
for base in SCAN:
    p = ROOT / base
    for f in p.rglob('*'):
        if f.is_file() and not SKIP & set(f.relative_to(ROOT).parts) and f.suffix in ('.js', '.mjs', '.html', '.css', '.json'):
            chars = set(CJK.findall(f.read_text(errors='ignore')))
            rel = str(f.relative_to(ROOT))
            (mapc if rel.startswith('web/original-map/') else room).update(chars)
            for ch in chars: where.setdefault(ch, set()).add(rel)
# vendor files of the map (skipped by the font script): do they carry CJK the page shows?
vend = set()
for f in (ROOT / 'web/original-map').rglob('*'):
    if f.is_file() and 'vendor' in f.parts and f.suffix in ('.js', '.mjs', '.json', '.html', '.css'):
        vend.update(CJK.findall(f.read_text(errors='ignore')))
print('code points per family:', {k: len(v) for k, v in cover.items()})
print(f'room-source CJK: {len(room)}, map-source CJK: {len(mapc)}, map-only: {len(mapc - room)}, map vendor CJK not scanned: {"".join(sorted(vend - room - mapc)) or "none"}')
for fam in ['Doodle Marker', 'Doodle Hand', 'Doodle Display']:
    for label, chars in (('room', room), ('map', mapc)):
        miss = sorted(ch for ch in chars if ord(ch) not in cover.get(fam, set()))
        print(f'{fam:15s} {label:4s} missing {len(miss):3d} {"".join(miss)}')
miss = sorted(ch for ch in room | mapc if ord(ch) not in cover.get('Doodle Display', set()))
for ch in miss:
    print('   display lacks', ch, sorted(where[ch])[:3])
