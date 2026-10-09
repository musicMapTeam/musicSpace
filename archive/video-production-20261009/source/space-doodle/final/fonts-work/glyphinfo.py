from fontTools.ttLib import TTFont
from fontTools.pens.recordingPen import RecordingPen
from fontTools.pens.boundsPen import BoundsPen
for key in ['display','marker','hand','note']:
  f = TTFont(f'/tmp/music-space-font-cache/{key}.ttf')
  print(key, 'tables', sorted(f.keys()), 'upm', f['head'].unitsPerEm, 'asc', f['hhea'].ascent, 'desc', f['hhea'].descent, 'OS2', f['OS/2'].sTypoAscender, f['OS/2'].sTypoDescender, f['OS/2'].usWinAscent, f['OS/2'].usWinDescent)
f = TTFont('/tmp/music-space-font-cache/display.ttf')
cmap = f.getBestCmap(); gs = f.getGlyphSet()
for ch in '个人入几丨十中.·•。，木':
  cp = ord(ch); g = cmap.get(cp)
  if not g: print(ch, 'missing'); continue
  bp = BoundsPen(gs); gs[g].draw(bp)
  glyph = f['glyf'][g]
  print(ch, g, 'contours', glyph.numberOfContours, 'bounds', bp.bounds, 'adv', f['hmtx'][g], 'prog', len(glyph.program.getBytecode()) if hasattr(glyph,'program') and glyph.program else 0)
