import os,sys,json,tarfile,gzip,hashlib,subprocess,time,io,stat,tempfile,zlib
BASE='/tmp/kx-project-backup-prep-20261009'
REPO='musicMapTeam/musicSpace'
TAG='archive-video-production-20261009'
LEDGER=BASE+'/tme-upload-ledger.json'
MANIFEST=BASE+'/tme-video-backup-manifest.json'
PART_SIZE=512*1024*1024

def atomic_json(path,value):
 with open(path+'.tmp','w') as f:json.dump(value,f,ensure_ascii=False,indent=2)
 os.replace(path+'.tmp',path)

def gh(*args):
 p=subprocess.run(['gh',*args],stdout=subprocess.PIPE,stderr=subprocess.PIPE,timeout=1200 if '--method' in args and 'POST' in args else 120)
 if p.returncode:raise RuntimeError('gh '+args[0]+': '+p.stderr.decode()[:1000])
 return p.stdout

class VerifiedReader:
 def __init__(self,entry):
  self.e=entry;self.f=open(entry['path'],'rb');self.h=hashlib.sha256();self.n=0
  s=os.fstat(self.f.fileno())
  if (s.st_size,s.st_mtime_ns)!=(entry['logicalbytes'],entry['mtime_ns']):raise RuntimeError('source stat changed: '+entry['path'])
 def read(self,n=-1):
  b=self.f.read(n);self.h.update(b);self.n+=len(b);return b
 def verify(self):
  s=os.fstat(self.f.fileno());self.f.close()
  if self.n!=self.e['logicalbytes'] or self.h.hexdigest()!=self.e['sha256'] or s.st_mtime_ns!=self.e['mtime_ns']:raise RuntimeError('source hash changed: '+self.e['path'])

def write_archive(manifest,sink):
 seen={};counts={'regular':0,'hardlinks':0,'symlinks':0,'dirs':0,'bytes_verified':0};gz=gzip.GzipFile(filename='',mode='wb',fileobj=sink,compresslevel=1,mtime=0)
 with tarfile.open(fileobj=gz,mode='w|',format=tarfile.PAX_FORMAT) as tar:
  for d in manifest['directories']:
   info=tarfile.TarInfo(d['archive_path']);info.type=tarfile.DIRTYPE;info.mode=d['mode'];info.mtime=0;tar.addfile(info);counts['dirs']+=1
  for i,e in enumerate(manifest['files']):
   info=tarfile.TarInfo(e['archive_path']);info.mode=e.get('mode',0o777);info.mtime=0
   if e['type']=='symlink':
    if not os.path.islink(e['path']) or os.readlink(e['path'])!=e['symlink_target']:raise RuntimeError('symlink changed: '+e['path'])
    info.type=tarfile.SYMTYPE;info.linkname=e['symlink_target'];tar.addfile(info);counts['symlinks']+=1
   elif e['type']=='regular':
    reader=VerifiedReader(e);key=(e['sha256'],e['logicalbytes'])
    if key in seen:
     while reader.read(4194304):pass
     reader.verify();info.type=tarfile.LNKTYPE;info.linkname=seen[key];tar.addfile(info);counts['hardlinks']+=1
    else:
     info.size=e['logicalbytes'];tar.addfile(info,reader);reader.verify();seen[key]=e['archive_path'];counts['regular']+=1
    counts['bytes_verified']+=e['logicalbytes']
   else:raise RuntimeError('unsupported '+e['type'])
   if i%1000==0:print(json.dumps({'event':'archive_progress','files_checked':i+1,'of':len(manifest['files']),'logicalbytes_verified':counts['bytes_verified']}),flush=True)
  data=json.dumps(manifest,ensure_ascii=False,indent=2).encode();info=tarfile.TarInfo('BACKUP-MANIFEST.json');info.size=len(data);info.mode=0o644;tar.addfile(info,io.BytesIO(data))
 gz.close();return counts

class FixtureSink:
 def __init__(self):self.parts=[];self.buffer=bytearray()
 def write(self,b):
  self.buffer.extend(b)
  while len(self.buffer)>=117:self.parts.append(bytes(self.buffer[:117]));del self.buffer[:117]
  return len(b)
 def flush(self):pass
 def finish(self):
  if self.buffer:self.parts.append(bytes(self.buffer));self.buffer.clear()

