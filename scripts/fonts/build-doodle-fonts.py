#!/usr/bin/env python3
"""Build the hand-drawn ("Doodle") web fonts for the event room.

Dev-time tool, not part of `npm run build`: needs Python 3 with `pip install fonttools brotli`.
Its outputs are committed:
  web/event-room/public/fonts/doodle/*.woff2   subset + sliced + renamed fonts
  web/event-room/public/fonts/doodle/fonts.css @font-face rules (unicode-range slices)
  web/event-room/public/fonts/doodle/LICENSES.txt

Re-run it after adding UI text with new characters; a character missing from a slice falls back to the
next font in the CSS stack (the system font), it never shows as tofu.

Slicing: slice 0 of a family carries every character of the first screens (FIRST_SCREEN: loading screen,
landing card, join sheet, route card), the 300 most frequent app characters, punctuation, and only those
symbols the app actually uses; slices 1-3 follow the frequency ranking, slice 4 the rest of GB2312 level 1
for text people type. Doodle Note only carries NOTE_PHRASES. Doodle Marker lacks a few marks the UI puts in
marker-lettered controls (↗ ✓ ♡ ♫ ✦ ...): they are borrowed from Yozai (Doodle Hand) as one more Doodle
Marker face, marker-symbols.woff2. Doodle Display gets three glyph fixes, see fix_display().

Every upstream font is SIL OFL 1.1 or Apache 2.0. Subsetting is a modification, and Smiley Sans reserves
its names, so every output is renamed to a neutral "Doodle *" family; copyright and license texts are kept.
Downloads (fonts and license texts) are pinned or cached in DOODLE_FONT_CACHE, so a re-run works offline.
"""
import hashlib, io, os, pathlib, re, sys, unicodedata, urllib.request, zipfile
from collections import Counter
from fontTools import subset
from fontTools.pens.filterPen import FilterPen
from fontTools.pens.recordingPen import RecordingPen
from fontTools.pens.transformPen import TransformPen
from fontTools.pens.ttGlyphPen import TTGlyphPen
from fontTools.ttLib import TTFont

ROOT = pathlib.Path(__file__).resolve().parents[2]
OUT = ROOT / 'web/event-room/public/fonts/doodle'
CACHE = pathlib.Path(os.environ.get('DOODLE_FONT_CACHE', '/tmp/music-space-font-cache'))

