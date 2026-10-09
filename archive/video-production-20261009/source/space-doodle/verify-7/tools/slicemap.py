import re, sys, json, pathlib
css = pathlib.Path('/Users/alakazan/workplace/tme/musicSpace/web/event-room/public/fonts/doodle/fonts.css').read_text()
faces = []
for m in re.finditer(r'@font-face\{font-family:"([^"]+)";src:url\("\./([^"]+)"\)[^}]*unicode-range:([^}]*)\}', css):
    fam, file, rng = m.group(1), m.group(2), m.group(3)
    pts = set()
    for part in rng.split(','):
        part = part.strip()[2:]
        if '-' in part:
            a, b = part.split('-'); pts.update(range(int(a,16), int(b,16)+1))
        else:
            pts.add(int(part,16))
    faces.append((fam, file, pts))
size = {f: pathlib.Path('/Users/alakazan/workplace/tme/musicSpace/web/event-room/public/fonts/doodle/'+f).stat().st_size for _, f, _ in faces}
for fam, f, pts in faces:
    print(f'{fam:16s} {f:16s} {len(pts):6d} cps {size[f]/1024:7.1f} KB')
def which(fam, text):
    out = {}
    for ch in text:
        if ch.isspace(): continue
        hit = [f for (fa, f, pts) in faces if fa == fam and ord(ch) in pts]
        out.setdefault(hit[0] if hit else 'NONE', []).append(ch)
    return {k: ''.join(dict.fromkeys(v)) for k, v in out.items()}
if len(sys.argv) > 2:
    print(json.dumps(which(sys.argv[1], sys.argv[2]), ensure_ascii=False))