def fixture_test():
 path=BASE+'/generated-writer-fixture';os.makedirs(path,exist_ok=True)
 raw=b'fixed test payload\n'*150
 for n in ['a','b']:open(path+'/'+n,'wb').write(raw)
 if not os.path.islink(path+'/link'):os.symlink('a',path+'/link')
 entries=[]
 for n in ['a','b']:
  p=path+'/'+n;s=os.stat(p);entries.append({'path':p,'archive_path':'fixture/'+n,'type':'regular','logicalbytes':s.st_size,'mtime_ns':s.st_mtime_ns,'mode':0o644,'sha256':hashlib.sha256(raw).hexdigest()})
 entries.append({'path':path+'/link','archive_path':'fixture/link','type':'symlink','symlink_target':'a','logicalbytes':1})
 m={'directories':[{'archive_path':'fixture','mode':0o755}],'files':entries};sink=FixtureSink();counts=write_archive(m,sink);sink.finish();compressed=b''.join(sink.parts)
 payload=gzip.decompress(compressed)
 with tarfile.open(fileobj=io.BytesIO(payload),mode='r:') as tar:
  assert tar.extractfile('fixture/a').read()==raw and tar.extractfile('fixture/b').read()==raw
  assert tar.getmember('fixture/b').islnk() and tar.getmember('fixture/link').issym() and tar.getmember('fixture/link').linkname=='a'
  assert json.load(tar.extractfile('BACKUP-MANIFEST.json'))==m
 assert len(sink.parts)>1 and all(len(p)==117 for p in sink.parts[:-1])
 atomic_json(BASE+'/tme-writer-fixture-test.json',{'passed':True,'parts':len(sink.parts),'part_boundary':117,'gzip_roundtrip':True,'regular_contents':True,'duplicate_hardlink':True,'symlink_preserved':True,'embedded_manifest':True,'counts':counts})
 print('Writer fixture checks passed',flush=True)

class UploadSink:
 def __init__(self,release_id):
  self.release_id=release_id;self.index=1;self.file=None;self.n=0;self.sha=None;self.stream_sha=hashlib.sha256();self.stream_bytes=0;self.gzip_validator=zlib.decompressobj(31);self.uncompressed_tar_bytes=0
  self.ledger=json.load(open(LEDGER)) if os.path.exists(LEDGER) else {'repository':REPO,'tag':TAG,'release_id':release_id,'part_limit_bytes':PART_SIZE,'parts':[],'complete':False,'gzip_level':1,'deterministic_mtime':0}
  if self.ledger['release_id']!=release_id:raise RuntimeError('release id mismatch')
 def start(self):
  self.name='video-production.tar.gz.part%04d'%self.index;self.path=BASE+'/'+self.name;self.file=open(self.path,'wb');self.n=0;self.sha=hashlib.sha256()
 def write(self,b):
  self.stream_sha.update(b);self.stream_bytes+=len(b);self.uncompressed_tar_bytes+=len(self.gzip_validator.decompress(b));offset=0
  while offset<len(b):
   if self.file is None:self.start()
   take=min(len(b)-offset,PART_SIZE-self.n);part=b[offset:offset+take];self.file.write(part);self.sha.update(part);self.n+=take;offset+=take
   if self.n==PART_SIZE:self.finish_part()
  return len(b)
 def flush(self):
  if self.file:self.file.flush()
 def assets(self):return json.loads(gh('api',f'repos/{REPO}/releases/{self.release_id}/assets?per_page=100'))
 def finish_part(self):
  self.file.close();self.file=None;digest=self.sha.hexdigest();expected='sha256:'+digest
  print(json.dumps({'event':'part_ready','part':self.index,'bytes':self.n,'sha256':digest}),flush=True)
  for attempt in range(1,6):
   try:
    assets=self.assets();remote=next((a for a in assets if a['name']==self.name),None)
    if not (remote and remote.get('digest')==expected and remote['size']==self.n and remote.get('state')=='uploaded'):
     
     if remote:gh('api','--method','DELETE',f'repos/{REPO}/releases/assets/{remote["id"]}')
     gh('api','--method','POST',f'https://uploads.github.com/repos/{REPO}/releases/{self.release_id}/assets?name={self.name}','--header','Content-Type: application/octet-stream','--input',self.path);assets=self.assets();remote=next((a for a in assets if a['name']==self.name),None)
    if not remote or remote.get('digest')!=expected or remote['size']!=self.n or remote.get('state')!='uploaded':raise RuntimeError('asset checksum/state mismatch')
    record={'index':self.index,'name':self.name,'bytes':self.n,'sha256':digest,'remote_digest':remote['digest'],'asset_id':remote['id'],'url':remote['browser_download_url'],'verified':True}
    existing=[x for x in self.ledger['parts'] if x['index']==self.index]
    if existing and any((x['sha256'],x['bytes'])!=(digest,self.n) for x in existing):raise RuntimeError('resume stream differs')
    self.ledger['parts']=[x for x in self.ledger['parts'] if x['index']!=self.index]+[record];self.ledger['parts'].sort(key=lambda x:x['index']);atomic_json(LEDGER,self.ledger)
    print(json.dumps({'event':'part_uploaded_verified','part':self.index,'bytes':self.n,'sha256':digest,'asset_id':remote['id']}),flush=True)
    os.unlink(self.path);self.index+=1;return
   except Exception as e:
    print(json.dumps({'event':'part_retry','part':self.index,'attempt':attempt,'error':str(e)}),flush=True)
    if attempt==5:raise
    time.sleep(min(10*attempt,30))
 def finish(self,counts):
  if self.file:self.finish_part()
  self.uncompressed_tar_bytes+=len(self.gzip_validator.flush())
  if not self.gzip_validator.eof or self.gzip_validator.unused_data:raise RuntimeError('full gzip stream validation failed')
  assets=self.assets();expected=self.ledger['parts'];names={x['name'] for x in expected};remote_parts=[x for x in assets if x['name'].startswith('video-production.tar.gz.part')]
  if len(remote_parts)!=len(expected) or {x['name'] for x in remote_parts}!=names:raise RuntimeError('remote part count mismatch')
  for x in expected:
   a=next(a for a in remote_parts if a['name']==x['name'])
   if a['digest']!='sha256:'+x['sha256'] or a['size']!=x['bytes']:raise RuntimeError('final remote verification failed')
  self.ledger.update(complete=True,full_stream_gzip_validated=True,uncompressed_tar_bytes=self.uncompressed_tar_bytes,compressed_stream_bytes=self.stream_bytes,compressed_stream_sha256=self.stream_sha.hexdigest(),archive_counts=counts,remote_part_count=len(remote_parts),verified_utc=time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime()))
  atomic_json(LEDGER,self.ledger);print(json.dumps({'event':'ALL_PARTS_VERIFIED','parts':len(expected),'bytes':self.stream_bytes,'sha256':self.stream_sha.hexdigest(),'archive_counts':counts}),flush=True)

