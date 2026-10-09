import { removeTempAfterTests } from './helpers/temp-directory.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { createAvatarApi, DEFAULT_AVATAR } from '../server/avatar-api.js';
import { createEventApi } from '../server/event-api.js';
import { createEventController, SESSION_KEY, EVENT_STORAGE_KEY, EVENT_OPERATION_PREFIX } from '../web/event-client/controller.js';
import { createEventApiClient } from '../web/event-client/api.js';
import { photoData } from './event-contract.test.js';

const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};};
function localStore() { const entries=new Map(); return {entries,get length(){return entries.size;},key:i=>[...entries.keys()][i]??null,getItem:key=>entries.get(key)??null,setItem(key,value){entries.set(key,String(value));},removeItem:key=>entries.delete(key)}; }
const profile=name=>({name,avatar:{...DEFAULT_AVATAR}});
const roomInput=(title='Synthetic show')=>({title,venue:'Synthetic venue',songId:'late-train',joinConsent:true,participation:'open'});
async function fixture(t) {
  const dir=await mkdtemp(join(tmpdir(),'event-client-')),avatar=createAvatarApi({dataDir:dir,rateLimits:false}),event=createEventApi({dataDir:dir,rateLimits:false});
  const server=createServer(async(req,res)=>{if(!await event(req,res)&&!await avatar(req,res)){res.writeHead(404);res.end();}});server.listen(0,'127.0.0.1');await once(server,'listening');
  const baseUrl=`http://127.0.0.1:${server.address().port}`,controllers=[];
  t.after(async()=>{controllers.forEach(c=>c.dispose());server.closeAllConnections();await new Promise(resolve=>server.close(resolve));avatar.close();event.close();await removeTempAfterTests(dir);});
  const f={baseUrl,dir,client({storage=localStore(),fetch:fetcher=fetch,timeoutMs=1000}={}){const c=createEventController({storage,fetch:fetcher,baseUrl,timeoutMs});controllers.push(c);return {c,storage};},async person(name){const pair=f.client();await pair.c.connect();await pair.c.establishIdentity(profile(name));return pair;},async api(path,token,method='GET',body){const r=await fetch(baseUrl+path,{method,headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json','Idempotency-Key':randomUUID()},...(body?{body:JSON.stringify(body)}:{})});return {status:r.status,body:await r.json()};}};
  return f;
}
async function joinRoom(c,room){await c.previewRoom(room.code);return c.joinRoom(room.code,{joinConsent:true,participation:'open'});}

test('controller construction has no network side effects; identity and immutable state contain no credentials',async t=>{
  const f=await fixture(t);let calls=0;const {c,storage}=f.client({fetch:(...args)=>{calls++;return fetch(...args);}});
  assert.equal(calls,0);assert.equal(c.getState().identity.status,'missing');assert.throws(()=>c.createRoom(roomInput()),/身份/);
  await c.connect();assert.equal(calls,1);assert.equal(c.getState().connection,'connected');assert.equal(c.getState().identity.status,'missing');
  const seen=[];const unsubscribe=c.subscribe(state=>seen.push(state));await c.establishIdentity(profile('A'));
  const session=JSON.parse(storage.getItem(SESSION_KEY));assert.ok(session.token);assert.equal(c.getState().identity.status,'ready');assert.ok(!JSON.stringify(seen).includes(session.token));
  assert.ok(!storage.getItem(EVENT_STORAGE_KEY).includes(session.token));assert.throws(()=>{c.getState().identity.user.name='mutated';},TypeError);unsubscribe();
});

test('two real independent controllers create/join, share scoped photos, retain owner library and close after leave',async t=>{
  const f=await fixture(t),a=await f.person('A'),b=await f.person('B'),outsider=await f.person('Outside');
  const made=await a.c.createRoom(roomInput()),room=made.room;assert.equal(a.c.getState().members.length,1);
  await joinRoom(b.c,room);await a.c.refreshRoom();assert.equal(a.c.getState().members.length,2);assert.notEqual(a.c.getState().identity.user.id,b.c.getState().identity.user.id);
  const upload=await a.c.uploadPhoto(photoData().dataUrl,'private',{roomId:room.id});const id=upload.photo.id;
  await assert.rejects(b.c.fetchPhotoBlob(id),e=>e.status===404);await assert.rejects(outsider.c.fetchPhotoBlob(id),e=>e.status===404);
  await a.c.setPhotoVisibility(id,'members',{revision:1});const blob=await b.c.fetchPhotoBlob(id);assert.equal(blob.type,'image/jpeg');assert.ok(blob.size>50);
  await a.c.leaveRoom(room.id);assert.equal(a.c.getState().route.kind,'home');await assert.rejects(b.c.fetchPhotoBlob(id),e=>e.status===404);
  await a.c.loadMyPhotos();assert.equal(a.c.getState().myPhotos.items[0].visibility,'private');assert.ok((await a.c.fetchPhotoBlob(id)).size>50);
  await a.c.loadMyRooms();assert.equal(a.c.getState().myRooms.items[0].joined,false);
  await a.c.closeRoom(room.id,{revision:1});await b.c.refreshRoom();assert.equal(b.c.getState().room.status,'closed');
  await a.c.removePhoto(id,{revision:3});await assert.rejects(a.c.fetchPhotoBlob(id),e=>e.status===404);
});

test('preview consent, uploads and revisions remain bound to the reviewed room/photo',async t=>{
  const f=await fixture(t),a=await f.person('A'),b=await f.person('B');const one=(await a.c.createRoom(roomInput('One'))).room,two=(await a.c.createRoom(roomInput('Two'))).room;
  await b.c.previewRoom(one.code);await b.c.previewRoom(two.code);
  assert.throws(()=>b.c.joinRoom(one.code,{joinConsent:true,participation:'open'}),e=>e.code==='TARGET_CHANGED');assert.throws(()=>b.c.joinRoom(two.code,{joinConsent:false}),e=>e.code==='JOIN_CONSENT_REQUIRED');
  await b.c.joinRoom(two.code,{joinConsent:true,participation:'open'});assert.throws(()=>b.c.uploadPhoto(photoData().dataUrl,'members',{roomId:one.id}),e=>e.code==='TARGET_CHANGED');
  const photo=(await b.c.uploadPhoto(photoData().dataUrl,'private',{roomId:two.id})).photo;
  assert.throws(()=>b.c.setPhotoVisibility(photo.id,'members',{revision:8}),e=>e.code==='REVIEW_STALE');
});

test('local chosen avatar/profile stays a draft until explicit save; server identity remains the same',async t=>{
  const f=await fixture(t),{c,storage}=await f.person('A');const id=c.getState().identity.user.id;
  const chosen=profile('A new name');chosen.avatar.hair=3;c.setDraft('profile',chosen);
  assert.equal(c.getState().identity.user.name,'A');assert.equal(c.getState().dirty.profile,true);
  const token=JSON.parse(storage.getItem(SESSION_KEY)).token;assert.equal((await f.api('/api/avatar/session',token)).body.user.name,'A');
  await c.saveProfile(chosen,{revision:1});assert.equal(c.getState().identity.user.id,id);assert.equal(c.getState().identity.user.name,'A new name');assert.equal(c.getState().dirty.profile,false);
});

test('explicit no-eyewear saves, survives reload and synchronizes to the other room member without changing their look',async t=>{
 const f=await fixture(t),a=await f.person('A'),b=await f.person('B');
 const dressed={...profile('A'),avatar:{...DEFAULT_AVATAR,eyewear:5,hair:7,expression:'focused'}};
 await a.c.saveProfile(dressed,{revision:1});
 const room=(await a.c.createRoom(roomInput())).room;await joinRoom(b.c,room);
 const originalB=structuredClone(b.c.getState().identity.user.avatar),id=a.c.getState().identity.user.id;
 const bare={...dressed,avatar:{...dressed.avatar,eyewear:0}};a.c.setDraft('profile',bare);await b.c.refreshRoom();
 assert.equal(b.c.getState().members.find(m=>m.id===id).avatar.eyewear,5);
 await a.c.saveProfile(bare,{revision:2});await b.c.refreshRoom();
 assert.deepEqual(b.c.getState().members.find(m=>m.id===id).avatar,bare.avatar);
 assert.deepEqual(b.c.getState().identity.user.avatar,originalB);
 a.c.dispose();const restored=f.client({storage:a.storage}).c;await restored.connect();await restored.openRoom(room.id);
 assert.equal(restored.getState().identity.user.id,id);assert.deepEqual(restored.getState().identity.user.avatar,bare.avatar);
 assert.equal(restored.getState().members.find(m=>m.id===id).avatar.eyewear,0);
});

test('late open response cannot overwrite a newer room; loading belongs to the newer navigation',async t=>{
  const f=await fixture(t),{c,storage}=await f.person('A'),one=(await c.createRoom(roomInput('One'))).room,two=(await c.createRoom(roomInput('Two'))).room;c.dispose();
  const gate=deferred(),started=deferred();let hold=true;
  const next=f.client({storage,fetch:async(url,options)=>{const response=await fetch(url,{...options,signal:undefined});if(hold&&url.endsWith('/rooms/'+one.id)){hold=false;started.resolve();await gate.promise;}return response;}}).c;await next.connect();
  const old=next.openRoom(one.id);old.catch(()=>{});await started.promise;await next.openRoom(two.id);gate.resolve();
  await assert.rejects(old,e=>e.code==='ABORTED');assert.equal(next.getState().room.id,two.id);assert.deepEqual(next.getState().loading,[]);
});

test('interrupted join can finish only for its original room and cannot navigate away from a newer target',async t=>{
  const f=await fixture(t),a=await f.person('A'),b=await f.person('B'),one=(await a.c.createRoom(roomInput('One'))).room,two=(await a.c.createRoom(roomInput('Two'))).room;await joinRoom(b.c,two);b.c.dispose();
  const gate=deferred(),started=deferred();let hold=true;
  const c=f.client({storage:b.storage,fetch:async(url,options)=>{const response=await fetch(url,options);if(hold&&url.endsWith('/'+one.code+'/join')){hold=false;started.resolve();await gate.promise;}return response;}}).c;await c.connect();await c.previewRoom(one.code);
  const pending=c.joinRoom(one.code,{joinConsent:true,participation:'open'});await started.promise;await c.openRoom(two.id);gate.resolve();const result=await pending;
  assert.equal(result.applied,false);assert.equal(c.getState().room.id,two.id);assert.equal(c.getState().route.target,two.id);
  await c.loadMyRooms();assert.equal(c.getState().myRooms.items.length,2);
});

test('dropped upload response survives reload and retries exact key/payload without discarding a newer draft or changing route',async t=>{
  const f=await fixture(t),a=await f.person('A'),room=(await a.c.createRoom(roomInput())).room,other=(await a.c.createRoom(roomInput('Other'))).room;a.c.dispose();
  const sent=[];let drop=true;const transport=async(url,options)=>{if(url.endsWith('/photos')&&options.method==='POST'){sent.push({body:options.body,key:options.headers['Idempotency-Key']});const response=await fetch(url,options);if(drop){drop=false;throw Error('synthetic lost response');}return response;}return fetch(url,options);};
  const c=f.client({storage:a.storage,fetch:transport}).c;await c.connect();await c.openRoom(room.id);c.setDraft('photo',{roomId:room.id,dataUrl:photoData().dataUrl,visibility:'members'});
  await assert.rejects(c.uploadPhoto(photoData().dataUrl,'members',{roomId:room.id}),e=>e.code==='NETWORK');const op=c.getState().pending[0];assert.equal(op.status,'uncertain');assert.equal(op.durable,true);
  const stored=JSON.parse(a.storage.getItem(EVENT_STORAGE_KEY));assert.ok(stored.operations[0].key);assert.ok(!JSON.stringify(c.getState()).includes(stored.operations[0].key));
  const newer={roomId:other.id,dataUrl:'local-unsent-newer-photo',visibility:'private'};c.setDraft('photo',newer);c.dispose();
  const restored=f.client({storage:a.storage,fetch:transport}).c;await restored.connect();await restored.openRoom(other.id);const result=await restored.retry(op.id);
  assert.equal(result.applied,false);assert.equal(restored.getState().room.id,other.id);assert.deepEqual(restored.getState().drafts.photo,newer);assert.equal(restored.getState().dirty.photo,true);
  assert.deepEqual(sent[0],sent[1]);assert.equal(restored.getState().pending.length,0);await restored.loadMyPhotos();assert.equal(restored.getState().myPhotos.items.length,1);assert.equal(restored.getState().myPhotos.items[0].visibility,'members');
});

test('cancel means stop waiting, preserves uncertain operation and newer draft for an exact explicit retry',async t=>{
  const f=await fixture(t),a=await f.person('A'),room=(await a.c.createRoom(roomInput())).room;a.c.dispose();const gate=deferred(),started=deferred();let hold=true;
  const c=f.client({storage:a.storage,fetch:async(url,options)=>{const response=await fetch(url,{...options,signal:undefined});if(hold&&url.endsWith('/photos')&&options.method==='POST'){hold=false;started.resolve();await gate.promise;}return response;}}).c;await c.connect();await c.openRoom(room.id);
  const pending=c.uploadPhoto(photoData().dataUrl,'private',{roomId:room.id});pending.catch(()=>{});await started.promise;const id=c.getState().pending[0].id;c.cancel(id);c.setDraft('photo',{roomId:room.id,dataUrl:'new private draft',visibility:'private'});gate.resolve();
  await assert.rejects(pending,e=>e.code==='ABORTED');assert.equal(c.getState().pending[0].status,'cancelled');assert.deepEqual(c.getState().loading,[]);
  await c.retry(id);assert.equal(c.getState().photos.length,1);assert.equal(c.getState().drafts.photo.dataUrl,'new private draft');assert.equal(c.getState().dirty.photo,true);
});

test('confirmed rate-limit rejection is failed and dismissible, with the unsent upload draft retained',async t=>{
  const f=await fixture(t),a=await f.person('A'),room=(await a.c.createRoom(roomInput())).room;a.c.dispose();let limited=true;
  const c=f.client({storage:a.storage,fetch:(url,options)=>limited&&url.endsWith('/photos')&&options.method==='POST'?Promise.resolve(Response.json({error:{code:'RATE_LIMITED',message:'请稍后再试。'}},{status:429,headers:{'Retry-After':'60'}})):fetch(url,options)}).c;
  await c.connect();await c.openRoom(room.id);
  await assert.rejects(c.uploadPhoto(photoData().dataUrl,'members',{roomId:room.id}),e=>e.status===429&&e.retryable&&!e.uncertain&&e.retryAfter===60);
  const rejected=c.getState().pending[0];assert.equal(rejected.status,'failed');assert.equal(rejected.error.uncertain,false);assert.equal(c.getState().dirty.photo,true);assert.equal(c.getState().photos.length,0);
  c.cancel(rejected.id);assert.equal(c.getState().pending.length,0);assert.equal(c.getState().drafts.photo.visibility,'members');
  limited=false;await c.uploadPhoto(photoData().dataUrl,'members',{roomId:room.id});assert.equal(c.getState().photos.length,1);
});

test('rate rejection of an original-key retry does not discard an earlier committed but unconfirmed upload',async t=>{
 const f=await fixture(t),a=await f.person('A'),room=(await a.c.createRoom(roomInput())).room;a.c.dispose();let phase='lose';const sent=[];
 const c=f.client({storage:a.storage,fetch:async(url,options)=>{if(url.endsWith('/photos')&&options.method==='POST'){if(phase==='rate')return Response.json({error:{code:'RATE_LIMITED',message:'Synthetic retry rate'}},{status:429});const response=await fetch(url,options);sent.push(options.headers['Idempotency-Key']);if(phase==='lose'){phase='rate';throw Error('Synthetic committed response loss');}return response;}return fetch(url,options);}}).c;
 await c.connect();await c.openRoom(room.id);await assert.rejects(c.uploadPhoto(photoData().dataUrl,'private',{roomId:room.id}),e=>e.uncertain);const id=c.getState().pending[0].id;
 await assert.rejects(c.retry(id),e=>e.status===429&&e.uncertain);assert.equal(c.getState().pending[0].status,'uncertain');c.cancel(id);assert.equal(c.getState().pending.length,1);
 phase='recover';await c.retry(id);assert.equal(sent[0],sent[1]);await c.loadMyPhotos();assert.equal(c.getState().myPhotos.items.length,1);
});

test('failed token is never silently replaced; old operations cannot execute under an explicitly new identity',async t=>{
  const f=await fixture(t),a=await f.person('A'),room=(await a.c.createRoom(roomInput())).room;a.c.dispose();let failUpload=true;
  const c=f.client({storage:a.storage,fetch:(url,options)=>url.endsWith('/photos')&&options.method==='POST'&&failUpload?Promise.reject(Error('offline')):fetch(url,options)}).c;await c.connect();await c.openRoom(room.id);
  c.setDraft('photo',{roomId:room.id,dataUrl:photoData().dataUrl,visibility:'private'});await assert.rejects(c.uploadPhoto(photoData().dataUrl,'private',{roomId:room.id}));const op=c.getState().pending[0],old=JSON.parse(a.storage.getItem(SESSION_KEY));
  const db=new DatabaseSync(join(f.dir,'avatar-space.sqlite'));db.prepare('UPDATE avatar_users SET token_hash = ? WHERE id = ?').run('revoked-synthetic-token',old.user.id);db.close();
  await assert.rejects(c.connect(),e=>e.status===401);assert.equal(c.getState().identity.status,'invalid');assert.equal(JSON.parse(a.storage.getItem(SESSION_KEY)).token,old.token);assert.throws(()=>c.establishIdentity(profile('Same nickname')),e=>e.code==='IDENTITY_REPLACEMENT_REQUIRED');
  const replacement=await c.establishIdentity(profile('Same nickname'),{replaceInvalid:true});assert.notEqual(replacement.user.id,old.user.id);failUpload=false;
  await assert.rejects(c.retry(op.id),e=>e.code==='IDENTITY_CHANGED');assert.equal(c.getState().drafts.photo,null);assert.equal(c.getState().pending.some(p=>p.id===op.id),false);assert.ok(JSON.parse(a.storage.getItem(EVENT_STORAGE_KEY)).operations.some(p=>p.id===op.id),'old request remains durable without appearing under the new identity');await c.loadMyPhotos();assert.equal(c.getState().myPhotos.items.length,0);
});

test('missing old token on reload is reported as lost, never recovered by nickname or fresh constructor',async t=>{
  const f=await fixture(t),a=await f.person('A');a.c.dispose();a.storage.removeItem(SESSION_KEY);let requests=0;const c=f.client({storage:a.storage,fetch:(...args)=>{requests++;return fetch(...args);}}).c;
  assert.equal(c.getState().identity.status,'lost');assert.equal(requests,0);await c.connect();assert.equal(requests,1);assert.throws(()=>c.establishIdentity(profile('A')),e=>e.code==='IDENTITY_REPLACEMENT_REQUIRED');
});

test('lost identity-creation response retries its original bootstrap after reload instead of creating another user',async t=>{
  const f=await fixture(t),storage=localStore();let lose=true;const bodies=[];const transport=async(url,options)=>{const response=await fetch(url,options);if(url.endsWith('/avatar/session')&&options.method==='POST'){bodies.push({body:options.body,key:options.headers['Idempotency-Key']});if(lose){lose=false;throw Error('lost bootstrap');}}return response;};
  const c=f.client({storage,fetch:transport}).c;await c.connect();await assert.rejects(c.establishIdentity(profile('A')),e=>e.code==='NETWORK');const op=c.getState().pending[0];c.dispose();
  const restored=f.client({storage,fetch:transport}).c;await restored.connect();await restored.retry(op.id);assert.equal(restored.getState().identity.status,'ready');assert.deepEqual(bodies[0],bodies[1]);
  const db=new DatabaseSync(join(f.dir,'avatar-space.sqlite'));assert.equal(db.prepare('SELECT COUNT(*) AS n FROM avatar_users').get().n,1);db.close();
});

test('quota failures expose missing refresh recovery; identity creation requires durable retry state',async t=>{
  const f=await fixture(t),storage=localStore();storage.setItem=()=>{throw Error('quota');};let calls=0;const c=f.client({storage,fetch:(...args)=>{calls++;return fetch(...args);}}).c;
  c.setDraft('profile',profile('A'));assert.equal(c.getState().storage.refreshRecovery,false);await c.connect();await assert.rejects(c.establishIdentity(profile('A')),e=>e.code==='STORAGE_REQUIRED');assert.equal(calls,1);assert.deepEqual(c.getState().drafts.profile,profile('A'));
  const a=await f.person('A'),room=(await a.c.createRoom(roomInput())).room;a.c.dispose();a.storage.setItem=()=>{throw Error('quota');};
  const offline=f.client({storage:a.storage,fetch:(url,options)=>url.endsWith('/photos')&&options.method==='POST'?Promise.reject(Error('offline')):fetch(url,options)}).c;await offline.connect();await offline.openRoom(room.id);
  offline.setDraft('photo',{roomId:room.id,dataUrl:photoData().dataUrl,visibility:'private'});await assert.rejects(offline.uploadPhoto(photoData().dataUrl,'private',{roomId:room.id}));assert.equal(offline.getState().pending[0].durable,false);assert.equal(offline.getState().storage.refreshRecovery,false);assert.equal(offline.getState().dirty.photo,true);
});

test('refresh after an external leave clears restricted room content without replacing identity or draft',async t=>{
  const f=await fixture(t),a=await f.person('A'),room=(await a.c.createRoom(roomInput())).room;const token=JSON.parse(a.storage.getItem(SESSION_KEY)).token;
  a.c.setDraft('room',{title:'Unsent newer draft'});await f.api('/api/event/rooms/'+room.id+'/leave',token,'POST',{});
  await assert.rejects(a.c.refreshRoom(),e=>e.status===404);assert.equal(a.c.getState().room,null);assert.deepEqual(a.c.getState().members,[]);assert.deepEqual(a.c.getState().photos,[]);assert.equal(a.c.getState().identity.status,'ready');assert.equal(a.c.getState().drafts.room.title,'Unsent newer draft');
});

test('transport uses bounded abort timeouts, rejects external photo paths and never puts auth into URLs',async()=>{
  const seen=[];const api=createEventApiClient({timeoutMs:5,fetch:(url,options)=>{seen.push({url,options});return new Promise((resolve,reject)=>options.signal.addEventListener('abort',()=>reject(Error('aborted')),{once:true}));}});
  await assert.rejects(api.request('/rooms',{method:'POST',bodyJson:'{}',key:randomUUID(),token:'t'.repeat(43)}),e=>e.code==='TIMEOUT'&&e.uncertain===true);
  assert.ok(!seen[0].url.includes('t'.repeat(43)));assert.equal(seen[0].options.headers.Authorization,'Bearer '+'t'.repeat(43));assert.equal(seen[0].options.redirect,'error');
  assert.throws(()=>api.photoBlob('https://untrusted.test/image',{token:'t'.repeat(43)}),e=>e.code==='INVALID_INPUT');await assert.rejects(api.request('//untrusted.test'),e=>e.code==='INVALID_PATH');
});

test('late profile and photo mutation responses cannot roll back newer revisions or resurrect removed photos',async t=>{
  const f=await fixture(t),a=await f.person('A'),room=(await a.c.createRoom(roomInput())).room;a.c.dispose();
  const profileGate=deferred(),profileStarted=deferred(),photoGate=deferred(),photoStarted=deferred();let holdProfile=true,holdPhoto=true;
  const c=f.client({storage:a.storage,fetch:async(url,options)=>{const response=await fetch(url,options);if(holdProfile&&url.endsWith('/profile')){holdProfile=false;profileStarted.resolve();await profileGate.promise;}if(holdPhoto&&url.endsWith('/photos')&&options.method==='POST'){holdPhoto=false;photoStarted.resolve();await photoGate.promise;}return response;}}).c;
  await c.connect();await c.openRoom(room.id);
  const old=c.saveProfile(profile('First edit'),{revision:1});await profileStarted.promise;await c.connect();await c.saveProfile(profile('Newer edit'),{revision:2});profileGate.resolve();await old;
  assert.equal(c.getState().identity.user.name,'Newer edit');assert.equal(c.getState().identity.user.revision,3);
  const uploaded=c.uploadPhoto(photoData().dataUrl,'private',{roomId:room.id});await photoStarted.promise;await c.loadMyPhotos();const photo=c.getState().myPhotos.items[0];await c.removePhoto(photo.id,{revision:1});photoGate.resolve();const result=await uploaded;
  assert.equal(result.applied,false);assert.equal(c.getState().photos.length,0);assert.equal(c.getState().myPhotos.items.length,0);
});

test('older refresh snapshots cannot restore a photo sharing setting revoked while the read was pending',async t=>{
  const f=await fixture(t),a=await f.person('A'),room=(await a.c.createRoom(roomInput())).room,photo=(await a.c.uploadPhoto(photoData().dataUrl,'members',{roomId:room.id})).photo;a.c.dispose();
  const gate=deferred(),started=deferred();let hold=false;
  const c=f.client({storage:a.storage,fetch:async(url,options)=>{const response=await fetch(url,options);if(hold&&url.endsWith('/rooms/'+room.id)&&options.method==='GET'){hold=false;started.resolve();await gate.promise;}return response;}}).c;
  await c.connect();await c.openRoom(room.id);hold=true;const refresh=c.refreshRoom();await started.promise;await c.setPhotoVisibility(photo.id,'private',{revision:1});gate.resolve();await refresh;
  assert.equal(c.getState().photos[0].visibility,'private');assert.equal(c.getState().photos[0].revision,2);
});

test('identity rejection invalidates already-running private reads so their late responses cannot restore content',async t=>{
  const f=await fixture(t),a=await f.person('A'),room=(await a.c.createRoom(roomInput())).room;a.c.dispose();const gate=deferred(),started=deferred();let hold=false;
  const c=f.client({storage:a.storage,fetch:async(url,options)=>{const response=await fetch(url,{...options,signal:undefined});if(hold&&url.endsWith('/rooms/'+room.id)){hold=false;started.resolve();await gate.promise;}return response;}}).c;await c.connect();await c.openRoom(room.id);hold=true;
  const refresh=c.refreshRoom();refresh.catch(()=>{});await started.promise;const db=new DatabaseSync(join(f.dir,'avatar-space.sqlite'));db.prepare('UPDATE avatar_users SET token_hash = ? WHERE id = ?').run('revoked',c.getState().identity.user.id);db.close();
  await assert.rejects(c.loadMyPhotos(),e=>e.status===401);gate.resolve();await assert.rejects(refresh,e=>e.code==='ABORTED');assert.equal(c.getState().identity.status,'invalid');assert.equal(c.getState().room,null);assert.deepEqual(c.getState().members,[]);
});

test('disposed controller cannot overwrite a replacement controller’s newer persisted draft when its request settles',async t=>{
  const f=await fixture(t),a=await f.person('A'),room=(await a.c.createRoom(roomInput())).room;a.c.dispose();const gate=deferred(),started=deferred();
  const old=f.client({storage:a.storage,fetch:async(url,options)=>{const response=await fetch(url,{...options,signal:undefined});if(url.endsWith('/photos')&&options.method==='POST'){started.resolve();await gate.promise;}return response;}}).c;await old.connect();await old.openRoom(room.id);
  const pending=old.uploadPhoto(photoData().dataUrl,'private',{roomId:room.id});pending.catch(()=>{});await started.promise;old.dispose();
  const fresh=f.client({storage:a.storage}).c;await fresh.connect();fresh.setDraft('photo',{roomId:room.id,dataUrl:'newer after dispose',visibility:'private'});gate.resolve();await assert.rejects(pending,e=>e.code==='ABORTED');
  assert.equal(JSON.parse(a.storage.getItem(EVENT_STORAGE_KEY)).drafts.photo.dataUrl,'newer after dispose');assert.equal(fresh.getState().pending.length,1);
});

test('explicit same-payload resubmission reuses the frozen operation and can open its now-confirmed room',async t=>{
  const f=await fixture(t),a=await f.person('A');a.c.dispose();let failOnce=true;const sent=[];
  const c=f.client({storage:a.storage,fetch:async(url,options)=>{if(url.endsWith('/event/rooms')&&options.method==='POST'){sent.push({body:options.body,key:options.headers['Idempotency-Key']});const r=await fetch(url,options);if(failOnce){failOnce=false;throw Error('lost');}return r;}return fetch(url,options);}}).c;await c.connect();
  const payload=roomInput('Reviewed');const pending=c.createRoom(payload);payload.title='Changed after click';await assert.rejects(pending,e=>e.code==='NETWORK');
  const result=await c.createRoom(roomInput('Reviewed'));assert.equal(result.applied,true);assert.equal(c.getState().room.title,'Reviewed');assert.deepEqual(sent[0],sent[1]);await c.loadMyRooms();assert.equal(c.getState().myRooms.items.length,1);
});

test('departed guest keeps history immediately, across stale list reads and reload, without membership access',async t=>{
  const f=await fixture(t),host=await f.person('Host'),guest=await f.person('Guest'),room=(await host.c.createRoom(roomInput())).room;
  const shared=(await host.c.uploadPhoto(photoData().dataUrl,'members',{roomId:room.id})).photo;await joinRoom(guest.c,room);
  // No prior list fetch: leaving must insert the metadata already in the open room.
  assert.equal(guest.c.getState().myRooms.items.length,0);await guest.c.leaveRoom(room.id);
  assert.equal(guest.c.getState().myRooms.items.length,1);assert.equal(guest.c.getState().myRooms.items[0].joined,false);assert.equal(guest.c.getState().myRooms.items[0].role,'member');
  guest.c.dispose();const gate=deferred(),started=deferred();let hold=false;
  const restored=f.client({storage:guest.storage,fetch:async(url,options)=>{const r=await fetch(url,options);if(hold&&url.endsWith('/event/rooms')&&options.method==='GET'){hold=false;started.resolve();await gate.promise;}return r;}}).c;
  await restored.connect();await restored.loadMyRooms();assert.equal(restored.getState().myRooms.items[0].joined,false);
  await assert.rejects(restored.openRoom(room.id),e=>e.status===404);await assert.rejects(restored.fetchPhotoBlob(shared.id),e=>e.status===404);
  await joinRoom(restored,room);hold=true;const stale=restored.loadMyRooms();await started.promise;await restored.leaveRoom(room.id);gate.resolve();await stale;
  assert.equal(restored.getState().myRooms.items.length,1);assert.equal(restored.getState().myRooms.items[0].joined,false);
  await restored.loadMyRooms();assert.equal(restored.getState().myRooms.items[0].joined,false);await assert.rejects(restored.fetchPhotoBlob(shared.id),e=>e.status===404);
});


test('same verified identity stays ready during transport reconnect, while changed credentials require fresh verification',async t=>{
 const f=await fixture(t),a=await f.person('Reconnect A'),b=await f.person('Replacement B'),gate=deferred();let hold=false;
 const {c}=f.client({storage:a.storage,fetch:async(url,options)=>{if(hold&&url.endsWith('/health'))await gate.promise;return fetch(url,options);}});
 assert.equal(c.getState().identity.status,'unverified');await c.connect();await c.createRoom(roomInput());const id=c.getState().identity.user.id;
 hold=true;const same=c.connect();assert.equal(c.getState().identity.status,'ready');assert.equal(c.getState().identity.user.id,id);assert.ok(c.getState().room,'same-identity reconnect preserves selected room');gate.resolve();await same;
 a.storage.setItem(SESSION_KEY,b.storage.getItem(SESSION_KEY));await assert.rejects(c.connect(),e=>e.code==='IDENTITY_CHANGED');assert.equal(c.getState().identity.requiresReload,true);assert.equal(c.getState().room,null);const restored=f.client({storage:a.storage}).c;await restored.connect();assert.equal(restored.getState().identity.user.id,b.c.getState().identity.user.id);
});

test('late verified-session read cannot overwrite a different valid session installed while it was waiting',async t=>{
 const f=await fixture(t),a=await f.person('Old A'),other=await f.person('New C'),gate=deferred(),started=deferred();
 const c=f.client({storage:a.storage,fetch:async(url,options)=>{const response=await fetch(url,{...options,signal:undefined});if(url.endsWith('/avatar/session')&&options.method==='GET'){started.resolve();await gate.promise;}return response;}}).c;
 const reading=c.connect();await started.promise;a.storage.setItem(SESSION_KEY,other.storage.getItem(SESSION_KEY));gate.resolve();const result=await reading;
 assert.equal(result.applied,false);assert.equal(c.getState().identity.requiresReload,true);assert.equal(c.getState().identity.user,null);assert.deepEqual(c.getState().pending,[]);assert.equal(JSON.parse(a.storage.getItem(SESSION_KEY)).token,JSON.parse(other.storage.getItem(SESSION_KEY)).token);
 const next=f.client({storage:a.storage}).c;await next.connect();assert.equal(next.getState().identity.user.id,other.c.getState().identity.user.id);
});

test('changed credentials make pending profile writes inert locally and keep the original operation unavailable to the new identity',async t=>{
 const f=await fixture(t),a=await f.person('A'),other=await f.person('C'),original=JSON.parse(a.storage.getItem(SESSION_KEY)),gate=deferred(),started=deferred(),sent=[];
 const c=f.client({storage:a.storage,fetch:async(url,options)=>{const response=await fetch(url,{...options,signal:undefined});if(url.endsWith('/profile')&&options.method==='PUT'){sent.push({body:options.body,key:options.headers['Idempotency-Key'],authorization:options.headers.Authorization});started.resolve();await gate.promise;}return response;}}).c;
 await c.connect();const saving=c.saveProfile(profile('A chosen name'),{revision:c.getState().identity.user.revision});saving.catch(()=>{});await started.promise;const op=c.getState().pending[0];a.storage.setItem(SESSION_KEY,other.storage.getItem(SESSION_KEY));assert.equal(c.syncStoredIdentity(),true);assert.deepEqual(c.getState().pending,[]);assert.equal(c.getState().drafts.profile,null);gate.resolve();await assert.rejects(saving,e=>['ABORTED','IDENTITY_CHANGED'].includes(e.code));
 assert.equal(JSON.parse(a.storage.getItem(SESSION_KEY)).user.id,other.c.getState().identity.user.id);const durable=JSON.parse(a.storage.getItem(EVENT_STORAGE_KEY)).operations.find(p=>p.id===op.id);assert.ok(durable);assert.equal(durable.key,sent[0].key);
 const next=f.client({storage:a.storage}).c;await next.connect();assert.equal(next.reviewOperation(op.id),null);assert.equal(next.getState().drafts.profile.name,'C');await assert.rejects(next.retry(op.id),e=>e.code==='IDENTITY_CHANGED');assert.equal(sent.length,1);assert.equal(sent[0].authorization,`Bearer ${original.token}`);
});

test('late bootstrap result cannot replace a valid identity supplied by another tab',async t=>{
 const f=await fixture(t),other=await f.person('C'),storage=localStore(),gate=deferred(),started=deferred();
 const c=f.client({storage,fetch:async(url,options)=>{const response=await fetch(url,{...options,signal:undefined});if(url.endsWith('/avatar/session')&&options.method==='POST'){started.resolve();await gate.promise;}return response;}}).c;await c.connect();
 const creating=c.establishIdentity(profile('Pending A'));creating.catch(()=>{});await started.promise;storage.setItem(SESSION_KEY,other.storage.getItem(SESSION_KEY));gate.resolve();await assert.rejects(creating,e=>e.code==='IDENTITY_CHANGED');assert.equal(JSON.parse(storage.getItem(SESSION_KEY)).user.id,other.c.getState().identity.user.id);assert.equal(c.getState().identity.requiresReload,true);assert.equal(c.getState().pending.length,0);
});

test('a late private photo response is discarded after source credentials change even without a browser storage event',async t=>{
 const f=await fixture(t),a=await f.person('Photo A'),other=await f.person('Photo C'),room=(await a.c.createRoom(roomInput())).room,photo=(await a.c.uploadPhoto(photoData().dataUrl,'private',{roomId:room.id})).photo,gate=deferred(),started=deferred();
 const c=f.client({storage:a.storage,fetch:async(url,options)=>{const response=await fetch(url,{...options,signal:undefined});if(url.endsWith('/image')){started.resolve();await gate.promise;}return response;}}).c;await c.connect();const loading=c.fetchPhotoBlob(photo.id);loading.catch(()=>{});await started.promise;a.storage.setItem(SESSION_KEY,other.storage.getItem(SESSION_KEY));gate.resolve();await assert.rejects(loading,e=>e.code==='TARGET_CHANGED');assert.equal(c.getState().identity.requiresReload,true);assert.deepEqual(c.getState().photos,[]);
});

test('a late failed request and disposal never overwrite the replacement identity recovery store',async t=>{
 const f=await fixture(t),a=await f.person('A'),other=await f.person('C'),room=(await a.c.createRoom(roomInput())).room,gate=deferred(),started=deferred();
 const c=f.client({storage:a.storage,fetch:async(url,options)=>{if(url.endsWith('/photos')&&options.method==='POST'){started.resolve();await gate.promise;throw Error('synthetic delayed offline');}return fetch(url,options);}}).c;await c.connect();await c.openRoom(room.id);const sending=c.uploadPhoto(photoData().dataUrl,'private',{roomId:room.id});sending.catch(()=>{});await started.promise;
 const replacement=other.storage.getItem(EVENT_STORAGE_KEY);a.storage.setItem(SESSION_KEY,other.storage.getItem(SESSION_KEY));a.storage.setItem(EVENT_STORAGE_KEY,replacement);gate.resolve();await assert.rejects(sending);c.dispose();assert.equal(a.storage.getItem(EVENT_STORAGE_KEY),replacement);assert.equal(JSON.parse(a.storage.getItem(SESSION_KEY)).user.id,other.c.getState().identity.user.id);
});

test('event operation journal: same-identity tabs retain two committed uploads and exact keys after both responses are lost',async t=>{
 const f=await fixture(t),a=await f.person('Synthetic A'),one=(await a.c.createRoom(roomInput('First'))).room,two=(await a.c.createRoom(roomInput('Second'))).room;a.c.dispose();
 const sent=[];let lose=true;const transport=async(url,options)=>{const response=await fetch(url,options);if(options.method==='POST'&&url.endsWith('/photos')){sent.push({url,body:options.body,key:options.headers['Idempotency-Key']});if(lose)throw Error('Synthetic committed loss');}return response;};
 const c1=f.client({storage:a.storage,fetch:transport}).c,c2=f.client({storage:a.storage,fetch:transport}).c;await c1.connect();await c2.connect();await c1.openRoom(one.id);await c2.openRoom(two.id);
 await Promise.all([assert.rejects(c1.uploadPhoto(photoData().dataUrl,'private',{roomId:one.id})),assert.rejects(c2.uploadPhoto(photoData().dataUrl,'private',{roomId:two.id}))]);
 assert.equal(c1.getState().pending[0].durable,true);assert.equal(c2.getState().pending[0].durable,true);const oldBytes=a.storage.getItem(EVENT_STORAGE_KEY);c1.dispose();c2.dispose();
 const fresh=f.client({storage:a.storage,fetch:transport}).c;await fresh.connect();assert.equal(fresh.getState().pending.length,2);lose=false;
 fresh.setDraft('photo',{roomId:two.id,dataUrl:'New local selection',visibility:'private'});for(const op of fresh.getState().pending)await fresh.retry(op.id);assert.equal(fresh.getState().pending.length,0);
 assert.equal(fresh.getState().drafts.photo.dataUrl,'New local selection');await fresh.loadMyPhotos();assert.equal(fresh.getState().myPhotos.items.length,2);
 for(const original of sent.slice(0,2))assert.deepEqual(sent.find((row,i)=>i>=2&&row.url===original.url),original);
 const records=[...a.storage.entries].filter(([key])=>key.startsWith(EVENT_OPERATION_PREFIX)).map(([,bytes])=>JSON.parse(bytes));assert.ok(records.every(row=>row.done&&!row.operation&&!row.key&&!row.bodyJson));
 a.storage.setItem(EVENT_STORAGE_KEY,oldBytes);fresh.dispose();const again=f.client({storage:a.storage}).c;await again.connect();assert.equal(again.getState().pending.length,0,'an old whole-state snapshot cannot revive settled uploads');
});

test('event operation journal: unavailable durable storage prevents a new photo request and retains the selected draft',async t=>{
 const f=await fixture(t),a=await f.person('A'),room=(await a.c.createRoom(roomInput())).room;a.c.dispose();let posts=0;
 const c=f.client({storage:a.storage,fetch:(url,options)=>{if(options.method==='POST')posts++;return fetch(url,options);}}).c;await c.connect();await c.openRoom(room.id);const save=a.storage.setItem;a.storage.setItem=()=>{throw Error('Synthetic quota');};
 await assert.rejects(c.uploadPhoto(photoData().dataUrl,'private',{roomId:room.id}),e=>e.code==='STORAGE_REQUIRED');assert.equal(posts,0);assert.equal(c.getState().dirty.photo,true);assert.equal(c.getState().pending[0].durable,false);
 a.storage.setItem=save;await c.retry(c.getState().pending[0].id);assert.equal(posts,1);await c.loadMyPhotos();assert.equal(c.getState().myPhotos.items.length,1);
});
test('corner transport rejects unrelated paths and discards a response after stored identity is removed',async t=>{
 const f=await fixture(t),storage=localStore();let signal,release,pause=false;const started=new Promise(r=>signal=r),gate=new Promise(r=>release=r);const {c}=f.client({storage,fetch:async(...args)=>{const response=await fetch(...args);if(pause&&String(args[0]).endsWith('/api/event/corners')){signal();await gate;}return response;}});
 await c.connect();await c.establishIdentity(profile('Corner viewer'));
 await assert.rejects(c.cornerRequest('/social'),/路径/);await assert.rejects(c.cornerRequest('/corners',{blob:true}),/路径/);
 pause=true;const pending=c.cornerRequest('/corners');await started;storage.removeItem(SESSION_KEY);c.syncStoredIdentity();release();await assert.rejects(pending,e=>e.code==='TARGET_CHANGED');assert.equal(c.getState().identity.status,'lost');
});

// 「同一刻，另一面」 photo facts: uploadPhoto(..., { meta }) carries the four known facts, nothing else, into the saved draft and the request body.
const PHOTO_FACT_KEYS=['takenAt','takenSource','viewpoint','viewpointSource'];
const factsAgo=(ms=36e5)=>({takenAt:Math.floor((Date.now()-ms)/1000)*1000,takenSource:'exif',viewpoint:'crowd',viewpointSource:'ai'});
function recordPhotoPosts(sent,{beforeReturn}={}){return async(url,options)=>{if(!(url.endsWith('/photos')&&options.method==='POST'))return fetch(url,options);sent.push({body:options.body,key:options.headers['Idempotency-Key']});const response=await fetch(url,options);if(beforeReturn?.())throw Error('synthetic lost response');return response;};}

test('uploadPhoto meta puts only the known, non-null photo facts into the draft and the request body, in a fixed order',async t=>{
  const f=await fixture(t),a=await f.person('A'),room=(await a.c.createRoom(roomInput())).room;a.c.dispose();const sent=[],facts=factsAgo(),lose=[true];
  const c=f.client({storage:a.storage,fetch:recordPhotoPosts(sent,{beforeReturn:()=>lose.shift()})}).c;await c.connect();await c.openRoom(room.id);
  // Keys out of order, one unknown key and one file-time-like key: only the four facts survive, in the canonical order.
  const meta={viewpointSource:facts.viewpointSource,unknown:'x',viewpoint:facts.viewpoint,takenSource:facts.takenSource,mtime:123,takenAt:facts.takenAt};
  await assert.rejects(c.uploadPhoto(photoData().dataUrl,'members',{roomId:room.id,meta}),e=>e.code==='NETWORK'&&e.uncertain);
  const draft=c.getState().drafts.photo;assert.deepEqual(draft,{roomId:room.id,dataUrl:photoData().dataUrl,visibility:'members',...facts});assert.deepEqual(Object.keys(draft),['roomId','dataUrl','visibility',...PHOTO_FACT_KEYS]);
  assert.deepEqual(Object.keys(JSON.parse(sent[0].body)),['dataUrl','visibility',...PHOTO_FACT_KEYS]);assert.deepEqual(JSON.parse(sent[0].body),{dataUrl:photoData().dataUrl,visibility:'members',...facts});
  assert.equal(c.getState().dirty.photo,true);const op=c.getState().pending[0];assert.equal(op.status,'uncertain');assert.equal(op.durable,true);
  const saved=JSON.parse(a.storage.getItem(EVENT_STORAGE_KEY));assert.equal(saved.operations[0].bodyJson,sent[0].body);assert.deepEqual(saved.drafts.photo,draft);
  // The retry replays the identical body under the identical key; the server answers from its receipt and keeps one photo with the facts.
  const result=await c.retry(op.id);assert.equal(sent.length,2);assert.equal(sent[1].body,sent[0].body);assert.equal(sent[1].key,sent[0].key);
  assert.deepEqual(PHOTO_FACT_KEYS.map(key=>result.photo[key]),PHOTO_FACT_KEYS.map(key=>facts[key]));
  assert.equal(c.getState().pending.length,0);assert.equal(c.getState().dirty.photo,false,'a submitted draft that carries facts is recognised as submitted');
  await c.loadMyPhotos();assert.equal(c.getState().myPhotos.items.length,1);assert.deepEqual(PHOTO_FACT_KEYS.map(key=>c.getState().myPhotos.items[0][key]),PHOTO_FACT_KEYS.map(key=>facts[key]));
  assert.deepEqual(PHOTO_FACT_KEYS.map(key=>c.getState().photos[0][key]),PHOTO_FACT_KEYS.map(key=>facts[key]));
});

test('a lost upload response with facts is retried from a fresh controller with the same stored bodyJson and key',async t=>{
  const f=await fixture(t),a=await f.person('A'),room=(await a.c.createRoom(roomInput())).room;a.c.dispose();const sent=[],facts=factsAgo(90*60_000),lose=[true];
  const transport=recordPhotoPosts(sent,{beforeReturn:()=>lose.shift()});
  const first=f.client({storage:a.storage,fetch:transport}).c;await first.connect();await first.openRoom(room.id);
  await assert.rejects(first.uploadPhoto(photoData().dataUrl,'private',{roomId:room.id,meta:facts}),e=>e.uncertain);const id=first.getState().pending[0].id;first.dispose();
  const restored=f.client({storage:a.storage,fetch:transport}).c;await restored.connect();assert.equal(restored.getState().pending.length,1);
  assert.deepEqual(JSON.parse(JSON.parse(a.storage.getItem(EVENT_STORAGE_KEY)).operations[0].bodyJson),{dataUrl:photoData().dataUrl,visibility:'private',...facts});
  const result=await restored.retry(id);assert.deepEqual(sent[1],sent[0]);assert.equal(result.photo.takenAt,facts.takenAt);assert.equal(result.photo.viewpointSource,'ai');
  await restored.loadMyPhotos();assert.equal(restored.getState().myPhotos.items.length,1);assert.equal(restored.getState().myPhotos.items[0].takenSource,'exif');
});

test('uploadPhoto without meta, with empty meta or with only null/undefined facts keeps the original body and draft exactly',async t=>{
  const f=await fixture(t),a=await f.person('A'),room=(await a.c.createRoom(roomInput())).room;a.c.dispose();const sent=[];
  const c=f.client({storage:a.storage,fetch:recordPhotoPosts(sent)}).c;await c.connect();await c.openRoom(room.id);const original={dataUrl:photoData().dataUrl,visibility:'private'};
  for(const options of [{roomId:room.id},{roomId:room.id,meta:undefined},{roomId:room.id,meta:null},{roomId:room.id,meta:{}},{roomId:room.id,meta:{takenAt:null,takenSource:undefined,viewpoint:null,viewpointSource:undefined,mtime:5}}]){
    sent.length=0;const result=await c.uploadPhoto(photoData().dataUrl,'private',options);
    assert.equal(sent[0].body,JSON.stringify(original));assert.deepEqual(c.getState().drafts.photo,{roomId:room.id,...original});assert.equal(c.getState().dirty.photo,false);
    assert.deepEqual(PHOTO_FACT_KEYS.map(key=>result.photo[key]),[null,null,null,null]);
    await c.removePhoto(result.photo.id,{revision:1});
  }
  // A half-known set is passed as given (the server decides): a viewpoint pair alone is a complete pair, a time alone is not.
  sent.length=0;const pair={takenAt:null,viewpoint:'detail',viewpointSource:'manual'};const one=await c.uploadPhoto(photoData().dataUrl,'private',{roomId:room.id,meta:pair});
  assert.deepEqual(Object.keys(JSON.parse(sent[0].body)),['dataUrl','visibility','viewpoint','viewpointSource']);assert.deepEqual(PHOTO_FACT_KEYS.map(key=>one.photo[key]),[null,null,'detail','manual']);
  await assert.rejects(c.uploadPhoto(photoData().dataUrl,'private',{roomId:room.id,meta:{takenAt:factsAgo().takenAt}}),e=>e.status===400&&e.code==='INVALID_INPUT'&&!e.retryable&&!e.uncertain);
  assert.equal(c.getState().pending[0].status,'failed');assert.equal(c.getState().dirty.photo,true);
});

test('different photo facts are different operations, so a changed viewpoint never reuses the first request key',async t=>{
  const f=await fixture(t),a=await f.person('A'),room=(await a.c.createRoom(roomInput())).room;a.c.dispose();const sent=[];let drop=true;
  const c=f.client({storage:a.storage,fetch:recordPhotoPosts(sent,{beforeReturn:()=>{const lost=drop;drop=false;return lost;}})}).c;await c.connect();await c.openRoom(room.id);
  const facts=factsAgo();await assert.rejects(c.uploadPhoto(photoData().dataUrl,'private',{roomId:room.id,meta:facts}),e=>e.uncertain);
  const changed=await c.uploadPhoto(photoData().dataUrl,'private',{roomId:room.id,meta:{...facts,viewpoint:'stage',viewpointSource:'manual'}});
  assert.notEqual(sent[1].key,sent[0].key);assert.equal(JSON.parse(sent[1].body).viewpoint,'stage');assert.equal(changed.photo.viewpointSource,'manual');
  assert.equal(c.getState().pending.length,1,'the first, unconfirmed upload is still its own pending operation');
});
