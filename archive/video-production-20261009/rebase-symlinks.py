"""Rebase preserved links to recovered roots. Usage: python3 rebase-symlinks.py EXTRACTED MUSICSPACE_CHECKOUT"""
import json,os,pathlib,sys
root=pathlib.Path(sys.argv[1]).resolve();code=pathlib.Path(sys.argv[2]).resolve();manifest=json.load(open(pathlib.Path(__file__).with_name('manifest.json')))
oldcode='/Users/alakazan/workplace/tme/musicSpace';aliases=manifest['archive_root_aliases'];rewritten=0;pending=[]
def normalize(p):return '/private'+p if p.startswith('/tmp/') else p
for e in manifest['files']:
 if e['type']!='symlink':continue
 p=root/e['archive_path'];old=e['symlink_target']
 if not os.path.isabs(old):continue
 normalized=normalize(old);new=None
 for prefix,alias in sorted(aliases.items(),key=lambda kv:len(kv[0]),reverse=True):
  prefix=normalize(prefix)
  if normalized==prefix or normalized.startswith(prefix+'/'):new=root/alias/normalized[len(prefix):].lstrip('/');break
 if new is None and (normalized==oldcode or normalized.startswith(oldcode+'/')):new=code/normalized[len(oldcode):].lstrip('/')
 if new is None:raise RuntimeError('Unmapped original symlink target: '+str(p))
 if not p.is_symlink() or os.readlink(p)!=old:raise RuntimeError('Expected untouched recovered link: '+str(p))
 relative=os.path.relpath(new,p.parent);p.unlink();p.symlink_to(relative);rewritten+=1
 if not new.exists():pending.append(str(new))
print('Rebased links:',rewritten)
if pending:print('Targets requiring documented dependency install/build:',len(set(pending)))
