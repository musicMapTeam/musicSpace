from PIL import Image, ImageDraw, ImageFont
import sys
lines = [('display','进入示例现场 / 进几示例现场'),('display','入 几 人 个 丫 卜 介 全 八 · • ・ 。'),('display','同一个现场 交换一个视角 招个手'),('marker','进入示例现场 同一个现场 ↗ ✓ ♡'),('hand','入 个 ↗ ✓ ♡ ♫ ✦ ✧ ☾ · • → ↩'),('note','就是这一刻！')]
W,H = 1500, 130*len(lines)
img = Image.new('RGB',(W,H),'white'); d = ImageDraw.Draw(img)
for i,(k,t) in enumerate(lines):
  f = ImageFont.truetype(f'/tmp/music-space-font-cache/{k}.ttf', 80)
  d.text((20, 20+i*130), t, font=f, fill='black')
img.save('/tmp/space-doodle/final/fonts-work/glyphs.png')
