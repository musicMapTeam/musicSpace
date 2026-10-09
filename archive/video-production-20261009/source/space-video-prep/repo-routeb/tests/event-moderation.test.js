import { removeTempAfterTests } from './helpers/temp-directory.js';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {createEventStore} from '../server/event-store.js';
import {createAvatarApi} from '../server/avatar-api.js';
import {createEventApi} from '../server/event-api.js';
import {createAvatarWorker} from '../runtime-preview/src/avatar-worker.js';
import {createEventWorker} from '../runtime-preview/src/event-worker.js';
import {createFakeEnv} from '../runtime-preview/tests/d1-adapter.mjs';
import {photoData} from './event-contract.test.js';

const ok=(r,status=200)=>{assert.equal(r.status,status,JSON.stringify(r.body));return r.body;};
const deferred=()=>{let resolve;const promise=new Promise(done=>resolve=done);return{promise,resolve};};
async function fixture(t,mode='Worker',{rateLimits=false}={}){
 const dir=await mkdtemp(join(tmpdir(),'space-moderation-'));let env,avatar,event,server,baseUrl;
 const clock=()=>Date.parse('2026-10-01T08:30:00Z');
 async function start(){if(mode==='Worker'){env=createFakeEnv(join(dir,'events.sqlite'),{clock});return;}
  avatar=createAvatarApi({dataDir:dir,clock,rateLimits:false});event=createEventApi({dataDir:dir,clock,rateLimits});server=createServer(async(req,res)=>{if(!await event(req,res)&&!await avatar(req,res)){res.writeHead(404);res.end();}});server.listen(0,'127.0.0.1');await once(server,'listening');baseUrl=`http://127.0.0.1:${server.address().port}`;
 }
 async function stop(){if(mode==='Worker')env.DB.close();else{server.closeAllConnections();await new Promise(done=>server.close(done));avatar.close();event.close();}}
 await start();t.after(async()=>{await stop();await removeTempAfterTests(dir);});
 const f={get env(){return env;},restart:async()=>{await stop();await start();},async request(path,{token,data,method=data?'POST':'GET',key=randomUUID()}={}){
  const full=path.startsWith('/api/')?path:'/api/event'+path,options={method,headers:{...(token?{Authorization:`Bearer ${token}`}:{ }),...(data?{'Content-Type':'application/json','Idempotency-Key':key}:{} )},...(data?{body:JSON.stringify(data)}:{})};
  const r=mode==='Node'?await fetch(baseUrl+full,options):await(full.startsWith('/api/avatar')?createAvatarWorker({clock,rateLimits:false}):createEventWorker({clock,rateLimits})).fetch(new Request('https://synthetic-space.test'+full,options),env);
  const bytes=Buffer.from(await r.arrayBuffer());return{status:r.status,headers:r.headers,body:r.headers.get('Content-Type')?.includes('json')?JSON.parse(bytes):null,bytes};
 }};
 f.session=async name=>ok(await f.request('/api/avatar/session',{data:{name}}),201);
 f.room=async actor=>ok(await f.request('/rooms',{token:actor.token,data:{title:'合成管理测试',venue:'合成现场',songId:'late-train',joinConsent:true,participation:'open'}}),201).room;
 f.join=(r,a,opts={})=>f.request(`/rooms/${r.code}/join`,{token:a.token,data:{joinConsent:true,participation:'open'},...opts});
 f.leave=(r,a)=>f.request(`/rooms/${r.id}/leave`,{token:a.token,data:{}});
 f.upload=async(r,a,visibility='private')=>ok(await f.request(`/rooms/${r.id}/photos`,{token:a.token,data:{...photoData(),visibility}}),201).photo;
 f.wall=(p,a,visibility)=>f.request(`/photos/${p.id}`,{token:a.token,method:'PATCH',data:{visibility,revision:p.revision}});
 f.report=(r,a,target,photoId=null,options={})=>f.request(`/rooms/${r.id}/reports`,{token:a.token,data:{targetId:target.user.id,photoId,category:'spam',details:'合成测试：现场重复张贴。',reportConsent:true},...options});
 f.remove=(r,h,target,data)=>f.request(`/rooms/${r.id}/exclusions/${target.user.id}`,{token:h.token,data:{removalConsent:true,...data}});
 f.state=(r,a)=>f.request(`/rooms/${r.id}`,{token:a.token});
 f.image=(p,a)=>f.request(`/photos/${p.id}/image`,{token:a.token});
 f.group=async()=>{const h=await f.session('Host'),a=await f.session('Reporter'),b=await f.session('Target'),c=await f.session('Outside'),room=await f.room(h);ok(await f.join(room,a));ok(await f.join(room,b));const photo=await f.upload(room,b,'members'),privatePhoto=await f.upload(room,b);return{h,a,b,c,room,photo,privatePhoto};};
 return f;
}

