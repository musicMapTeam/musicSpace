from fontTools.ttLib import TTFont
from fontTools.pens.ttGlyphPen import TTGlyphPen
from fontTools.pens.filterPen import FilterPen
from PIL import Image, ImageDraw, ImageFont

class Shear(FilterPen):
  def __init__(self, out, y0, k): super().__init__(out); self.y0, self.k = y0, k
  def t(self, p): x, y = p; return (round(x - self.k * (y - self.y0)) if y > self.y0 else x, y)
  def moveTo(self, p): self._outPen.moveTo(self.t(p))
  def lineTo(self, p): self._outPen.lineTo(self.t(p))
  def qCurveTo(self, *ps): self._outPen.qCurveTo(*[self.t(p) if p is not None else None for p in ps])
  def curveTo(self, *ps): self._outPen.curveTo(*[self.t(p) for p in ps])

img = Image.new('RGB', (1500, 900), 'white'); d = ImageDraw.Draw(img)
for i, (y0, k) in enumerate([(510, .36), (480, .45), (540, .30)]):
  f = TTFont('/tmp/space-doodle/final/fonts-work/disp-0.ttf'); gs = f.getGlyphSet(); c = f.getBestCmap(); glyf = f['glyf']
  pen = TTGlyphPen(gs); gs[c[0x4EBA]].draw(Shear(pen, y0, k)); g = pen.glyph(); g.recalcBounds(glyf)
  glyf[c[0x5165]] = g; f['hmtx'][c[0x5165]] = (f['hmtx'][c[0x5165]][0], g.xMin)
  p = f'/tmp/space-doodle/final/fonts-work/ru-{i}.ttf'; f.save(p)
  d.text((10, 10 + i * 300), '人入个几', font=ImageFont.truetype(p, 160), fill='black')
  d.text((720, 40 + i * 300), f'进入示例现场', font=ImageFont.truetype(p, 90), fill='black')
  d.text((720, 160 + i * 300), f'{y0} {k} 先进入现场', font=ImageFont.truetype(p, 60), fill='black')
img.save('/tmp/space-doodle/final/fonts-work/ru.png')
