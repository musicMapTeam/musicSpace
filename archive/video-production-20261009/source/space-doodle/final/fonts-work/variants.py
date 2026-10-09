import importlib.util, pathlib, sys
sys.dont_write_bytecode = True
ROOT = pathlib.Path('/Users/alakazan/workplace/tme/musicSpace')
spec = importlib.util.spec_from_file_location('bdf', ROOT / 'scripts/fonts/build-doodle-fonts.py'); bdf = importlib.util.module_from_spec(spec); spec.loader.exec_module(bdf)
ranked = bdf.app_chars(); top = ranked[:300]; topset = set(top)
def chars(files):
  t = ''.join((ROOT / f).read_text() for f in files); return list(dict.fromkeys(bdf.CJK.findall(t)))
A = chars(['web/event-room/index.html', 'web/static-runtime/showcase/copy.js'])
B = chars(['web/static-runtime/showcase/entry-panel.js'])
C = chars(['web/static-runtime/showcase/tour.js'])
a = [c for c in A if c not in topset]; b = [c for c in B if c not in topset and c not in set(A)]; c_ = [c for c in C if c not in topset and c not in set(A) and c not in set(B)]
print('index+copy beyond top300:', len(a), ''.join(a)); print('entry-panel extra:', len(b), ''.join(b)); print('tour extra:', len(c_), ''.join(c_))
rank = {ch: i for i, ch in enumerate(ranked)}
print('ranks entry extra:', sorted(rank[x] for x in b)); print('ranks tour extra:', sorted(rank[x] for x in c_))
