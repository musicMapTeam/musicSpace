#!/usr/bin/env python3
"""Objective instrument / genre / mood tags with a pretrained AudioSet classifier (AST, MIT/ast-finetuned-audioset-10-10-0.4593).
Scores 10.24 s windows every 10 s across the whole track, averages the sigmoid probabilities and prints the music-relevant labels.
usage: tag_audioset.py out.json file1 [file2 ...]"""
import sys, json, subprocess, os
import numpy as np
import torch
from transformers import ASTFeatureExtractor, ASTForAudioClassification

MODEL = '/tmp/space-video-doodle/music-cc0/tools/ast-model'  # local copy of MIT/ast-finetuned-audioset-10-10-0.4593 (HF download stalled)
fe = ASTFeatureExtractor.from_pretrained(MODEL)
model = ASTForAudioClassification.from_pretrained(MODEL).eval()
dev = 'mps' if torch.backends.mps.is_available() else 'cpu'
model.to(dev)
labels = model.config.id2label
SR = 16000

KEEP = ['Music', 'Singing', 'Speech', 'Male singing', 'Female singing', 'Choir', 'Vocal music', 'Rapping', 'Humming', 'Whistling',
        'Guitar', 'Electric guitar', 'Bass guitar', 'Acoustic guitar', 'Steel guitar, slide guitar', 'Strum', 'Plucked string instrument',
        'Drum kit', 'Drum', 'Snare drum', 'Bass drum', 'Hi-hat', 'Drum machine', 'Cymbal', 'Tambourine', 'Clapping', 'Hand clap'
        'Percussion', 'Keyboard (musical)', 'Piano', 'Electric piano', 'Organ', 'Electronic organ', 'Hammond organ', 'Synthesizer', 'Sampler',
        'Brass instrument', 'Trumpet', 'Trombone', 'Saxophone', 'Wind instrument, woodwind instrument', 'Flute', 'Harmonica', 'Accordion',
        'Violin, fiddle', 'Bowed string instrument', 'String section', 'Orchestra', 'Ukulele', 'Banjo', 'Mandolin', 'Glockenspiel', 'Marimba, xylophone', 'Vibraphone', 'Bell',
        'Pop music', 'Rock music', 'Punk rock', 'Grunge', 'Progressive rock', 'Rock and roll', 'Psychedelic rock', 'Heavy metal', 'Funk', 'Disco', 'Soul music', 'Rhythm and blues',
        'Hip hop music', 'Electronic music', 'House music', 'Techno', 'Dubstep', 'Drum and bass', 'Electronica', 'Electronic dance music', 'Ambient music', 'Trance music',
        'Video game music', 'Chiptune', 'Jazz', 'Swing music', 'Blues', 'Country', 'Reggae', 'Ska', 'Folk music', 'Music for children', 'Soundtrack music', 'Background music',
        'Theme music', 'Jingle (music)', 'Dance music', 'New-age music', 'Independent music', 'Christmas music', 'Happy music', 'Funny music', 'Sad music', 'Tender music',
        'Exciting music', 'Angry music', 'Scary music', 'Middle Eastern music', 'Music of Latin America', 'Salsa music', 'Afrobeat', 'Music of Africa', 'Music of Asia',
        'Carnatic music', 'Flamenco', 'Gospel music', 'Christian music', 'Lullaby', 'Wedding music', 'Television music', 'Video game music', 'Beatboxing', 'Scratching (performance technique)']


def decode(p):
    raw = subprocess.check_output(['ffmpeg', '-v', 'quiet', '-i', p, '-ac', '1', '-ar', str(SR), '-f', 'f32le', '-'])
    return np.frombuffer(raw, dtype=np.float32).copy()


out = {}
for p in sys.argv[2:]:
    y = decode(p)
    wins = []
    for s in range(0, max(1, len(y) - SR * 10), SR * 10):
        seg = y[s:s + int(SR * 10.24)]
        if len(seg) < SR * 5 or np.sqrt(np.mean(seg ** 2)) < 1e-3:
            continue
        wins.append(seg)
    probs = []
    with torch.no_grad():
        for i in range(0, len(wins), 8):
            batch = fe(wins[i:i + 8], sampling_rate=SR, return_tensors='pt')
            logits = model(**{k: v.to(dev) for k, v in batch.items()}).logits
            probs.append(torch.sigmoid(logits).cpu().numpy())
    P = np.concatenate(probs)
    mean = P.mean(0)
    mx = P.max(0)
    name2i = {v: int(k) for k, v in labels.items()}
    res = {}
    for lab in KEEP:
        if lab in name2i:
            i = name2i[lab]
            res[lab] = dict(mean=round(float(mean[i]), 3), max=round(float(mx[i]), 3), frac_windows_over_0_3=round(float((P[:, i] > 0.3).mean()), 2))
    top = sorted(((labels[i], float(mean[i])) for i in range(len(mean))), key=lambda x: -x[1])[:15]
    out[os.path.basename(p)] = dict(windows=len(wins), top15=[(a, round(b, 3)) for a, b in top], music_labels=res)
    best = sorted(((k, v['mean']) for k, v in res.items()), key=lambda x: -x[1])
    print(os.path.basename(p)[:50], '|', ', '.join(f'{k} {v:.2f}' for k, v in best[:14]), flush=True)
json.dump(out, open(sys.argv[1], 'w'), indent=1)
