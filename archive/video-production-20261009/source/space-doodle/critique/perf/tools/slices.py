# slices.py "<family>" "<text>" ... -> which fonts.css slice files each text needs (and missing chars)
import re, sys
css = open('/Users/alakazan/workplace/tme/musicSpace/web/event-room/public/fonts/doodle/fonts.css').read()
faces = []
for fam, file, rng in re.findall(r'font-family:"([^"]+)";src:url\("\./([^"]+)"\)[^}]*unicode-range:([^}]+)\}', css):
    ranges = []
    for part in rng.split(','):
        a, _, b = part.strip()[2:].partition('-'); ranges.append((int(a, 16), int(b or a, 16)))
    faces.append((fam, file, ranges))
def need(fam, text):
    out, miss = {}, []
    for ch in text:
        if ch.isspace(): continue
        hit = [f for fa, f, r in faces if fa == fam and any(a <= ord(ch) <= b for a, b in r)]
        if hit: out.setdefault(hit[0], []).append(ch)
        else: miss.append(ch)
    return {k: ''.join(v) for k, v in out.items()}, ''.join(miss)
args = sys.argv[1:]
for i in range(0, len(args), 2):
    print(args[i].ljust(15), args[i + 1][:40].ljust(42), *need(args[i], args[i + 1]))
