"""Verify restored content without following symlinks. Usage: python3 verify-restored.py /path/to/extracted"""
import sys,json,pathlib,hashlib,os,stat
root=pathlib.Path(sys.argv[1]).resolve();manifest=json.load(open(pathlib.Path(__file__).with_name('manifest.json')));checked=0
for e in manifest['files']:
 p=root/e['archive_path']
 if e['type']=='symlink':
  assert p.is_symlink() and os.readlink(p)==e['symlink_target'],str(p)
 elif e['type']=='regular':
  assert stat.S_ISREG(os.lstat(p).st_mode),str(p)
  assert p.stat().st_size==e['logicalbytes'],str(p)
  h=hashlib.sha256()
  with open(p,'rb') as f:
   for b in iter(lambda:f.read(4194304),b''):h.update(b)
  assert h.hexdigest()==e['sha256'],str(p)
 checked+=1
print('Verified',checked,'original file and symlink paths')