GF = 'https://github.com/google/fonts/raw/main'
SOURCES = {
  # role: CSS family, upstream, file url (zip member), sha256 of the TTF, slicing
  'display': dict(family='Doodle Display', upstream='ZCOOL QingKe HuangYou 1.000 (OFL-1.1)', license='OFL',
                  url=f'{GF}/ofl/zcoolqingkehuangyou/ZCOOLQingKeHuangYou-Regular.ttf',
                  sha256='54f0c0df4308cd74cd0f2fd3494ae054dbc4a1fd6fa7d71f4807eb4cdd8b4136', slices='app'),
  'marker': dict(family='Doodle Marker', upstream='LXGW Marker Gothic 1.003 (OFL-1.1)', license='OFL',
                 url='https://github.com/lxgw/LxgwMarkerGothic/releases/download/v1.003/LxgwMarkerGothic-v1.003.zip',
                 member='LxgwMarkerGothic-v1.003/fonts/ttf/LXGWMarkerGothic-Regular.ttf',
                 sha256='9a1e46379442856b9fc64de1d9bd4120903780990e28d99fd6415cadee78a47d', slices='app+ext',
                 borrow='hand'),
  'hand': dict(family='Doodle Hand', upstream='Yozai Medium 0.868 (OFL-1.1)', license='OFL',
               url='https://github.com/lxgw/yozai-font/releases/download/v0.868/Yozai-Medium.ttf',
               sha256='05f50f252b45197d0d6148a4abc3e37c7cd4cfdf03c955b57c25d53d924f835f', slices='app+ext'),
  'note': dict(family='Doodle Note', upstream='Long Cang 2.001 (OFL-1.1)', license='OFL',
               url=f'{GF}/ofl/longcang/LongCang-Regular.ttf',
               sha256='e5bf2c3f24ef2327c6f136d8f73e2f9dfdf44896fdbeb35a9515f44777bb91bc', slices='note'),
  'logo': dict(family='Doodle Logo', upstream='Luckiest Guy 1.001 (Apache-2.0)', license='Apache',
               url=f'{GF}/apache/luckiestguy/LuckiestGuy-Regular.ttf',
               sha256='cfbdd68a039f92df51cf3721506af6242e64594c6325fe0bedbeff3fe385d980', slices='latin'),
  'digits': dict(family='Doodle Digits', upstream='Smiley Sans Oblique 2.0.1 (OFL-1.1, RFN "Smiley"/"得意黑" — renamed)', license='OFL',
                 url='https://github.com/atelier-anchor/smiley-sans/releases/download/v2.0.1/smiley-sans-v2.0.1.zip',
                 member='SmileySans-Oblique.ttf',
                 sha256='b447d7e781f08bc95c4c9f23ba71ed2b8ebb639aa7184485c71c4ca5afcd25c4', slices='latin'),
}
LICENSE_URLS = {
  'display': f'{GF}/ofl/zcoolqingkehuangyou/OFL.txt',
  'marker': 'https://raw.githubusercontent.com/lxgw/LxgwMarkerGothic/main/OFL.txt',
  'hand': 'https://raw.githubusercontent.com/lxgw/yozai-font/master/OFL.txt',
  'note': f'{GF}/ofl/longcang/OFL.txt',
  'logo': f'{GF}/apache/luckiestguy/LICENSE.txt',
  'digits': 'https://raw.githubusercontent.com/atelier-anchor/smiley-sans/main/LICENSE',
}
# Hand-written margin notes ("Doodle Note") only carry these characters; add a new note phrase here first.
NOTE_PHRASES = '就是这一刻！同一刻另一面你在这儿我在台下嘿这晚真好交换视角再来一首安可哇好近好远看这里散场后别走留下来新朋友说你好'
# What a visitor sees before any panel has a reason to pull a second slice: the page shell (loading screen, header,
# landing card, nav, footer, desktop caption), the static site's landing words, its join sheet (with the default
# nickname), route card and cast names, plus the few words app.js writes into the shell before anyone joins.
FIRST_SCREEN = ['web/event-room/index.html', 'web/static-runtime/showcase/copy.js',
                'web/static-runtime/showcase/entry-panel.js', 'web/static-runtime/showcase/demo-hooks.js',
                'web/static-runtime/showcase/tour.js', 'web/static-runtime/showcase/roster.js']
FIRST_SCREEN_TEXT = '这一晚的歌，进入房间，留下你看到的那个瞬间'
# Latin and punctuation for text people type (names, chat, song titles); slice 0 of every family carries them in full.
# Other symbols (arrows, stars, dingbats, fullwidth letters) only when the app's own sources use them: used_symbols().
LATIN = [(0x20, 0x7E), (0xA0, 0xFF), (0x2010, 0x2027), (0x2030, 0x203B)]
PUNCT = LATIN + [(0x3000, 0x3011), (0x3014, 0x301F), (0xFF01, 0xFF0F), (0xFF1A, 0xFF20), (0xFF3B, 0xFF40), (0xFF5B, 0xFF65)]
SCAN_DIRS = ['web', 'runtime-preview/src', 'server', 'src']
SKIP = {'node_modules', 'dist', 'dist-pages', 'vendor', 'public', '.git'}
CJK = re.compile('[㐀-䶿一-鿿豈-﫿]')
CUTS = [300, 700, 1200]  # frequency ranks where the app slices split


def fetch(key, src):
  CACHE.mkdir(parents=True, exist_ok=True)
  target = CACHE / f'{key}.ttf'
  if not target.exists() or hashlib.sha256(target.read_bytes()).hexdigest() != src['sha256']:
    print('download', src['url'])
    data = urllib.request.urlopen(src['url'], timeout=300).read()
    if src.get('member'):
      data = zipfile.ZipFile(io.BytesIO(data)).read(src['member'])
    target.write_bytes(data)
  digest = hashlib.sha256(target.read_bytes()).hexdigest()
  if digest != src['sha256']:
    sys.exit(f'{key}: sha256 mismatch {digest}')
  return target