for(const mode of['Node','Worker']){
 test(`${mode} moderation: explicit scoped feedback, host-only handling and no reporter identity or media grant`,async t=>{
  const f=await fixture(t,mode),{h,a,b,c,room,photo,privatePhoto}=await f.group();
  const report=ok(await f.report(room,a,b,photo.id),201).report;assert.equal(report.targetId,b.user.id);assert.equal(report.photoId,photo.id);assert.equal(report.status,'open');assert.equal(report.reporterId,undefined);
  assert.equal((await f.request(`/reports/${report.id}`,{token:b.token})).status,404);assert.equal((await f.request(`/reports/${report.id}`,{token:c.token})).status,404);
  assert.equal((await f.request(`/rooms/${room.id}/moderation`,{token:a.token})).status,404);
  const host=ok(await f.request(`/rooms/${room.id}/moderation`,{token:h.token}));assert.equal(host.reports.items.length,1);assert.ok(!JSON.stringify(host).includes(a.user.id));assert.ok(!JSON.stringify(host).includes('imageUrl'));
  assert.equal((await f.image(privatePhoto,h)).status,404);ok(await f.wall(photo,b,'private'));assert.equal((await f.image(photo,h)).status,404);
  ok(await f.leave(room,h));assert.equal((await f.state(room,h)).status,404);assert.equal(ok(await f.request(`/rooms/${room.id}/moderation`,{token:h.token})).reports.items.length,1,'departed host gets management metadata only');
  const changed=ok(await f.request('/api/avatar/profile',{token:b.token,method:'PUT',data:{name:'Renamed',avatar:b.user.avatar,revision:1}})).user;
  assert.equal(changed.name,'Renamed');assert.equal(ok(await f.request(`/reports/${report.id}`,{token:h.token})).report.targetName,'Target');
  assert.equal(ok(await f.request('/reports',{token:a.token})).reports.items.length,1);assert.equal(ok(await f.request('/reports',{token:c.token})).reports.items.length,0);
 });
 test(`${mode} moderation: rejects missing consent, forged scope, private content, self and host-as-neutral-review`,async t=>{
  const f=await fixture(t,mode),{h,a,b,c,room,photo,privatePhoto}=await f.group(),other=await f.room(h);
  for(const change of[{reportConsent:false},{reportConsent:undefined},{reporterId:c.user.id},{details:''},{details:'x'.repeat(281)},{category:'unbounded'}])assert.equal((await f.report(room,a,b,photo.id,{data:{targetId:b.user.id,photoId:photo.id,category:'spam',details:'合成反馈',reportConsent:true,...change}})).status,400);
  assert.equal((await f.report(room,a,a)).status,400);assert.equal((await f.report(room,a,h)).status,409);
  assert.equal((await f.report(room,a,b,privatePhoto.id)).status,404);assert.equal((await f.report(other,a,b,photo.id)).status,404);assert.equal((await f.report(room,c,b,photo.id)).status,404);
  const first=ok(await f.report(room,a,b),201).report;assert.equal((await f.report(room,a,b,photo.id)).status,409);
  assert.equal((await f.request(`/reports/${first.id}/withdraw`,{token:h.token,data:{revision:1}})).status,403);
  assert.equal((await f.request(`/reports/${first.id}/resolve`,{token:a.token,data:{revision:1,resolution:'dismissed'}})).status,404);
  assert.equal((await f.request(`/reports/${first.id}/resolve`,{token:h.token,data:{revision:1,resolution:'removed'}})).status,400);
  ok(await f.request(`/reports/${first.id}/withdraw`,{token:a.token,data:{revision:1}}));assert.equal(ok(await f.request(`/reports/${first.id}`,{token:h.token})).report.status,'withdrawn');
  const second=ok(await f.report(room,a,b),201).report;ok(await f.request(`/reports/${second.id}/resolve`,{token:h.token,data:{revision:1,resolution:'dismissed'}}));assert.equal(ok(await f.request(`/reports/${second.id}`,{token:a.token})).report.status,'dismissed');
  assert.equal((await f.state(room,b)).status,200,'closing feedback is not fake exclusion');
 });
 test(`${mode} moderation: removal preserves originals/history, stops room sharing/reentry and restoration never auto-joins`,async t=>{
  const f=await fixture(t,mode),{h,a,b,room,photo}=await f.group(),report=ok(await f.report(room,a,b,photo.id),201).report;
  const result=ok(await f.remove(room,h,b,{reportId:report.id,reportRevision:1}));assert.equal(result.report.status,'resolved');assert.equal(result.exclusion.active,true);
  assert.equal((await f.state(room,b)).status,404);assert.equal((await f.image(photo,a)).status,404);ok(await f.image(photo,b));
  assert.equal((await f.join(room,b)).status,403);assert.equal((await f.request(`/rooms/${room.id}/photos`,{token:b.token,data:{...photoData(),visibility:'members'}})).status,404);
  const history=ok(await f.request('/rooms',{token:b.token})).rooms.find(r=>r.id===room.id);assert.equal(history.joined,false);assert.equal(history.entryState,'removed');
  await f.restart();assert.equal((await f.join(room,b)).status,403);
  assert.equal((await f.request(`/rooms/${room.id}/exclusions/${b.user.id}`,{token:a.token,method:'DELETE',data:{revision:1,allowReentryConsent:true}})).status,404);
  ok(await f.request(`/rooms/${room.id}/exclusions/${b.user.id}`,{token:h.token,method:'DELETE',data:{revision:1,allowReentryConsent:true}}));
  assert.equal((await f.state(room,b)).status,404);assert.equal((await f.image(photo,a)).status,404);ok(await f.join(room,b));
  assert.equal((await f.image(photo,a)).status,404,'old wall publication is not restored');assert.equal(ok(await f.request(`/reports/${report.id}`,{token:a.token})).report.status,'resolved');
 });
 test(`${mode} moderation: host removal is role-bound and uses the reviewed current membership`,async t=>{
  const f=await fixture(t,mode),{h,a,b,room}=await f.group(),snapshot=ok(await f.state(room,h)),member=snapshot.members.find(m=>m.id===b.user.id);
  assert.equal((await f.remove(room,a,b,{membershipJoinedAt:member.joinedAt})).status,404);assert.equal((await f.remove(room,h,h,{membershipJoinedAt:member.joinedAt})).status,400);
  assert.equal((await f.remove(room,h,b,{membershipJoinedAt:'different'})).status,409);assert.equal((await f.remove(room,h,b,{membershipJoinedAt:member.joinedAt,removalConsent:false})).status,400);
  ok(await f.remove(room,h,b,{membershipJoinedAt:member.joinedAt}));assert.equal((await f.state(room,b)).status,404);
 });
 test(`${mode} moderation: exact request replay does not duplicate reports or reapply a removed membership`,async t=>{
  const f=await fixture(t,mode),{h,a,b,room}=await f.group(),joinKey=randomUUID();ok(await f.leave(room,b));ok(await f.join(room,b,{key:joinKey}));
  const key=randomUUID(),first=ok(await f.report(room,a,b,null,{key}),201).report,replayed=ok(await f.report(room,a,b,null,{key}),201).report;assert.equal(replayed.id,first.id);
  ok(await f.remove(room,h,b,{reportId:first.id,reportRevision:1}));ok(await f.join(room,b,{key:joinKey}));assert.equal((await f.state(room,b)).status,404,'historical successful receipt cannot restore membership');
  for(const path of['/reports?unknown=1',`/reports?cursor=${first.id}&cursor=${first.id}`,`/rooms/${room.id}/moderation?cursor=${first.id}`])assert.equal((await f.request(path,{token:h.token})).status,400);
 });
 test(`${mode} moderation: removal cancels pending exchanges but preserves independently accepted exact-photo grants`,async t=>{
  const f=await fixture(t,mode),{h,a,b,room,photo}=await f.group(),offer=await f.upload(room,a),report=ok(await f.report(room,a,b,photo.id),201).report;
  const send=async(p,q)=>ok(await f.request(`/rooms/${room.id}/exchanges`,{token:a.token,data:{recipientId:b.user.id,offeredPhotoId:p.id,requestedPhotoId:q.id,offeredRevision:p.revision,requestedRevision:q.revision,offerPreviewConsent:true,offerOriginalConsent:true,offeredPreviewDataUrl:photoData().dataUrl}}),201).exchange;
  const accepted=await send(offer,photo);ok(await f.request(`/exchanges/${accepted.id}/accept`,{token:b.token,data:{revision:1,exchangeConsent:true}}));
  const nextOffer=await f.upload(room,a),nextTarget=await f.upload(room,b,'members'),pending=await send(nextOffer,nextTarget);
  ok(await f.remove(room,h,b,{reportId:report.id,reportRevision:1}));
  assert.equal(ok(await f.request(`/exchanges/${pending.id}`,{token:a.token})).exchange.status,'cancelled');assert.equal((await f.request(`/exchanges/${pending.id}/preview`,{token:a.token})).status,404);
  assert.equal(ok(await f.request(`/exchanges/${accepted.id}`,{token:a.token})).exchange.status,'accepted');ok(await f.request(`/exchanges/${accepted.id}/photos/${photo.id}/image`,{token:a.token}));ok(await f.request(`/exchanges/${accepted.id}/photos/${offer.id}/image`,{token:b.token}));
  assert.equal((await f.image(photo,a)).status,404);assert.equal((await f.request(`/exchanges/${accepted.id}/photos/${photo.id}/image`,{token:h.token})).status,404,'host gains no private exchange access');
 });
}

