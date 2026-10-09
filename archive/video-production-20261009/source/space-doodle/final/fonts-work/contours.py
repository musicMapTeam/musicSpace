from fontTools.ttLib import TTFont
from fontTools.pens.recordingPen import RecordingPen
f = TTFont('/tmp/music-space-font-cache/display.ttf'); gs = f.getGlyphSet(); cmap = f.getBestCmap()
for ch in '个人':
  g = f['glyf'][cmap[ord(ch)]]
  coords, ends, flags = g.getCoordinates(f['glyf'])
  start = 0
  for ci, end in enumerate(g.endPtsOfContours):
    pts = coords[start:end+1]
    xs = [p[0] for p in pts]; ys = [p[1] for p in pts]
    print(ch, 'contour', ci, 'npts', len(pts), 'bbox', (min(xs), min(ys), max(xs), max(ys)))
    start = end + 1
