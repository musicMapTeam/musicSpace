#!/usr/bin/env python3
"""Crawl FMA advanced search (Public Domain + instrumental filters) per genre; write tracks.jsonl (dedup by id)."""
import sys, re, json, html, subprocess, os, time
OUT = '/tmp/space-video-doodle/music-cc0/_probe/fma-pd-tracks.jsonl'
UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129 Safari/537.36'
genres = sys.argv[1].split(',')
instr = '--all' not in sys.argv
seen = {}
if os.path.exists(OUT):
    for l in open(OUT):
        j = json.loads(l); seen[j['id']] = j
def fetch(url):
    return subprocess.check_output(['curl', '-sSL', '-A', UA, url]).decode('utf-8', 'replace')
for g in genres:
    page = 1
    while True:
        url = f"https://freemusicarchive.org/search?adv=1&search-genre={g}&music-filter-public-domain=true" + ("&only-instrumental=true" if instr else "") + f"&pageSize=200&page={page}"
        raw = fetch(url)
        rows = raw.split("data-track-info='")
        n_new = 0
        for k in range(1, len(rows)):
            r = rows[k]
            j = json.loads(html.unescape(r[:r.index("'")]))
            prev = rows[k - 1][-400:]
            gm = re.search(r'gcol ((?:gid-[a-zA-Z0-9-]+ ?)*)tid-', prev)
            dur = re.search(r'>\s*(\d{1,2}):(\d{2})\s*</span>', r)
            j['dur_s'] = int(dur.group(1)) * 60 + int(dur.group(2)) if dur else None
            j['gids'] = gm.group(1).split() if gm else []
            j['search_genre'] = g
            j['instr_filter'] = instr
            if j['id'] not in seen:
                seen[j['id']] = j; n_new += 1
        print(g, 'page', page, 'rows', len(rows) - 1, 'new', n_new, flush=True)
        if len(rows) - 1 < 200 or page >= 12: break
        page += 1
        time.sleep(0.5)
with open(OUT, 'w') as f:
    for j in seen.values(): f.write(json.dumps(j, ensure_ascii=False) + '\n')
print('total', len(seen))