def license_text(key, family, previous):
  """The upstream license text, cached; offline, the copy an earlier run wrote into LICENSES.txt is reused."""
  cached = CACHE / f'{key}-license.txt'
  if not cached.exists():
    try:
      text = urllib.request.urlopen(LICENSE_URLS[key], timeout=60).read().decode('utf-8')
    except OSError as error:
      match = re.search(rf'^===== {re.escape(family)} — [^\n]*=====\n(?:NOTE: [^\n]*\n(?:[^\n]+\n)*\n)?(.*?)(?=^===== |\Z)',
                        previous, re.S | re.M)
      if not match:
        sys.exit(f'{key}: cannot download {LICENSE_URLS[key]} ({error}); save it as {cached}')
      text = match.group(1)
    cached.write_text(text.strip() + '\n')
  return cached.read_text().strip()


def scanned_files():
  for base in SCAN_DIRS:
    for path in (ROOT / base).rglob('*'):
      if path.is_file() and not SKIP & set(path.relative_to(ROOT).parts) and path.suffix in ('.js', '.mjs', '.html', '.css', '.json'):
        yield path


def app_chars():
  count = Counter()
  for path in scanned_files():
    count.update(CJK.findall(path.read_text(errors='ignore')))
  return [c for c, _ in count.most_common()]


def used_symbols():
  """Every non-CJK, non-ASCII code point the app sources contain (arrows, hearts, stars, fullwidth letters ...)."""
  points = set()
  for path in scanned_files():
    for ch in set(path.read_text(errors='ignore')):
      if ord(ch) > 0x7E and not CJK.match(ch) and unicodedata.category(ch)[0] not in 'CMZ':
        points.add(ord(ch))
  return sorted(points)


def first_screen_chars():
  text = ''.join((ROOT / name).read_text() for name in FIRST_SCREEN) + FIRST_SCREEN_TEXT
  return list(dict.fromkeys(CJK.findall(text)))


def gb2312_level1():
  chars = []
  for hi in range(0xB0, 0xD8):
    for lo in range(0xA1, 0xFF):
      try:
        chars.append(bytes([hi, lo]).decode('gb2312'))
      except UnicodeDecodeError:
        pass
  return chars


def ranges_to_points(ranges):
  return [cp for a, b in ranges for cp in range(a, b + 1)]


def unicode_range(points):
  points = sorted(set(points))
  out, i = [], 0
  while i < len(points):
    j = i
    while j + 1 < len(points) and points[j + 1] == points[j] + 1:
      j += 1
    out.append(f'U+{points[i]:X}' if i == j else f'U+{points[i]:X}-{points[j]:X}')
    i = j + 1
  return ','.join(out)


def rename(font, family):
  name = font['name']
  ps = family.replace(' ', '')
  for rec in list(name.names):
    if rec.nameID in (1, 3, 4, 6, 16, 17, 18, 21, 22):
      name.removeNames(nameID=rec.nameID)
  for nid, value in ((1, family), (2, 'Regular'), (3, f'{ps}-Regular;subset'), (4, family), (6, f'{ps}-Regular')):
    name.setName(value, nid, 3, 1, 0x409)
    name.setName(value, nid, 1, 0, 0)


class _Shear(FilterPen):
  """Moves every point above y0 left by k per unit of height (a shear of the upper part only)."""
  def __init__(self, out, y0, k):
    super().__init__(out)
    self.y0, self.k = y0, k

  def _t(self, pt):
    if pt is None:
      return None
    x, y = pt
    return (round(x - self.k * (y - self.y0)), y) if y > self.y0 else (x, y)

  def moveTo(self, pt): self._outPen.moveTo(self._t(pt))
  def lineTo(self, pt): self._outPen.lineTo(self._t(pt))
  def qCurveTo(self, *pts): self._outPen.qCurveTo(*map(self._t, pts))
  def curveTo(self, *pts): self._outPen.curveTo(*map(self._t, pts))


