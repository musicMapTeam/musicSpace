import { removeTempAfterTests } from './helpers/temp-directory.js';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createAvatarApi} from '../server/avatar-api.js';
import {createEventApi} from '../server/event-api.js';
import {createModerationController,MODERATION_STORAGE_PREFIX} from '../web/event-client/moderation-controller.js';

const SESSION_KEY='music-space-avatar-session:v1';
const store=()=>{const map=new Map();return{get length(){return map.size;},key:i=>[...map.keys()][i]??null,getItem:key=>map.get(key)??null,setItem:(key,value)=>map.set(key,String(value)),removeItem:key=>map.delete(key)};};
const deferred=()=>{let resolve;const promise=new Promise(done=>resolve=done);return{promise,resolve};};
async function fixture(t){
 const dir=await mkdtemp(join(tmpdir(),'space-mod-client-')),avatar=createAvatarApi({dataDir:dir,rateLimits:false}),event=createEventApi({dataDir:dir,rateLimits:false}),clients=[];
 const server=createServer(async(req,res)=>{if(!await event(req,res)&&!await avatar(req,res)){res.writeHead(404);res.end();}});server.listen(0,'127.0.0.1');await once(server,'listening');const baseUrl=`http://127.0.0.1:${server.address().port}`;
 t.after(async()=>{clients.forEach(c=>c.dispose());server.closeAllConnections();await new Promise(done=>server.close(done));avatar.close();event.close();await removeTempAfterTests(dir);});
 const request=async(path,token,data,method=data?'POST':'GET')=>{const response=await fetch(baseUrl+(path.startsWith('/api/')?path:'/api/event'+path),{method,headers:{...(token?{Authorization:`Bearer ${token}`}:{ }),...(data?{'Content-Type':'application/json','Idempotency-Key':crypto.randomUUID()}:{} )},...(data?{body:JSON.stringify(data)}:{})});const body=await response.json();assert.ok(response.ok,JSON.stringify(body));return body;};
 const h=await request('/api/avatar/session',null,{name:'Host'}),a=await request('/api/avatar/session',null,{name:'Reporter'}),b=await request('/api/avatar/session',null,{name:'Target'}),room=(await request('/rooms',h.token,{title:'Synthetic management',venue:'Synthetic venue',songId:'late-train',joinConsent:true,participation:'open'})).room;
 for(const actor of[a,b])await request(`/rooms/${room.code}/join`,actor.token,{joinConsent:true,participation:'open'});
 return{h,a,b,room,request,payload:{targetId:b.user.id,photoId:null,category:'spam',details:'Synthetic feedback only',reportConsent:true},client(actor,{storage=store(),...options}={}){if(actor)storage.setItem(SESSION_KEY,JSON.stringify(actor));const c=createModerationController({storage,baseUrl,timeoutMs:2000,...options});clients.push(c);return{c,storage};}};
}

test('moderation client: explicit feedback, canonical host removal, independent reports and restored application only',async t=>{
 const f=await fixture(t);let calls=0;const aa=f.client(f.a,{fetch:(...args)=>{calls++;return fetch(...args);}}),hh=f.client(f.h);
 assert.equal(calls,0);assert.throws(()=>aa.c.submitReport(f.room.id,{...f.payload,reportConsent:false}),e=>e.code==='REPORT_CONSENT_REQUIRED');
 const submitted=await aa.c.submitReport(f.room.id,f.payload,'Target');assert.equal(submitted.currentConfirmed,true);assert.equal(submitted.current.status,'open');await aa.c.reports();assert.equal(aa.c.getState().reports.items.length,1);
 await assert.rejects(aa.c.management(f.room.id),e=>e.status===404);await hh.c.management(f.room.id);const report=hh.c.getState().management.reports.items[0];
 assert.ok(!JSON.stringify(hh.c.getState().management).includes(f.a.user.id));assert.throws(()=>hh.c.exclude(f.room.id,{id:f.b.user.id,name:'Target'},{report}),e=>e.code==='MODERATION_CONSENT_REQUIRED');
 const removed=await hh.c.exclude(f.room.id,{id:f.b.user.id,name:'Target'},{report,removalConsent:true});assert.equal(removed.current.active,true);await hh.c.refresh();
 const exclusion=hh.c.getState().management.exclusions.items[0];const restored=await hh.c.restore(exclusion,{allowReentryConsent:true});assert.equal(restored.current.active,false);
 await aa.c.reports();assert.equal(aa.c.getState().reports.items[0].status,'resolved');assert.equal((await f.request('/rooms',f.b.token)).rooms.find(r=>r.id===f.room.id).joined,false);
 assert.ok(!JSON.stringify(hh.c.getState()).includes(f.h.token));assert.throws(()=>{hh.c.getState().management.room.title='changed';},TypeError);
});

