#!/usr/bin/env python3
"""AudioSet tags for many short chunks (batched). usage: tag_chunks.py list.txt out.jsonl"""
import sys, json, subprocess, os
import numpy as np, torch
from transformers import ASTFeatureExtractor, ASTForAudioClassification
M = '/tmp/space-video-doodle/music-cc0/tools/ast-model'
fe = ASTFeatureExtractor.from_pretrained(M); model = ASTForAudioClassification.from_pretrained(M).eval().to('mps')
lab = model.config.id2label; n2i = {v: int(k) for k, v in lab.items()}
WANT = ['Singing', 'Speech', 'Vocal music', 'Rapping', 'Guitar', 'Electric guitar', 'Bass guitar', 'Acoustic guitar', 'Strum', 'Drum kit', 'Drum machine', 'Piano', 'Organ', 'Synthesizer',
        'Brass instrument', 'Saxophone', 'Trumpet', 'Pop music', 'Rock music', 'Punk rock', 'Rock and roll', 'Funk', 'Disco', 'Soul music', 'Electronic music', 'House music', 'Techno', 'Trance music',
        'Video game music', 'Jazz', 'Ska', 'Reggae', 'Happy music', 'Funny music', 'Exciting music', 'Sad music', 'Tender music', 'Angry music', 'Scary music', 'Independent music', 'Country', 'Folk music', 'Swing music']
done = set()
out = sys.argv[2]
if os.path.exists(out):
    for l in open(out): done.add(json.loads(l)['id'])
files = [l.strip() for l in open(sys.argv[1]) if l.strip() and os.path.basename(l.strip())[:-4] not in done]
SR = 16000
with open(out, 'a') as fo:
    for p in files:
        try:
            y = np.frombuffer(subprocess.check_output(['ffmpeg', '-v', 'quiet', '-i', p, '-ac', '1', '-ar', str(SR), '-f', 'f32le', '-']), dtype=np.float32)
        except Exception:
            continue
        mid = max(0, len(y) // 2 - int(SR * 5.12))
        wins = [y[mid:mid + int(SR * 10.24)]]  # one centred 10.24 s window per chunk (fast screen)
        wins = [w for w in wins if len(w) > SR * 6]
        if not wins: continue
        with torch.no_grad():
            b = fe(wins, sampling_rate=SR, return_tensors='pt')
            P = torch.sigmoid(model(**{k: v.to('mps') for k, v in b.items()}).logits).cpu().numpy()
        m = P.mean(0)
        fo.write(json.dumps(dict(id=os.path.basename(p)[:-4], n=len(wins), tags={k: round(float(m[n2i[k]]), 3) for k in WANT if k in n2i})) + '\n'); fo.flush()
print('done', len(files))
