import sys
from fontTools.ttLib import TTFont
from fontTools.pens.recordingPen import RecordingPen
from fontTools.pens.transformPen import TransformPen
from fontTools.pens.ttGlyphPen import TTGlyphPen
from fontTools.pens.reverseContourPen import ReverseContourPen
from PIL import Image, ImageDraw, ImageFont

def contours(gs, name):
  rec = RecordingPen(); gs[name].draw(rec)
  out, cur = [], []
  for op in rec.value:
    cur.append(op)
    if op[0] in ('closePath', 'endPath'): out.append(cur); cur = []
  return out

def replay(ops, pen):
  for op, args in ops: getattr(pen, op)(*args)

def build(variant):
  f = TTFont('/tmp/music-space-font-cache/display.ttf')
  gs = f.getGlyphSet(); cmap = f.getBestCmap(); glyf = f['glyf']; hmtx = f['hmtx']
  ren, ru, ge = cmap[0x4EBA], cmap[0x5165], cmap[0x4E2A]
  # 入 = 人 mirrored about its own centre
  b = glyf[ren]; cx = b.xMin + b.xMax
  pen = TTGlyphPen(gs)
  gs[ren].draw(TransformPen(ReverseContourPen(pen), (-1, 0, 0, 1, cx, 0)))
  g = pen.glyph(); g.recalcBounds(glyf); glyf[ru] = g; hmtx[ru] = (hmtx[ru][0], g.xMin)
  # 个 = 人 squeezed into the roof band + the original stem
  lo, top, stemtop = variant
  pen = TTGlyphPen(gs)
  s = (top - lo) / (814 - (-104))
  gs[ren].draw(TransformPen(pen, (1, 0, 0, s, 0, lo - (-104) * s)))
  stem = contours(gs, ge)[1]
  # stretch the stem's top end to stemtop (only points above 300 move)
  def mv(args):
    return tuple((x, (stemtop if y > 300 else y)) if y is not None else (x, y) for x, y in args)
  replay([(op, mv(args) if args else args) for op, args in stem], pen)
  g = pen.glyph(); g.recalcBounds(glyf); glyf[ge] = g; hmtx[ge] = (hmtx[ge][0], g.xMin)
  # middle dot = bullet
  for t in f['cmap'].tables:
    if t.isUnicode() and 0x2022 in t.cmap: t.cmap[0xB7] = t.cmap[0x2022]
  return f

variants = [(300, 814, 610), (300, 814, 530), (280, 814, 500)]
img = Image.new('RGB', (1500, 260 * len(variants)), 'white'); d = ImageDraw.Draw(img)
for i, v in enumerate(variants):
  f = build(v); path = f'/tmp/space-doodle/final/fonts-work/disp-{i}.ttf'; f.save(path)
  font = ImageFont.truetype(path, 110)
  d.text((10, 10 + i * 260), '进入示例现场 同一个现场', font=font, fill='black')
  d.text((10, 140 + i * 260), f'{v} 交换一个视角 · 3 个视角 招个手 人入几', font=ImageFont.truetype(path, 80), fill='black')
img.save('/tmp/space-doodle/final/fonts-work/compose2.png')