test('moderation client: committed lost response survives preflight outage and reload with one frozen request',async t=>{
 const f=await fixture(t),sent=[];let phase='lose';const fetcher=async(url,options)=>{if(phase==='preflight'&&options.method==='GET')throw Error('Synthetic outage');const response=await fetch(url,options);if(options.method==='POST'){sent.push({key:options.headers['Idempotency-Key'],body:options.body});if(phase==='lose'){phase='preflight';throw Error('Synthetic response loss');}}return response;};
 const aa=f.client(f.a,{fetch:fetcher});await assert.rejects(aa.c.submitReport(f.room.id,f.payload,'Target'),e=>e.uncertain);const op=aa.c.getState().pending[0];await assert.rejects(aa.c.retry(op.id),e=>e.uncertain);assert.throws(()=>aa.c.discard(op.id),e=>e.code==='OPERATION_UNCERTAIN');aa.c.dispose();
 phase='recover';const recovered=f.client(null,{storage:aa.storage,fetch:fetcher});await recovered.c.retry(op.id);assert.deepEqual(sent[0],sent[1]);await recovered.c.reports();assert.equal(recovered.c.getState().reports.items.length,1);assert.equal(recovered.c.getState().pending.length,0);
});

test('moderation client: older exclusion receipt cannot reapply a host removal after reentry was permitted',async t=>{
 const f=await fixture(t),snapshot=await f.request(`/rooms/${f.room.id}`,f.h.token),target=snapshot.members.find(m=>m.id===f.b.user.id);let lose=true;
 const hh=f.client(f.h,{fetch:async(url,options)=>{const response=await fetch(url,options);if(lose&&options.method==='POST'&&url.includes('/exclusions/')){lose=false;throw Error('Synthetic saved removal loss');}return response;}});
 await assert.rejects(hh.c.exclude(f.room.id,target,{removalConsent:true}),e=>e.uncertain);const op=hh.c.getState().pending[0];
 await f.request(`/rooms/${f.room.id}/exclusions/${target.id}`,f.h.token,{revision:1,allowReentryConsent:true},'DELETE');const retried=await hh.c.retry(op.id);assert.equal(retried.currentConfirmed,true);assert.equal(retried.current.active,false);assert.equal(retried.current.revision,2);
});

test('moderation client: failed canonical read acknowledges receipt without claiming current handling state',async t=>{
 const f=await fixture(t);let failRead=true;const aa=f.client(f.a,{fetch:(url,options)=>failRead&&options.method==='GET'&&/\/reports\/[0-9a-f-]{36}$/.test(url)?Promise.reject(Error('Synthetic canonical outage')):fetch(url,options)});
 const result=await aa.c.submitReport(f.room.id,f.payload,'Target');assert.equal(result.committed,true);assert.equal(result.currentConfirmed,false);assert.equal(result.current,undefined);assert.equal(aa.c.getState().pending.length,0);failRead=false;await aa.c.reports();assert.equal(aa.c.getState().reports.items[0].status,'open');
});

test('moderation client: same-tab identity replacement detaches an old response and keeps its pending record for the original actor',async t=>{
 const f=await fixture(t),started=deferred(),gate=deferred(),aa=f.client(f.a,{fetch:async(url,options)=>{const response=await fetch(url,options);if(options.method==='POST'){started.resolve();await gate.promise;}return response;}});
 const pending=aa.c.submitReport(f.room.id,f.payload,'Target');await started.promise;const op=aa.c.getState().pending[0],key=MODERATION_STORAGE_PREFIX+f.a.user.id+':'+op.id,record=aa.storage.getItem(key);
 aa.storage.setItem(SESSION_KEY,JSON.stringify(f.b));aa.c.syncIdentity();assert.equal(aa.c.getState().pending.length,0);gate.resolve();assert.equal((await pending).applied,false);assert.equal(aa.storage.getItem(key),record);assert.equal(aa.c.getState().lastResult,null);
 await aa.c.reports();assert.equal(aa.c.getState().reports.items.length,0);aa.storage.setItem(SESSION_KEY,JSON.stringify(f.a));aa.c.syncIdentity();await aa.c.retry(op.id);assert.equal(aa.c.getState().pending.length,0);
});

test('moderation client: unavailable local storage prevents an untracked feedback submission',async t=>{
 const f=await fixture(t),storage=store();storage.setItem(SESSION_KEY,JSON.stringify(f.a));storage.setItem=()=>{throw Error('Synthetic quota');};let calls=0;
 const aa=f.client(null,{storage,fetch:(...args)=>{calls++;return fetch(...args);}});assert.throws(()=>aa.c.submitReport(f.room.id,f.payload,'Target'),e=>e.code==='STORAGE_REQUIRED');assert.equal(calls,0);
});
