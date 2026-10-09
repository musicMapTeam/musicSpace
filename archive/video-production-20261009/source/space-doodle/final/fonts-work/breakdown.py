import importlib.util, pathlib, sys, io
sys.dont_write_bytecode = True
ROOT = pathlib.Path('/Users/alakazan/workplace/tme/musicSpace')
spec = importlib.util.spec_from_file_location('bdf', ROOT / 'scripts/fonts/build-doodle-fonts.py'); bdf = importlib.util.module_from_spec(spec); spec.loader.exec_module(bdf)
from fontTools.ttLib import TTFont
def size(key, points):
  out = pathlib.Path(f'/tmp/space-doodle/final/fonts-work/tmp-{key}.woff2')
  p = bdf.build_slice(f'/tmp/music-space-font-cache/{key}.ttf', 'X', points, out, bdf.fix_display if key == 'display' else None)
  return len(p), out.stat().st_size / 1024 if p else 0
ranked = bdf.app_chars(); first = bdf.first_screen_chars(); head = list(dict.fromkeys(first + ranked[:300]))
syms = bdf.used_symbols()
groups = {
 'ascii': bdf.ranges_to_points([(0x20, 0x7E)]),
 'latin1': bdf.ranges_to_points([(0xA0, 0xFF)]),
 'genpunct': bdf.ranges_to_points([(0x2010, 0x2027), (0x2030, 0x205E)]),
 'cjkpunct': bdf.ranges_to_points([(0x3000, 0x303F)]),
 'fwpunct': bdf.ranges_to_points([(0xFF01, 0xFF0F), (0xFF1A, 0xFF20), (0xFF3B, 0xFF40), (0xFF5B, 0xFF65)]),
 'symbols': syms,
 'cjk-head': [ord(c) for c in head],
}
for key in ['hand', 'display', 'marker']:
  print(key, {g: tuple(round(v, 1) for v in size(key, pts)) for g, pts in groups.items()})
print(''.join(map(chr, syms)))
