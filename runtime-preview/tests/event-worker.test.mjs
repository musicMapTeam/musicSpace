import { removeTempAfterTests } from '../../tests/helpers/temp-directory.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { createAvatarWorker } from '../src/avatar-worker.js';
import { createEventWorker } from '../src/event-worker.js';
import { createFakeEnv } from './d1-adapter.mjs';
import { eventContract, photoData } from '../../tests/event-contract.test.js';

async function fixture(t, {rateLimits=false}={}) {
  const dir=await mkdtemp(join(tmpdir(),'musicspace-events-worker-')),file=join(dir,'events.sqlite');let time=Date.parse('2026-09-30T10:00:00Z');let env=createFakeEnv(file);
  t.after(async()=>{env.DB.close();await removeTempAfterTests(dir);});
  const f={get env(){return env;},advance:ms=>time+=ms,restart:async()=>{env.DB.close();env=createFakeEnv(file);},async raw(request){
    const worker=request.url.includes('/api/avatar/')?createAvatarWorker({clock:()=>time,rateLimits:false}):createEventWorker({clock:()=>time,rateLimits});
    return worker.fetch(request,env);
  },async request(path,{method='GET',token,data,key=randomUUID(),headers={}}={}){
    const request=new Request('https://musicspace.test'+(path.startsWith('/api/')?path:'/api/event'+path),{method,headers:{...(token?{Authorization:`Bearer ${token}`} : {}),...(data===undefined?{}:{'Content-Type':'application/json'}),...(method==='GET'||key===null?{}:{'Idempotency-Key':key}),...headers},...(data===undefined?{}:{body:JSON.stringify(data)})});
    const result=await f.raw(request),bytes=Buffer.from(await result.arrayBuffer());return {status:result.status,headers:result.headers,bytes,body:result.headers.get('content-type')?.includes('json')?JSON.parse(bytes):null};
  }};
  f.session=async name=>(await f.request('/api/avatar/session',{method:'POST',data:{name}})).body;
  f.createRoom=(user,key)=>f.request('/rooms',{method:'POST',token:user.token,key,data:{title:'合成测试现场',venue:'合成场地',songId:'late-train',joinConsent:true}});
  f.join=(room,user,yes=true)=>f.request(`/rooms/${room.code}/join`,{method:'POST',token:user.token,data:{joinConsent:yes}});
  f.upload=(room,user,visibility,key)=>f.request(`/rooms/${room.id}/photos`,{method:'POST',token:user.token,key,data:{...photoData(),visibility}});
  return f;
}
eventContract('Worker D1/private R2',fixture);

