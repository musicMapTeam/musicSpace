#!/usr/bin/env python3
import json, sys, numpy as np
P = '/tmp/space-video-doodle/music-cc0'
pool = {}
for l in open(f'{P}/_probe/pool.jsonl'):
    t = json.loads(l); pool[str(t['id'])] = t
rows = []
for l in open(f'{P}/_screen/screen.jsonl'):
    r = json.loads(l)
    if 'err' in r: continue
    t = pool.get(r['id'])
    if not t: continue
    r.update(artist=t['artistName'], title=t['title'], url=t['url'], dur_s=t['dur_s'], album=t.get('albumTitle', ''))
    rows.append(r)
def felt(b):
    c = [b, b * 2, b / 2, b * 1.5, b / 1.5]
    best = min(c[:3], key=lambda x: 0 if 110 <= x <= 135 else min(abs(x - 110), abs(x - 135)))
    return best
def tfit(x):
    d = 0 if 110 <= x <= 135 else min(abs(x - 110), abs(x - 135))
    return float(np.exp(-(d / 9) ** 2))
keys = ['pulse', 'beat_strength', 'perc_ratio', 'kick_per', 'snare_per', 'onset_rate', 'rms_db', 'backbeat']
W = dict(pulse=.22, beat_strength=.14, perc_ratio=.18, kick_per=.12, snare_per=.1, onset_rate=.08, rms_db=.08, backbeat=.08)
arr = {k: np.array([r[k] for r in rows], float) for k in keys}
pct = {k: (arr[k].argsort().argsort() / (len(rows) - 1)) for k in keys}
for i, r in enumerate(rows):
    r['felt_bpm'] = round(felt(r['bpm']), 1)
    r['tempo_fit'] = round(tfit(r['felt_bpm']), 2)
    r['rhythm'] = round(sum(W[k] * pct[k][i] for k in keys), 3)
    lenf = 1.0 if r['dur_s'] >= 170 else 0.85 if r['dur_s'] >= 150 else 0.6
    r['score'] = round(r['rhythm'] * (0.35 + 0.65 * r['tempo_fit']) * lenf, 3)
rows.sort(key=lambda r: -r['score'])
N = int(sys.argv[1]) if len(sys.argv) > 1 else 80
print(f"{'score':>5} {'rhy':>5} {'bpm':>6} {'felt':>6} {'pul':>5} {'bstr':>5} {'perc':>5} {'kick':>5} {'snr':>5} {'bb':>4} {'ons':>5} {'rms':>6} {'cent':>5} {'key':>4} {'dur':>4}  artist | title")
for r in rows[:N]:
    print(f"{r['score']:5.3f} {r['rhythm']:5.3f} {r['bpm']:6.1f} {r['felt_bpm']:6.1f} {r['pulse']:5.2f} {r['beat_strength']:5.1f} {r['perc_ratio']:5.2f} {r['kick_per']:5.2f} {r['snare_per']:5.2f} {r['backbeat']:4.1f} {r['onset_rate']:5.1f} {r['rms_db']:6.1f} {r['centroid']:5d} {r['key']:>4} {r['dur_s']:4d}  {r['artist'][:18]} | {r['title'][:46]} [{r['id']}]")
json.dump(rows, open(f'{P}/_screen/ranked.json', 'w'), indent=0)