# Bounded producer/upload pipeline: three slots include both open and uploading parts.
class ParallelUploadSink(UploadSink):
 def __init__(self,release_id):
  super().__init__(release_id)
  import concurrent.futures,threading
  self.pool=concurrent.futures.ThreadPoolExecutor(max_workers=3);self.slots=threading.Semaphore(3);self.lock=threading.Lock();self.pending=[]
  self.ledger['upload_concurrency']=3;self.ledger['max_generated_part_bytes']=3*PART_SIZE
 def start(self):
  self.slots.acquire()
  try:
   for future in self.pending:
    if future.done():future.result()
   super().start()
  except BaseException:self.slots.release();raise
 def finish_part(self):
  self.file.close();self.file=None
  index,name,path,size,digest=self.index,self.name,self.path,self.n,self.sha.hexdigest()
  print(json.dumps({'event':'part_ready','part':index,'bytes':size,'sha256':digest}),flush=True)
  self.index+=1;self.pending.append(self.pool.submit(self.upload_part,index,name,path,size,digest))
 def upload_part(self,index,name,path,size,digest):
  expected='sha256:'+digest
  try:
   for attempt in range(1,6):
    try:
     assets=self.assets();remote=next((a for a in assets if a['name']==name),None)
     if not (remote and remote.get('digest')==expected and remote['size']==size and remote.get('state')=='uploaded'):
      if remote:gh('api','--method','DELETE',f'repos/{REPO}/releases/assets/{remote["id"]}')
      gh('api','--method','POST',f'https://uploads.github.com/repos/{REPO}/releases/{self.release_id}/assets?name={name}','--header','Content-Type: application/octet-stream','--input',path)
      assets=self.assets();remote=next((a for a in assets if a['name']==name),None)
     if not remote or remote.get('digest')!=expected or remote['size']!=size or remote.get('state')!='uploaded':raise RuntimeError('asset checksum/state mismatch')
     record={'index':index,'name':name,'bytes':size,'sha256':digest,'remote_digest':remote['digest'],'asset_id':remote['id'],'url':remote['browser_download_url'],'verified':True}
     with self.lock:
      existing=[x for x in self.ledger['parts'] if x['index']==index]
      if existing and any((x['sha256'],x['bytes'])!=(digest,size) for x in existing):raise RuntimeError('resume stream differs')
      self.ledger['parts']=[x for x in self.ledger['parts'] if x['index']!=index]+[record];self.ledger['parts'].sort(key=lambda x:x['index']);atomic_json(LEDGER,self.ledger)
     print(json.dumps({'event':'part_uploaded_verified','part':index,'bytes':size,'sha256':digest,'asset_id':remote['id']}),flush=True)
     os.unlink(path);return record
    except Exception as e:
     print(json.dumps({'event':'part_retry','part':index,'attempt':attempt,'error':str(e)}),flush=True)
     if attempt==5:raise
     time.sleep(min(10*attempt,30))
  finally:self.slots.release()
 def finish(self,counts):
  if self.file:self.finish_part()
  self.pool.shutdown(wait=True)
  for future in self.pending:future.result()
  super().finish(counts)

if __name__=='__main__':
 fixture_test()
 if '--fixture-only' not in sys.argv:
  releases=json.loads(gh('api',f'repos/{REPO}/releases?per_page=100'));release=next(r for r in releases if r['tag_name']==TAG);sink=ParallelUploadSink(release['id']);m=json.load(open(MANIFEST));counts=write_archive(m,sink);sink.finish(counts)
