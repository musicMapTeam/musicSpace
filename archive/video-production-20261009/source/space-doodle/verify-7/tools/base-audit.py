import re, pathlib, collections
css = pathlib.Path('/Users/alakazan/workplace/tme/musicSpace/web/event-room/public/fonts/doodle/fonts.css').read_text()
faces = {}
for m in re.finditer(r'@font-face\{font-family:"([^"]+)";src:url\("\./([^"]+)"\)[^}]*unicode-range:([^}]*)\}', css):
    pts = set()
    for part in m.group(3).split(','):
        part = part.strip()[2:]
        if '-' in part:
            a, b = part.split('-'); pts.update(range(int(a, 16), int(b, 16) + 1))
        else: pts.add(int(part, 16))
    faces[m.group(2)] = pts
R = {'ascii/latin1': [(0x20,0x7E),(0xA0,0xFF)], 'gen punct': [(0x2010,0x2027),(0x2030,0x205E)], 'arrows 2190-21FF': [(0x2190,0x21FF)],
     'misc sym+dingbats 2600-27BF': [(0x2600,0x27BF)], 'CJK punct 3000-303F': [(0x3000,0x303F)], 'fullwidth FF01-FF5E': [(0xFF01,0xFF5E)], 'halfwidth/other FF00,FF5F-FFEF': [(0xFF00,0xFF00),(0xFF5F,0xFFEF)]}
def cat(cp):
    for k, rs in R.items():
        if any(a <= cp <= b for a, b in rs): return k
    return 'CJK/other'
for f in ['hand-0.woff2', 'marker-0.woff2', 'display-0.woff2', 'note-0.woff2']:
    c = collections.Counter(cat(cp) for cp in faces[f]); print(f, len(faces[f]), dict(c))
# Which symbols in those blanket ranges does the UI source actually use?
ROOT = pathlib.Path('/Users/alakazan/workplace/tme/musicSpace')
used = collections.Counter()
for base in ['web', 'runtime-preview/src', 'server', 'src']:
    p0 = ROOT / base
    if not p0.exists(): continue
    for p in p0.rglob('*'):
        if p.is_file() and p.suffix in ('.js', '.mjs', '.html', '.css', '.json') and not ({'node_modules','dist','dist-pages','vendor','public','.git'} & set(p.relative_to(ROOT).parts)):
            for ch in p.read_text(errors='ignore'):
                cp = ord(ch)
                if 0x2190 <= cp <= 0x21FF or 0x2600 <= cp <= 0x27BF or 0xFF00 <= cp <= 0xFFEF: used[ch] += 1
print('used symbols in blanket ranges:', len(used), ''.join(sorted(used)))