def fix_display(font):
  """ZCOOL QingKe HuangYou draws 入 with the same outline as 几 (「进入示例现场」 read 「进几示例现场」), draws 个 as a
  roofed stem that reads 卜/丫 at heading size, and has no middle dot (titles fell back to Doodle Marker's speck).
  Each is rebuilt from the font's own strokes: 入 = its 人 with the head leaning left so it runs on into the right-hand
  stroke; 个 = its 人 squeezed into the upper part over its own stem; · = its bullet."""
  glyf, hmtx, cmap = font['glyf'], font['hmtx'], font.getBestCmap()
  glyphs = font.getGlyphSet()
  ren, ru, ge = cmap[0x4EBA], cmap[0x5165], cmap[0x4E2A]
  assert glyf[ren].numberOfContours == 1 and glyf[ge].numberOfContours == 2, 'display: unexpected 人/个 outlines'

  def store(name, pen):
    glyph = pen.glyph()
    glyph.recalcBounds(glyf)
    glyf[name] = glyph
    hmtx[name] = (hmtx[name][0], glyph.xMin)

  # 入: the legs part at y=510 with a slope of 0.36; the head continues the right leg's line.
  pen = TTGlyphPen(glyphs)
  glyphs[ren].draw(_Shear(pen, 510, 0.36))
  store(ru, pen)
  # 个: 人 scaled into y 300..814 (the roof band of the original) plus the original stem, topped just under the fork.
  record = RecordingPen()
  glyphs[ge].draw(record)
  contours, current = [], []
  for op, args in record.value:
    current.append((op, args))
    if op in ('closePath', 'endPath'):
      contours.append(current)
      current = []
  def width(contour):
    xs = [pt[0] for _, args in contour for pt in args if pt]
    return max(xs) - min(xs)
  stem = min(contours, key=width)  # the roof spans the glyph, the stem is one stroke wide
  pen = TTGlyphPen(glyphs)
  low, top, bottom = 300, 814, -104
  scale = (top - low) / (top - bottom)
  glyphs[ren].draw(TransformPen(pen, (1, 0, 0, scale, 0, low - bottom * scale)))
  lower = lambda pt: pt if pt is None or pt[1] <= low else (pt[0], pt[1] - 80)  # stem top 610 -> 530, under the fork
  for op, args in stem:
    getattr(pen, op)(*map(lower, args))
  store(ge, pen)
  # ·: same glyph as the bullet (U+2022), centred at x-height like a middle dot should be.
  for table in font['cmap'].tables:
    if table.isUnicode() and 0x2022 in table.cmap:
      table.cmap[0xB7] = table.cmap[0x2022]


def match_vertical_metrics(font, reference):
  """A borrowed face must not change line boxes: it takes the vertical metrics of the family it joins."""
  for attr in ('ascent', 'descent', 'lineGap'):
    setattr(font['hhea'], attr, getattr(reference['hhea'], attr))
  for attr in ('sTypoAscender', 'sTypoDescender', 'sTypoLineGap', 'usWinAscent', 'usWinDescent'):
    setattr(font['OS/2'], attr, getattr(reference['OS/2'], attr))
  font['OS/2'].fsSelection = (font['OS/2'].fsSelection & ~(1 << 7)) | (reference['OS/2'].fsSelection & (1 << 7))


def build_slice(font_path, family, points, out_path, prepare=None, metrics=None):
  font = TTFont(font_path)
  if prepare:
    prepare(font)
  cmap = font.getBestCmap()
  present = [cp for cp in dict.fromkeys(points) if cp in cmap]
  if not present:
    return []
  options = subset.Options()
  options.flavor = 'woff2'
  options.layout_features = ['*']
  options.name_IDs = ['*']
  options.name_languages = ['*']
  options.notdef_outline = True
  options.drop_tables += ['DSIG']
  sub = subset.Subsetter(options)
  sub.populate(unicodes=present)
  sub.subset(font)
  rename(font, family)
  if metrics is not None:
    match_vertical_metrics(font, metrics)
  font.flavor = 'woff2'
  font.save(out_path)
  return present


