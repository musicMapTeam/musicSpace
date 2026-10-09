#!/usr/bin/env python3
"""A5 v3 (2026-10-08): bars 65-72 of the flipping-in-b map play Flipping In 93-100 instead of 79-86 (the thin groove: mids 8-18 dB
lower, 83-86 lose the horns/keys).  Writes the map, its compiled timeline and the rendered bed atomically (temp file + rename,
mtimes ordered map < compiled < bed so tools/music.py ensure_bed does not re-render it)."""
import json, os, sys, time, subprocess
PROD = '/tmp/space-video-doodle/prod'
sys.path.insert(0, os.path.join(PROD, 'tools'))
import tempo, music
from audiolib import SR, write_wav, normalize
MID = 'flipping-in-b'
mp = os.path.join(tempo.MAPS, MID + '.json')
M = json.load(open(mp))
row = next(p for p in M['plan'] if p['sb'] == '65-72')
old = dict(row)
row['trk'] = '93-100'
row['why'] = ('(A5 v3, 2026-10-08) the groove stays full under the after-the-swap montage (Music Map, venue community, creation '
              'corner, memory card, My Space): FI 93-100 = horns on, mids 6-17 dB fuller than 79-86 (83-86 had lost the horns/keys); '
              'splices 118->93 harmony 0.95, 100->119 0.94 (79-86: 0.90 / 0.92); FI 93-100 last played under 39-46, 50 s earlier')
M['moments']['social_groove']['note'] = 'FI 105-118 then FI 93-100 (A5 v3, 2026-10-08; was 79-86)'
print('plan 65-72:', old['trk'], '->', row['trk'])
M2 = dict(M); M2['_path'] = os.path.abspath(mp)
C = tempo.compile_map(M2)
raw, splices = music.render_bed(C)
y, norm = normalize(raw, -16.0)
rep = dict(map=MID, label=C['label'], track=C['track'], duration_s=round(C['end_s'], 3), bars=len(C['bars']), cut=C['cut'], added=C['added'],
           splices=music.splice_clicks(y, splices, C), loudness=norm, onsets_vs_grid=music.onsets_vs_grid(y, C), moments=music.moments(y, C))
beds = music.BEDS
tmp = lambda p: os.path.splitext(p)[0] + '.a5v3tmp' + os.path.splitext(p)[1]
wav = os.path.join(beds, MID + '.wav'); m4a = os.path.join(beds, MID + '.m4a'); repp = os.path.join(beds, MID + '.report.json')
cp = tempo.compiled_path(MID)
write_wav(tmp(wav), y, 24)
subprocess.run(['/opt/homebrew/bin/ffmpeg', '-y', '-v', 'error', '-i', tmp(wav), '-c:a', 'aac', '-b:a', '256k', '-f', 'mp4', tmp(m4a)], check=True)
rep['files'] = dict(wav=os.path.abspath(wav), m4a=os.path.abspath(m4a))
with open(tmp(mp), 'w') as f: json.dump(M, f, ensure_ascii=False, indent=1); f.write('\n')
with open(tmp(cp), 'w') as f: json.dump(C, f, ensure_ascii=False, indent=1)
with open(tmp(repp), 'w') as f: json.dump(rep, f, ensure_ascii=False, indent=1)
for p in (mp, cp, wav, m4a, repp): os.replace(tmp(p), p)
now = time.time()
os.utime(mp, (now - 3, now - 3)); os.utime(cp, (now - 2, now - 2))
for p in (wav, m4a, repp): os.utime(p, (now - 1, now - 1))
print('end_s', round(C['end_s'], 4), 'loudness', norm)
print('splices', [(s['at'], s['from_trk'], s['to_trk'], s['click']) for s in rep['splices']])
print('moments', json.dumps(rep['moments'], ensure_ascii=False)[:1500])
