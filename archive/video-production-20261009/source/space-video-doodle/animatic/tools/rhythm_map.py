# Rhythm map of a doodle-motion scene: music grid + sections, every visual event, every SFX cue, every line of text, and the mix
# waveform on one time axis.   python tools/rhythm_map.py <scene.info.json> <mix.wav> <out.png>
import json, subprocess, sys, numpy as np
from PIL import Image, ImageDraw, ImageFont
info = json.load(open(sys.argv[1])); wav = sys.argv[2]; out = sys.argv[3]
FONT = lambda n, s: ImageFont.truetype(f'/tmp/music-space-font-cache/{n}.ttf', s)
INK, PAPER, PINK, MINT, YEL, GREY = (28, 27, 26), (247, 239, 223), (255, 92, 138), (95, 220, 192), (255, 212, 71), (107, 101, 92)
W, L, R = 2600, 230, 40; dur = info['duration']; beat = 60 / info['bpm']; bar = 4 * beat
X = lambda t: L + (W - L - R) * t / dur
rows = {'music': 150, 'picture': 235, 'grid': 320, 'events': 395, 'sfx': 520, 'text': 610, 'wave': 900}
H = 1080; im = Image.new('RGB', (W, H), PAPER); d = ImageDraw.Draw(im)
for x in range(0, W, 34):
    for y in range(0, H, 34): d.point((x, y), fill=(215, 205, 188))
d.text((40, 24), 'ANIMATIC RHYTHM MAP', font=FONT('logo', 54), fill=YEL, stroke_width=3, stroke_fill=INK)
d.text((760, 36), f"Flipping In (Wax Lyricist, CC0) · {info['bpm']:.0f} BPM · bar {bar:.3f} s · {dur:.2f} s · {len(info['events'])} visual events · {len(info['cues'])} sound cues",
       font=FONT('marker', 28), fill=INK)
for name, y in rows.items():
    d.text((40, y - 6), {'music': '音乐段落', 'picture': '画面段落', 'grid': '小节 / 拍', 'events': '画面事件', 'sfx': '音效', 'text': '文字', 'wave': '混音波形'}[name], font=FONT('marker', 30), fill=INK)
def block(y, t0, t1, label, col, h=54):
    d.rounded_rectangle([X(t0) + 2, y - h // 2, X(t1) - 2, y + h // 2], radius=12, fill=col, outline=INK, width=3)
    d.text((X(t0) + 12, y - 16), label, font=FONT('marker', 24), fill=INK)
B = lambda b, bt=1: (b - 1) * bar + (bt - 1) * beat
for t0, t1, lab, c in [(0, B(5), 'FI 57-60 · groove (kick 1&3, snare 2&4)', YEL), (B(5), B(7), 'FI 61-62 · stop', (255, 208, 221)), (B(7), B(11), 'FI 71-74 · bass, no drums', (201, 243, 232)),
                       (B(11), B(15), 'FI 75-78 · drums back = DROP', MINT), (B(15), dur, 'FI 79 · out', (255, 240, 184))]: block(rows['music'], t0, t1, lab, c)
for t0, t1, lab, c in [(0, B(5), 'H1 collage: 8 real UI moments', (255, 240, 184)), (B(5), B(7), 'H2 title', (255, 208, 221)), (B(7), B(11), 'P pain: only your own side', (240, 232, 214)),
                       (B(11), B(14), 'E1 phone: real build', (201, 243, 232)), (B(14), B(15), 'E4 3D room', MINT), (B(15), dur, 'button', YEL)]: block(rows['picture'], t0, t1, lab, c)
y = rows['grid']
for i in range(int(dur / beat) + 1):
    t = i * beat; x = X(t); major = i % 4 == 0
    d.line([x, y - (26 if major else 12), x, y + (26 if major else 12)], fill=INK if major else GREY, width=4 if major else 2)
    if major: d.text((x + 6, y - 40), str(i // 4 + 1), font=FONT('digits', 26), fill=INK)
KIND = {'slam': PINK, 'pop': YEL, 'stamp': (31, 159, 131), 'slap': (116, 185, 255), 'draw': INK, 'swipe': MINT, 'type': (61, 58, 54), 'cut': INK, 'wipe': PINK, 'tap': YEL, 'confetti': PINK, 'grow': YEL, 'rise': PINK, 'slide': GREY, 'none': GREY, 'fade': GREY}
lanes = {}
for e in info['events']:
    k = e['label'].split(' ')[0]; lane = lanes.setdefault(k, len(lanes)); col = KIND.get(k, GREY); x = X(e['t']); yy = rows['events'] - 40 + (lane % 6) * 18
    d.ellipse([x - 7, yy - 7, x + 7, yy + 7], fill=col, outline=INK, width=2)
lx = L
for k, lane in lanes.items():
    d.ellipse([lx, rows['events'] + 72, lx + 14, rows['events'] + 86], fill=KIND.get(k, GREY), outline=INK, width=2); d.text((lx + 20, rows['events'] + 66), k, font=FONT('marker', 20), fill=INK); lx += 30 + len(k) * 12
SC = {'slap': (116, 185, 255), 'stamp': (31, 159, 131), 'impact': PINK, 'boom': PINK, 'pop': YEL, 'squeak': GREY, 'whoosh': MINT, 'swap': PINK, 'heart': PINK, 'click': INK, 'riser': MINT}
for c in info['cues']:
    x = X(c['t']); col = SC.get(c['kind'], GREY); hgt = 18 + max(0, 12 + c['gain']) * 1.5
    d.line([x, rows['sfx'] + 20, x, rows['sfx'] + 20 - hgt], fill=col, width=5)
d.text((L, rows['sfx'] + 30), 'slap · stamp · impact/boom · pop · squeak · whoosh · swap · riser — all synthesized, 8-14 dB under the music', font=FONT('marker', 20), fill=GREY)
rowsT = []; y0 = rows['text'] - 10
for tx in sorted(info.get('texts', []), key=lambda t: t['t0']):
    lane = next((i for i, end in enumerate(rowsT) if end <= tx['t0'] - 0.05), None)
    if lane is None: lane = len(rowsT); rowsT.append(0)
    rowsT[lane] = tx['t1']; yy = y0 + lane * 44
    d.rounded_rectangle([X(tx['t0']), yy, max(X(tx['t1']), X(tx['t0']) + 30), yy + 36], radius=8, fill=(255, 250, 240), outline=INK, width=2)
    d.text((X(tx['t0']) + 8, yy + 4), tx['text'], font=FONT('marker', 24), fill=INK)
raw = subprocess.run(['/opt/homebrew/bin/ffmpeg', '-v', 'error', '-i', wav, '-ac', '1', '-ar', '4800', '-f', 'f32le', '-'], capture_output=True).stdout
a = np.frombuffer(raw, np.float32); n = W - L - R; seg = len(a) / n; yc = rows['wave'] + 60
for i in range(n):
    s = a[int(i * seg):int((i + 1) * seg)]
    if len(s): v = float(np.sqrt(np.mean(s ** 2))); p = float(np.abs(s).max()); d.line([L + i, yc - p * 120, L + i, yc + p * 120], fill=(200, 190, 175)); d.line([L + i, yc - v * 240, L + i, yc + v * 240], fill=PINK)
for i in range(int(dur / bar) + 1): d.line([X(i * bar), rows['wave'] - 60, X(i * bar), rows['wave'] + 180], fill=(120, 110, 100), width=1)
im.save(out); print(out, im.size)