test('Worker moderation: report guard rejects content withdrawn while its transaction is delayed',async t=>{
 const f=await fixture(t),{a,b,room,photo}=await f.group(),started=deferred(),gate=deferred(),batch=f.env.DB.batch.bind(f.env.DB);let hold=true;
 f.env.DB.batch=async statements=>{if(hold&&statements.some(s=>s.query.startsWith('INSERT INTO event_reports'))){hold=false;started.resolve();await gate.promise;}return batch(statements);};
 const pending=f.report(room,a,b,photo.id);await started.promise;ok(await f.wall(photo,b,'private'));gate.resolve();assert.equal((await pending).status,409);assert.equal(ok(await f.request('/reports',{token:a.token})).reports.items.length,0);
});

test('Worker moderation: removal wins over a waiting rejoin and an old response cannot grant room access',async t=>{
 const f=await fixture(t),{h,a,b,room}=await f.group(),report=ok(await f.report(room,a,b),201).report;ok(await f.leave(room,b));
 const started=deferred(),gate=deferred(),batch=f.env.DB.batch.bind(f.env.DB);let hold=true;
 f.env.DB.batch=async statements=>{if(hold&&statements.some(s=>s.query.startsWith('INSERT INTO event_members'))){hold=false;started.resolve();await gate.promise;}return batch(statements);};
 const pending=f.join(room,b);await started.promise;ok(await f.remove(room,h,b,{reportId:report.id,reportRevision:1}));gate.resolve();assert.equal((await pending).status,409);assert.equal((await f.state(room,b)).status,404);
});

