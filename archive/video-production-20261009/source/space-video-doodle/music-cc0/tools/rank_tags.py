#!/usr/bin/env python3
import json, sys
P = '/tmp/space-video-doodle/music-cc0/_screen'
rows = {r['id']: r for r in json.load(open(f'{P}/ranked.json'))}
pool = {}
for l in open('/tmp/space-video-doodle/music-cc0/_probe/pool.jsonl'):
    t = json.loads(l); pool[str(t['id'])] = t
out = []
for l in open(f'{P}/chunk-tags.jsonl'):
    j = json.loads(l); r = rows.get(j['id'])
    if not r: continue
    t = j['tags']
    band = sum(t.get(k, 0) for k in ['Electric guitar', 'Bass guitar', 'Drum kit', 'Rock music', 'Pop music', 'Funk', 'Disco', 'Soul music', 'Ska', 'Rock and roll', 'Punk rock', 'Independent music', 'Brass instrument', 'Saxophone', 'Trumpet']) + 0.3 * t.get('Guitar', 0)
    mood = t.get('Happy music', 0) + t.get('Funny music', 0) + t.get('Exciting music', 0) - t.get('Sad music', 0) - t.get('Tender music', 0) - t.get('Angry music', 0) - t.get('Scary music', 0)
    voc = t.get('Singing', 0) + t.get('Speech', 0) + t.get('Vocal music', 0) + t.get('Rapping', 0)
    if r['rhythm'] < 0.55: continue
    score = (r['rhythm'] * (0.35 + 0.65 * r['tempo_fit'])) * 1.5 + band * 1.0 + mood * 1.5 - voc * 2.0 - (t.get('Tender music', 0) + t.get('Sad music', 0))
    out.append((score, band, mood, voc, r, t))
out.sort(key=lambda x: -x[0])
N = int(sys.argv[1]) if len(sys.argv) > 1 else 60
for s, b, m, v, r, t in out[:N]:
    top = sorted(((k, val) for k, val in t.items()), key=lambda x: -x[1])[:6]
    print(f"{s:5.2f} band {b:4.2f} mood {m:5.2f} voc {v:4.2f} | {r['felt_bpm']:6.1f} {r['key']:>4} {r['dur_s']:4d}s rhy {r['rhythm']:.2f} | {r['artist'][:16]:16s} {r['title'][:36]:36s} {r['id']} | " + ', '.join(f'{k} {val:.2f}' for k, val in top))
