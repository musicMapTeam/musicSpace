#!/usr/bin/env python3
"""List tracks on an FMA page (artist/album/genre/search): title, duration, genre classes, page url, file url, licence hints.
usage: fma_list.py URL [--save file.html]"""
import sys, re, json, html, subprocess
url = sys.argv[1]
raw = subprocess.check_output(['curl', '-sSL', '-A', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129 Safari/537.36', url]).decode('utf-8', 'replace')
if '--save' in sys.argv:
    open(sys.argv[sys.argv.index('--save') + 1], 'w').write(raw)
rows = raw.split("data-track-info='")[1:]
for r in rows:
    j = json.loads(html.unescape(r[:r.index("'")]))
    # genre classes on the preceding div are before the attribute; look back in raw
    dur = re.search(r'>\s*(\d{1,2}:\d{2})\s*</span>', r)
    print(f"{(dur.group(1) if dur else '?'):>6}  {j['artistName'][:22]:22s} | {j.get('albumTitle','')[:34]:34s} | {j['title'][:60]:60s} | {j['url']}")
# genre ids
g = re.findall(r'gcol ((?:gid-[a-z0-9-]+ ?)+)tid-(\d+)', raw)
if '--genres' in sys.argv:
    for gg, tid in g: print('  genre', tid, gg)
lic = sorted(set(re.findall(r'creativecommons\.org/[a-z/.\-0-9]+', raw)))
print('licence links on page:', lic)
albums = sorted(set(re.findall(r'href="(https://freemusicarchive\.org/music/[^/"]+/[^/"]+/?)"', raw)))
print('album-ish links:', len(albums))
for a in albums[:80]: print('   ', a)
pages = sorted(set(re.findall(r'[?&]page=(\d+)', raw)), key=int)
print('pages:', pages[-5:] if pages else None)