test('Worker moderation: upload storage delay cannot publish a removed member photo',async t=>{
 const f=await fixture(t),{h,a,b,room}=await f.group(),report=ok(await f.report(room,a,b),201).report,started=deferred(),gate=deferred(),put=f.env.PHOTOS.put.bind(f.env.PHOTOS);let hold=true;const initial=f.env.PHOTOS.blobs.size;
 f.env.PHOTOS.put=async(...args)=>{await put(...args);if(hold){hold=false;started.resolve();await gate.promise;}};
 const pending=f.request(`/rooms/${room.id}/photos`,{token:b.token,data:{...photoData(),visibility:'members'}});await started.promise;ok(await f.remove(room,h,b,{reportId:report.id,reportRevision:1}));gate.resolve();assert.equal((await pending).status,409);assert.equal(f.env.PHOTOS.blobs.size,initial);
});

test('Worker moderation: report withdrawal and host resolution are mutually exclusive in either transaction order',async t=>{
 for(const first of['withdraw','resolve']){
  const f=await fixture(t),{h,a,b,room}=await f.group(),report=ok(await f.report(room,a,b),201).report,started=deferred(),gate=deferred(),batch=f.env.DB.batch.bind(f.env.DB);let hold=true;
  f.env.DB.batch=async statements=>{if(hold&&statements.some(s=>s.query.startsWith('UPDATE event_reports SET status = ?'))){hold=false;started.resolve();await gate.promise;}return batch(statements);};
  const run=action=>f.request(`/reports/${report.id}/${action}`,{token:action==='withdraw'?a.token:h.token,data:{revision:1,...(action==='resolve'?{resolution:'dismissed'}:{})}}),later=first==='withdraw'?'resolve':'withdraw';
  const waiting=run(later);await started.promise;ok(await run(first));gate.resolve();assert.equal((await waiting).status,409);assert.equal(ok(await f.request(`/reports/${report.id}`,{token:a.token})).report.status,first==='withdraw'?'withdrawn':'dismissed');
 }
});

