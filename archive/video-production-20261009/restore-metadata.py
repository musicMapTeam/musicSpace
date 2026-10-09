"""Materialize independent copies and restore recorded mode/nsmtime. Run before editing recovered files."""
import json,os,pathlib,shutil,tempfile,sys,stat
root=pathlib.Path(sys.argv[1]).resolve();manifest=json.load(open(pathlib.Path(__file__).with_name('manifest.json')));materialized=0
for e in manifest['files']:
 p=root/e['archive_path']
 if e['type']=='regular':
  s=os.lstat(p)
  if not stat.S_ISREG(s.st_mode):raise RuntimeError('Expected regular file: '+str(p))
  if s.st_nlink>1:
   fd,temp=tempfile.mkstemp(prefix='.restore-',dir=p.parent);os.close(fd)
   try:shutil.copyfile(p,temp);os.replace(temp,p)
   finally:
    if os.path.exists(temp):os.unlink(temp)
   materialized+=1
  os.chmod(p,e['mode']);os.utime(p,ns=(e['mtime_ns'],e['mtime_ns']))
for d in sorted(manifest['directories'],key=lambda d:d['archive_path'].count('/'),reverse=True):os.chmod(root/d['archive_path'],d['mode'])
print('Restored regular-file modes and original nanosecond mtimes; independent copies materialized:',materialized)