def main():
  ranked = app_chars()
  first = first_screen_chars()
  head = list(dict.fromkeys(first + ranked[:CUTS[0]]))
  rest = [c for c in ranked if c not in set(head)]
  slices_app = [head, rest[:CUTS[1] - CUTS[0]], rest[CUTS[1] - CUTS[0]:CUTS[2] - CUTS[0]], rest[CUTS[2] - CUTS[0]:]]
  app_set = set(ranked)
  ext = [c for c in gb2312_level1() if c not in app_set]
  symbols = used_symbols()
  base = list(dict.fromkeys(ranges_to_points(PUNCT) + symbols))
  previous = (OUT / 'LICENSES.txt').read_text() if (OUT / 'LICENSES.txt').exists() else ''
  OUT.mkdir(parents=True, exist_ok=True)
  for old in OUT.glob('*.woff2'):
    old.unlink()
  css = ['/* Generated by scripts/fonts/build-doodle-fonts.py. Do not edit by hand. */',
         '/* Families are role names, so a font can be swapped in the script without touching other CSS. */']
  report, licenses, borrowed = [], [], {}
  paths = {key: fetch(key, src) for key, src in SOURCES.items()}
  for key, src in SOURCES.items():
    path = paths[key]
    if src['slices'] == 'latin':
      plan = [ranges_to_points(LATIN)]
    elif src['slices'] == 'note':
      plan = [[ord(c) for c in NOTE_PHRASES]]
    else:
      plan = [base + [ord(c) for c in slices_app[0]]] + [[ord(c) for c in s] for s in slices_app[1:]]
      if src['slices'] == 'app+ext':
        plan.append([ord(c) for c in ext])
    prepare = fix_display if key == 'display' else None
    total, first_bytes = 0, 0
    files = [(f'{key}-{index}.woff2', path, src['family'], points, prepare, None) for index, points in enumerate(plan)]
    if src.get('borrow'):
      own = TTFont(path).getBestCmap()
      lender = SOURCES[src['borrow']]
      lent = [cp for cp in symbols if cp not in own and cp in TTFont(paths[src['borrow']]).getBestCmap()]
      borrowed[src['borrow']] = (src['family'], f'{key}-symbols.woff2', lent)
      files.append((f'{key}-symbols.woff2', paths[src['borrow']], lender['family'], lent, None, TTFont(path)))
    for name, font_path, internal, points, prep, metrics in files:
      out = OUT / name
      present = build_slice(font_path, internal, points, out, prep, metrics)
      if not present:
        continue
      size = out.stat().st_size
      total += size
      if name.endswith('-0.woff2') or name.endswith('-symbols.woff2'):
        first_bytes += size
      css.append(f'@font-face{{font-family:"{src["family"]}";src:url("./{out.name}") format("woff2");'
                 f'font-display:swap;unicode-range:{unicode_range(present)}}}')
      report.append(f'{out.name:20s} {len(present):5d} code points {size / 1024:7.1f} KB')
    report.append(f'  {src["family"]}: {total / 1024:.0f} KB in all, first screen (slice 0) {first_bytes / 1024:.0f} KB')
    note = ''
    if key == 'display':
      note = ('NOTE: local changes besides subsetting and renaming: the outlines of 入 (U+5165) and 个 (U+4E2A) are\n'
              'redrawn from this font\'s own 人 (and the stem of its 个), and U+00B7 is mapped to its bullet glyph.\n\n')
    if key in borrowed:
      family, filename, lent = borrowed[key]
      note = f'NOTE: {filename} (served as part of {family}) is also a subset of this font: {"".join(map(chr, lent))}\n\n'
    licenses.append(f'===== {src["family"]} — derived (subset, renamed) from {src["upstream"]} =====\n{note}'
                    f'{license_text(key, src["family"], previous)}\n')
  (OUT / 'fonts.css').write_text('\n'.join(css) + '\n')
  (OUT / 'LICENSES.txt').write_text('Doodle web fonts used by Music Space. Each file is a subset of the upstream font,\n'
                                    'renamed to a neutral family name. Upstream licenses follow.\n\n' + '\n'.join(licenses))
  print('\n'.join(report))
  print(f'app characters: {len(ranked)}, first screen: {len(first)} ({len([c for c in first if c not in ranked[:CUTS[0]]])} '
        f'beyond the top {CUTS[0]}), extension (GB2312 level 1 not in app): {len(ext)}, symbols used: {len(symbols)}')


if __name__ == '__main__':
  main()
