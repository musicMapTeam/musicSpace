import importlib.util, pathlib, sys
sys.dont_write_bytecode = True
ROOT = pathlib.Path('/Users/alakazan/workplace/tme/musicSpace')
spec = importlib.util.spec_from_file_location('bdf', ROOT / 'scripts/fonts/build-doodle-fonts.py'); bdf = importlib.util.module_from_spec(spec); spec.loader.exec_module(bdf)
ranked = bdf.app_chars(); head = set(bdf.first_screen_chars() + ranked[:300])
for f in ['web/static-runtime/showcase/roster.js', 'web/static-runtime/showcase/about.js', 'web/event-room/app.js']:
  p = ROOT / f
  if not p.exists(): print(f, 'missing'); continue
  s = list(dict.fromkeys(bdf.CJK.findall(p.read_text())))
  extra = [c for c in s if c not in head]
  print(f, len(s), 'extra', len(extra), ''.join(extra[:120]))
