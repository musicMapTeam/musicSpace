# 2x4 contact sheet of the animatic, frames pulled from the encoded MP4 (what the judges would see), labelled with time, bar:beat and beat.
#   python tools/contact.py <video.mp4> <out.png>
import subprocess, sys, io
from PIL import Image, ImageDraw, ImageFont
video, out = sys.argv[1], sys.argv[2]
BPM = 123.0; BEAT = 60 / BPM; FPS = 60
SHOTS = [('2:1.5', '冷开场 · 真实界面拍上纸面，印章落在军鼓上'), ('4:4.2', '拼贴满屏 · 8 个产品时刻，镜头拉远'),
         ('5:2.6', '停拍 · 标题砸下「同一刻，另一面。」'), ('9:2.9', '痛点 · 只有自己那一面（鼓退出）'),
         ('10:3.7', '转折 · 两张照片换位「换回来？」'), ('11:1.4', 'DROP · 鼓回来，真机首屏砸进画面'),
         ('13:4.4', '真机三维场馆 · 同场角色点名上场'), ('14:3.6', '桌面三维场馆 · 马克笔圈出每个人')]
def frame_at(t):
    raw = subprocess.run(['/opt/homebrew/bin/ffmpeg', '-v', 'error', '-ss', f'{t:.4f}', '-i', video, '-frames:v', '1', '-f', 'image2pipe', '-c:v', 'png', '-'], capture_output=True, check=True).stdout
    return Image.open(io.BytesIO(raw)).convert('RGB')
F = lambda n, s: ImageFont.truetype(f'/tmp/music-space-font-cache/{n}.ttf', s)
CW, CH, PAD, LAB, TOP = 900, 506, 26, 64, 120
W = 4 * CW + 5 * PAD; H = TOP + 2 * (CH + LAB + PAD) + PAD
sheet = Image.new('RGB', (W, H), (247, 239, 223)); d = ImageDraw.Draw(sheet)
for x in range(0, W, 34):
    for y in range(0, H, 34): d.point((x, y), fill=(214, 204, 186))
d.text((PAD, 26), 'MUSIC SPACE · DOODLE ANIMATIC', font=F('logo', 60), fill=(255, 212, 71), stroke_width=3, stroke_fill=(28, 27, 26))
d.text((1180, 40), '冷开场 → 痛点 → DROP 进产品 · 配乐 Wax Lyricist《Flipping In》(CC0) 123 BPM · 28.6 s · 1080p60 · −16 LUFS', font=F('marker', 34), fill=(28, 27, 26))
for i, (bb, label) in enumerate(SHOTS):
    bar, beat = bb.split(':'); t = (int(bar) - 1) * 4 * BEAT + (float(beat) - 1) * BEAT; f = round(t * FPS)
    im = frame_at(f / FPS + 0.0001).resize((CW, CH), Image.LANCZOS)
    r, c = divmod(i, 4); x = PAD + c * (CW + PAD); y = TOP + r * (CH + LAB + PAD)
    sheet.paste(im, (x, y + LAB)); d.rectangle([x - 3, y + LAB - 3, x + CW + 2, y + LAB + CH + 2], outline=(28, 27, 26), width=5)
    d.rounded_rectangle([x, y + 6, x + 230, y + 52], radius=23, fill=(255, 212, 71), outline=(28, 27, 26), width=3)
    d.text((x + 16, y + 10), f'{int(t // 60)}:{t % 60:05.2f}  {bb}', font=F('digits', 32), fill=(28, 27, 26))
    d.text((x + 246, y + 14), label, font=F('marker', 28), fill=(28, 27, 26))
sheet.save(out); print(out, sheet.size)