test('Worker: no API route falls through to public assets; no photo keys in any response',async t=>{
  const f=await fixture(t),a=await f.session('A');const room=(await f.createRoom(a)).body.room;const p=(await f.upload(room,a,'members')).body.photo;
  let assets=0;f.env.ASSETS.fetch=()=>{assets++;throw Error('unexpected assets');};
  assert.equal(await f.raw(new Request('https://musicspace.test/unknown')),null);
  assert.equal((await f.request('/unknown',{token:a.token})).status,404);assert.equal(assets,0);
  const objectKey=[...f.env.PHOTOS.blobs.keys()][0];assert.match(objectKey,/^events\//);
  for(const r of [await f.request('/rooms/'+room.id,{token:a.token}),await f.request('/photos',{token:a.token}),await f.request('/preview/'+room.code)])assert.ok(!JSON.stringify(r.body).includes(objectKey));
  assert.ok(p.imageUrl.startsWith('/api/event/photos/'));
});

test('Worker: initial migration remains upgradeable; event migration does not rewrite existing identities/compositions',async t=>{
  const db=new DatabaseSync(':memory:');t.after(()=>db.close());
  db.exec(await readFile(new URL('../drizzle/0000_known_colonel_america.sql',import.meta.url),'utf8'));
  db.prepare('INSERT INTO avatar_users (id,name,avatar,token_hash,revision,created_at) VALUES (?,?,?,?,?,?)').run('id','Synthetic','{}','opaque',3,'date');
  db.exec(await readFile(new URL('../drizzle/0001_event_rooms.sql',import.meta.url),'utf8'));
  assert.equal(db.prepare('SELECT revision FROM avatar_users').get().revision,3);
  assert.equal(db.prepare('SELECT COUNT(*) AS total FROM event_rooms').get().total,0);
});

test('Worker: sanitization strips uploaded EXIF/comments before bytes reach private storage',async t=>{
  const f=await fixture(t),a=await f.session('A'),room=(await f.createRoom(a)).body.room;
  const jpeg=Buffer.from(photoData().dataUrl.split(',')[1],'base64'),payload=Buffer.from('Exif\0\0SYNTHETIC-GPS-NOT-REAL'),size=Buffer.alloc(2);size.writeUInt16BE(payload.length+2);
  const injected=Buffer.concat([jpeg.subarray(0,2),Buffer.from([0xff,0xe1]),size,payload,jpeg.subarray(2)]);
  const r=await f.request(`/rooms/${room.id}/photos`,{token:a.token,method:'POST',data:{visibility:'private',dataUrl:'data:image/jpeg;base64,'+injected.toString('base64')}});
  assert.equal(r.status,201);const bytes=[...f.env.PHOTOS.blobs.values()][0];assert.equal(bytes.includes(payload),false);assert.equal(bytes[0],0xff);assert.equal(bytes[1],0xd8);
});

test('Worker: private R2 put/get/delete failures neither grant access nor lose referenced bytes',async t=>{
  const f=await fixture(t),a=await f.session('A'),b=await f.session('B'),room=(await f.createRoom(a)).body.room;await f.join(room,b);
  const put=f.env.PHOTOS.put;f.env.PHOTOS.put=async()=>{throw Error('Storage offline');};
  assert.equal((await f.upload(room,a,'members')).status,503);assert.equal((await f.request('/photos',{token:a.token})).body.photos.length,0);
  f.env.PHOTOS.put=put;const p=(await f.upload(room,a,'members')).body.photo;const get=f.env.PHOTOS.get;
  f.env.PHOTOS.get=async()=>{throw Error('Storage read offline');};assert.equal((await f.request(p.imageUrl,{token:b.token})).status,503);assert.equal(f.env.PHOTOS.blobs.size,1);
  f.env.PHOTOS.get=get;assert.equal((await f.request(p.imageUrl,{token:b.token})).status,200);
  f.env.PHOTOS.delete=async()=>{throw Error('Storage delete offline');};
  assert.equal((await f.request('/photos/'+p.id,{token:a.token,method:'DELETE',data:{revision:1}})).status,200);
  assert.equal((await f.request(p.imageUrl,{token:b.token})).status,404);assert.equal((await f.request(p.imageUrl,{token:a.token})).status,404);
  assert.equal(f.env.PHOTOS.blobs.size,1); // Unreferenced bytes retained, permission revoked.
});

test('Worker: transport loss after a committed upload recovers exact response without deleting the committed object',async t=>{
  const f=await fixture(t),a=await f.session('A'),room=(await f.createRoom(a)).body.room;
  const batch=f.env.DB.batch.bind(f.env.DB);let armed=true;
  f.env.DB.batch=async statements=>{const result=await batch(statements);if(armed&&statements.some(s=>s.query.startsWith('INSERT INTO event_idempotency'))){armed=false;throw Error('Transport lost after commit');}return result;};
  const key=randomUUID(),upload=await f.upload(room,a,'private',key);assert.equal(upload.status,201);assert.equal(upload.headers.get('idempotency-replayed'),'true');
  assert.equal(f.env.PHOTOS.blobs.size,1);assert.equal((await f.request(upload.body.photo.imageUrl,{token:a.token})).status,200);
  const retry=await f.upload(room,a,'private',key);assert.deepEqual(retry.body,upload.body);assert.equal(f.env.PHOTOS.blobs.size,1);
});

test('Worker: unknown commit outcome plus recovery read outage retains bytes until exact retry succeeds',async t=>{
  const f=await fixture(t),a=await f.session('A'),room=(await f.createRoom(a)).body.room;
  const batch=f.env.DB.batch.bind(f.env.DB);let armed=true;
  f.env.DB.batch=async statements=>{const result=await batch(statements);if(armed&&statements.some(s=>s.query.startsWith('INSERT INTO event_idempotency'))){armed=false;f.env.DB.readFailures=1;throw Error('Transport lost, result unknown');}return result;};
  const key=randomUUID();assert.equal((await f.upload(room,a,'members',key)).status,503);assert.equal(f.env.PHOTOS.blobs.size,1);
  const retry=await f.upload(room,a,'members',key);assert.equal(retry.status,201);assert.equal(f.env.PHOTOS.blobs.size,1);assert.equal((await f.request(retry.body.photo.imageUrl,{token:a.token})).status,200);
});

test('Worker: leave while storage upload is pending prevents the photo commit; bytes are not exposed',async t=>{
  const f=await fixture(t),a=await f.session('A'),b=await f.session('B'),room=(await f.createRoom(a)).body.room;await f.join(room,b);
  const put=f.env.PHOTOS.put;let started,release;const blocked=new Promise(r=>release=r),began=new Promise(r=>started=r);
  f.env.PHOTOS.put=async(...args)=>{await put(...args);started();await blocked;};
  const pending=f.upload(room,b,'members');await began;
  assert.equal((await f.request(`/rooms/${room.id}/leave`,{token:b.token,method:'POST',data:{}})).status,200);release();
  assert.equal((await pending).status,409);assert.equal((await f.request('/rooms/'+room.id,{token:a.token})).body.photos.length,0);assert.equal((await f.request('/photos',{token:b.token})).body.photos.length,0);
});

test('Worker: revoke sharing while private R2 read is pending prevents delivery',async t=>{
  const f=await fixture(t),a=await f.session('A'),b=await f.session('B'),room=(await f.createRoom(a)).body.room;await f.join(room,b);const p=(await f.upload(room,a,'members')).body.photo;
  const get=f.env.PHOTOS.get;let started,release;const blocked=new Promise(r=>release=r),began=new Promise(r=>started=r);
  f.env.PHOTOS.get=async(...args)=>{const object=await get(...args);started();await blocked;return object;};
  const pending=f.request(p.imageUrl,{token:b.token});await began;
  assert.equal((await f.request('/photos/'+p.id,{token:a.token,method:'PATCH',data:{revision:1,visibility:'private'}})).status,200);release();assert.equal((await pending).status,404);
});

test('Worker: rate limits persist across fresh isolates and restart; expired buckets are pruned',async t=>{
  const f=await fixture(t,{rateLimits:true}),a=await f.session('A'),room=(await f.createRoom(a)).body.room;
  for(let i=0;i<120;i++)assert.equal((await f.request('/preview/'+room.code)).status,200);
  await f.restart();const rejected=await f.request('/preview/'+room.code);assert.equal(rejected.status,429);assert.ok(Number(rejected.headers.get('retry-after'))>0);
  f.advance(60_001);assert.equal((await f.request('/preview/'+room.code)).status,200);
  const b=await f.session('B');
  for(let i=0;i<20;i++)assert.equal((await f.join(room,b)).status,200);
  assert.equal((await f.join(room,b)).status,429);
  assert.ok(f.env.DB.sql.prepare('SELECT COUNT(*) AS n FROM event_rate_limits').get().n<12);
});

test('Worker: bounded non-JSON, invalid JSON, arrays and oversized bodies fail safely',async t=>{
  const f=await fixture(t),a=await f.session('A');
  for(const [body,type,expected]of [['{','application/json',400],['[]','application/json',400],['{}','text/plain',415],['x'.repeat(430*1024),'application/json',413]]){
    const r=await f.raw(new Request('https://musicspace.test/api/event/rooms',{method:'POST',headers:{Authorization:`Bearer ${a.token}`,'Content-Type':type,'Idempotency-Key':randomUUID()},body}));assert.equal(r.status,expected);assert.match(r.headers.get('content-type'),/json/);
  }
});

test('Worker: retained-photo and room pagination is stable, owner-scoped, and survives deleted cursors',async t=>{
  const f=await fixture(t),a=await f.session('A'),b=await f.session('B'),room=(await f.createRoom(a)).body.room,stamp='2026-09-30T09:00:00Z';
  const insert=f.env.DB.sql.prepare('INSERT INTO event_photos (id,room_id,owner_id,photo_key,visibility,revision,created_at,updated_at,deleted_at) VALUES (?,?,?,?,?,1,?,?,NULL)');
  // Seed metadata only to exercise pagination without uploading hundreds of test blobs.
  for(let i=0;i<105;i++)insert.run(randomUUID(),room.id,a.user.id,'synthetic/'+i,'private',stamp,stamp);
  const first=(await f.request('/photos',{token:a.token})).body;assert.equal(first.photos.length,100);assert.ok(first.nextCursor);
  assert.equal((await f.request('/photos?cursor='+first.nextCursor,{token:b.token})).status,400);
  await f.request('/photos/'+first.nextCursor,{token:a.token,method:'DELETE',data:{revision:1}});
  const second=(await f.request('/photos?cursor='+first.nextCursor,{token:a.token})).body;assert.equal(second.photos.length,5);assert.equal(second.nextCursor,null);
  assert.equal(new Set([...first.photos,...second.photos].map(p=>p.id)).size,105);
  assert.equal((await f.request('/photos?cursor=bad',{token:a.token})).status,400);
  const roomInsert=f.env.DB.sql.prepare('INSERT INTO event_rooms (id,code,host_id,title,venue,song_id,revision,created_at,expires_at) VALUES (?,?,?,?,?,?,1,?,?)');
  for(let i=0;i<102;i++)roomInsert.run(randomUUID(),'SYNTHETIC'+i,a.user.id,'synthetic','synthetic','late-train',stamp,'2026-10-01T09:00:00Z');
  const rooms=(await f.request('/rooms',{token:a.token})).body;assert.equal(rooms.rooms.length,100);assert.ok(rooms.nextCursor);
  const rest=(await f.request('/rooms?cursor='+rooms.nextCursor,{token:a.token})).body;assert.equal(rest.rooms.length,3);assert.equal(rest.nextCursor,null);
  assert.equal((await f.request('/rooms?cursor='+rooms.nextCursor,{token:b.token})).status,400);
});

test('Worker: 24 attendees sharing one IP can poll every five seconds plus lazy-load six photos each',async t=>{
  const f=await fixture(t,{rateLimits:true}),host=await f.session('Host'),room=(await f.createRoom(host)).body.room;
  const people=[host,...await Promise.all(Array.from({length:23},(_,i)=>f.session('Member'+i)))];
  for(const person of people.slice(1))assert.equal((await f.join(room,person)).status,200);
  const photo=(await f.upload(room,host,'members')).body.photo;
  // Fixed clock keeps the entire load in one minute's bucket. 24 * (12 + 6)
  // represents one five-second roster poll and six on-demand images per attendee.
  for(const person of people){
    for(let i=0;i<12;i++)assert.equal((await f.request('/rooms/'+room.id,{token:person.token})).status,200);
    for(let i=0;i<6;i++)assert.equal((await f.request(photo.imageUrl,{token:person.token})).status,200);
  }
});

test('Worker: persistent upload-rate bucket bounds even invalid synthetic uploads',async t=>{
  const f=await fixture(t,{rateLimits:true}),a=await f.session('A'),room=(await f.createRoom(a)).body.room;
  const data={visibility:'private',dataUrl:'data:image/jpeg;base64,ZmFrZQ=='};
  for(let i=0;i<20;i++)assert.equal((await f.request(`/rooms/${room.id}/photos`,{token:a.token,method:'POST',data})).status,400);
  await f.restart();assert.equal((await f.request(`/rooms/${room.id}/photos`,{token:a.token,method:'POST',data})).status,429);assert.equal(f.env.PHOTOS.blobs.size,0);
});

test('Worker: historical member metadata paginates under timestamp ties without exposing foreign room cursors',async t=>{
  const f=await fixture(t),host=await f.session('Host'),guest=await f.session('Guest'),outsider=await f.session('Outside'),stamp='2026-09-30T09:00:00Z';
  const rooms=f.env.DB.sql.prepare('INSERT INTO event_rooms (id,code,host_id,title,venue,song_id,revision,created_at,expires_at) VALUES (?,?,?,?,?,?,1,?,?)');
  const members=f.env.DB.sql.prepare('INSERT INTO event_members (room_id,user_id,joined_at,left_at) VALUES (?,?,?,?)');
  for(let i=0;i<105;i++){const id=randomUUID();rooms.run(id,'HISTORY'+i,host.user.id,'Synthetic history','Synthetic venue','late-train',stamp,'2026-10-01T09:00:00Z');members.run(id,guest.user.id,stamp,'2026-09-30T09:30:00Z');}
  const first=(await f.request('/rooms',{token:guest.token})).body;assert.equal(first.rooms.length,100);assert.ok(first.nextCursor);assert.ok(first.rooms.every(r=>r.joined===false&&r.role==='member'));
  const second=(await f.request('/rooms?cursor='+first.nextCursor,{token:guest.token})).body;assert.equal(second.rooms.length,5);assert.equal(second.nextCursor,null);assert.equal(new Set([...first.rooms,...second.rooms].map(r=>r.id)).size,105);
  assert.equal((await f.request('/rooms?cursor='+first.nextCursor,{token:outsider.token})).status,400);
  assert.equal((await f.request('/rooms/'+first.rooms[0].id,{token:guest.token})).status,404);
});
