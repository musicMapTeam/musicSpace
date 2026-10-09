#!/usr/bin/env python3
import json, glob, re, html, os
P = '/tmp/space-video-doodle/music-cc0/_probe'
pool = {}
EXCL_ART = {'Kosta T', 'Bob A. Feldman'}
ALLOW_FOLK_INSTR = {'Komiku', 'HoliznaCC0', 'Monplaisir', 'Loyalty Freak Music', 'Alpha Hydrae', 'TRG Banks', 'John Bartmann', 'Play House', 'Zane Little',
                    'Ondrosik', 'Rafael Archangel', 'Metre', 'Patrick Steel', 'Soundtrack 4 Life', 'Koi-discovery', 'Art Flower', 'Frederic Lardon', 'Mr Smith'}
for l in open(f'{P}/fma-pd-tracks.jsonl'):
    t = json.loads(l)
    if not t['dur_s'] or not (150 <= t['dur_s'] <= 420): continue
    if t['artistName'] in EXCL_ART: continue
    if t['search_genre'] in ('Instrumental', 'Folk') and t['artistName'] not in ALLOW_FOLK_INSTR: continue
    t['src'] = 'search:' + t['search_genre']
    pool[t['id']] = t
# album pages saved earlier (not filtered as instrumental by FMA, e.g. LFM / Komiku / Holizna albums tagged Electronic)
for f in glob.glob(f'{P}/fma-lfm-*.html') + glob.glob(f'{P}/fma-komiku-*.html') + glob.glob(f'{P}/fma-holizna-*.html') + glob.glob(f'{P}/fma-monplaisir-*.html'):
    raw = open(f, encoding='utf-8', errors='replace').read()
    rows = raw.split("data-track-info='")
    for r in rows[1:]:
        j = json.loads(html.unescape(r[:r.index("'")]))
        d = re.search(r'>\s*(\d{1,2}):(\d{2})\s*</span>', r)
        j['dur_s'] = int(d.group(1)) * 60 + int(d.group(2)) if d else None
        if not j['dur_s'] or not (150 <= j['dur_s'] <= 420): continue
        if j['id'] in pool: continue
        j['src'] = 'album:' + os.path.basename(f)
        pool[j['id']] = j
out = f'{P}/pool.jsonl'
with open(out, 'w') as fo:
    for t in pool.values(): fo.write(json.dumps(t, ensure_ascii=False) + '\n')
import collections
c = collections.Counter(t['artistName'] for t in pool.values())
print(len(pool)); print(c.most_common(50))