test('Worker moderation: report and exclusion pagination use bounded owned cursors without leaking reporter fields',async t=>{
 const f=await fixture(t),{h,a,b,c,room}=await f.group(),db=f.env.DB.sql;
 for(let i=0;i<29;i++){
  const id=randomUUID(),target=randomUUID(),time=new Date(Date.parse('2026-10-01T08:00:00Z')+i*1000).toISOString();
  db.prepare('INSERT INTO avatar_users (id,name,avatar,token_hash,revision,created_at) VALUES (?,?,?,?,1,?)').run(target,'Synthetic historical target','{}',randomUUID(),time);
  db.prepare("INSERT INTO event_reports (id,room_id,reporter_id,target_id,target_name,category,details,status,revision,created_at,updated_at,resolved_at) VALUES (?,?,?,?,'Synthetic target','spam','Synthetic pagination','dismissed',2,?,?,?)").run(id,room.id,a.user.id,target,time,time,time);
  db.prepare("INSERT INTO event_room_exclusions (room_id,user_id,target_name,revision,created_at,updated_at) VALUES (?,?,'Synthetic historical target',1,?,?)").run(room.id,target,time,time);
 }
 for(const [route,kind,token]of[[`/rooms/${room.id}/moderation/reports`,'reports',h.token],[`/rooms/${room.id}/moderation/exclusions`,'exclusions',h.token],['/reports','reports',a.token]]){
  const first=ok(await f.request(route,{token}))[kind];assert.equal(first.items.length,24);const second=ok(await f.request(route+'?cursor='+first.nextCursor,{token}))[kind];assert.equal(second.items.length,5);assert.equal(second.nextCursor,null);
  const ids=[...first.items,...second.items].map(x=>x.id||x.userId);assert.equal(new Set(ids).size,29);if(token===h.token)assert.ok(!JSON.stringify([first,second]).includes(a.user.id));
 }
 const foreign=await f.room(c);assert.equal((await f.request(`/rooms/${room.id}/moderation/exclusions?cursor=${b.user.id}`,{token:h.token})).status,400);assert.equal((await f.request(`/rooms/${room.id}/moderation/reports`,{token:c.token})).status,404);assert.equal(ok(await f.request(`/rooms/${foreign.id}/moderation`,{token:c.token})).reports.items.length,0);
});

test('Worker moderation: exclusion/photo/report transaction rolls back entirely on database failure',async t=>{
 const f=await fixture(t),{h,a,b,room,photo}=await f.group(),report=ok(await f.report(room,a,b,photo.id),201).report;
 f.env.DB.sql.exec("CREATE TRIGGER synthetic_moderation_failure BEFORE UPDATE ON event_photos BEGIN SELECT RAISE(ABORT,'synthetic storage failure'); END");
 assert.equal((await f.remove(room,h,b,{reportId:report.id,reportRevision:1})).status,503);
 assert.equal(ok(await f.request(`/reports/${report.id}`,{token:a.token})).report.status,'open');assert.equal(ok(await f.request(`/rooms/${room.id}/moderation`,{token:h.token})).exclusions.items.length,0);ok(await f.state(room,b));ok(await f.image(photo,a));
 f.env.DB.sql.exec('DROP TRIGGER synthetic_moderation_failure');ok(await f.remove(room,h,b,{reportId:report.id,reportRevision:1}));assert.equal((await f.state(room,b)).status,404);
});

test('Moderation0005 is additive and preserves existing identities/photos/exchanges over two local starts',async t=>{
 const dir=await mkdtemp(join(tmpdir(),'space-moderation-upgrade-')),file=join(dir,'old.sqlite');t.after(()=>removeTempAfterTests(dir));const db=new DatabaseSync(file);
 for(const name of['0000_known_colonel_america.sql','0001_event_rooms.sql','0002_event_social.sql','0003_event_chat.sql','0004_event_exchanges.sql'])db.exec(await readFile(new URL('../runtime-preview/drizzle/'+name,import.meta.url),'utf8'));
 for(const id of['old-a','old-b'])db.prepare('INSERT INTO avatar_users (id,name,avatar,token_hash,revision,created_at) VALUES (?,?,?,?,9,?)').run(id,'Existing','{}',id+'-opaque','old-date');
 db.prepare('INSERT INTO event_rooms (id,code,host_id,title,venue,song_id,created_at,expires_at) VALUES (?,?,?,?,?,?,?,?)').run('old-room','OLD','old-a','Existing room','','late-train','old-date','later');
 for(const [id,owner]of[['a-photo','old-a'],['b-photo','old-b']])db.prepare("INSERT INTO event_photos (id,room_id,owner_id,photo_key,visibility,revision,created_at,updated_at) VALUES (?,'old-room',?,?,'private',4,'old-date','old-date')").run(id,owner,id+'-private-key');
 db.prepare("INSERT INTO event_exchanges (id,room_id,sender_id,recipient_id,offered_photo_id,requested_photo_id,offered_revision,requested_revision,low_id,high_id,low_photo_id,high_photo_id,sender_profile,recipient_profile,preview_key,status,revision,created_at,updated_at,expires_at,accepted_at) VALUES ('old-exchange','old-room','old-a','old-b','a-photo','b-photo',4,4,'old-a','old-b','a-photo','b-photo','{}','{}','old-preview','accepted',2,'old-date','old-date','later','old-date')").run();
 for(const [photo,owner,viewer]of[['a-photo','old-a','old-b'],['b-photo','old-b','old-a']])db.prepare("INSERT INTO event_exchange_grants (exchange_id,photo_id,owner_id,viewer_id,created_at) VALUES ('old-exchange',?,?,?,'old-date')").run(photo,owner,viewer);
 const tables=['avatar_users','event_rooms','event_photos','event_exchanges','event_exchange_grants'],before=tables.map(name=>db.prepare('SELECT * FROM '+name).all());db.close();
 for(let i=0;i<2;i++)createEventStore({databasePath:file}).close();const read=new DatabaseSync(file);try{
  // Migration 0013 only appends four nullable photo-fact columns: every old value is unchanged and the old photos read them as null.
  const plain=rows=>JSON.parse(JSON.stringify(rows)),photoFacts={taken_at:null,taken_source:null,viewpoint:null,viewpoint_source:null};
  assert.deepEqual(plain(tables.map(name=>read.prepare('SELECT * FROM '+name).all())),plain(before).map((rows,index)=>tables[index]==='event_photos'?rows.map(row=>({...row,...photoFacts})):rows));
  assert.ok(read.prepare('SELECT name FROM _node_event_migrations').all().some(row=>row.name==='0013_event_photo_moment.sql'));
  for(const name of['event_reports','event_room_exclusions'])assert.equal(read.prepare('SELECT COUNT(*) AS n FROM '+name).get().n,0);assert.deepEqual(read.prepare('PRAGMA foreign_key_check').all(),[]);}finally{read.close();}
});

test('Worker moderation: feedback rate limits survive restart without blocking exact successful receipt replay',async t=>{
 const f=await fixture(t,'Worker',{rateLimits:true}),{a,room}=await f.group();let firstTarget,firstId;const firstKey=randomUUID();
 for(let i=0;i<6;i++){
  const target=await f.session('Synthetic'+i);ok(await f.join(room,target));const response=await f.report(room,a,target,null,i===0?{key:firstKey}:{});
  if(i<5){const report=ok(response,201).report;if(i===0){firstTarget=target;firstId=report.id;}}else assert.equal(response.status,429);
 }
 await f.restart();assert.equal(ok(await f.report(room,a,firstTarget,null,{key:firstKey}),201).report.id,firstId);
 const another=await f.session('Synthetic later');ok(await f.join(room,another));assert.equal((await f.report(room,a,another)).status,429);
});
