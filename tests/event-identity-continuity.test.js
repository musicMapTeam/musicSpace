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


test('identity continuity: explicit encrypted export, same-service verification, current profile, invalid restore leaves identity',async t=>{
 const f=await fixture(t),a=await f.person('Synthetic A'),b=await f.person('Synthetic B'),password='Synthetic-Only-Password-2026',opts={consent:true,origin:f.baseUrl};
 const original=b.storage.getItem(SESSION_KEY),aSession=JSON.parse(a.storage.getItem(SESSION_KEY));
 await assert.rejects(a.c.exportIdentityBackup(password,{origin:f.baseUrl}),e=>e.code==='BACKUP_CONSENT_REQUIRED');
 const encrypted=await a.c.exportIdentityBackup(password,opts);assert.equal(encrypted.includes(aSession.token),false);
 await assert.rejects(b.c.restoreIdentityBackup(encrypted,'Wrong-Password-2026',opts));assert.equal(b.storage.getItem(SESSION_KEY),original);
 await assert.rejects(b.c.restoreIdentityBackup(encrypted,password,{...opts,origin:'https://another.test'}));assert.equal(b.storage.getItem(SESSION_KEY),original);
 await assert.rejects(b.c.restoreIdentityBackup(encrypted,password,{...opts,consent:false}));assert.equal(b.storage.getItem(SESSION_KEY),original);
 await a.c.saveProfile(profile('Current A'),{revision:a.c.getState().identity.user.revision});
 await b.c.restoreIdentityBackup(encrypted,password,opts);const restored=JSON.parse(b.storage.getItem(SESSION_KEY));assert.equal(restored.user.id,aSession.user.id);assert.equal(restored.user.name,'Current A');assert.equal(b.c.getState().identity.requiresReload,true);
 const next=f.client({storage:b.storage});await next.c.connect();assert.equal(next.c.getState().identity.user.id,aSession.user.id);
});
test('identity continuity: cancel and concurrent identity replacement cannot install a late decrypted identity',async t=>{
 const f=await fixture(t),a=await f.person('Synthetic A'),b=await f.person('Synthetic B'),password='Synthetic-Only-Password-2026',opts={consent:true,origin:f.baseUrl},encrypted=await a.c.exportIdentityBackup(password,opts),old=b.storage.getItem(SESSION_KEY);
 const abort=new AbortController();abort.abort();await assert.rejects(b.c.restoreIdentityBackup(encrypted,password,{...opts,signal:abort.signal}));assert.equal(b.storage.getItem(SESSION_KEY),old);
 const promise=b.c.restoreIdentityBackup(encrypted,password,opts);b.storage.removeItem(SESSION_KEY);await assert.rejects(promise,e=>e.code==='IDENTITY_CHANGED');assert.equal(b.storage.getItem(SESSION_KEY),null);
});
test('identity continuity: revoked credential cannot restore or export and does not replace another valid identity',async t=>{
 const f=await fixture(t),a=await f.person('Synthetic A'),b=await f.person('Synthetic B'),opts={consent:true,origin:f.baseUrl},password='Synthetic-Only-Password-2026',encrypted=await a.c.exportIdentityBackup(password,opts),before=b.storage.getItem(SESSION_KEY),db=new DatabaseSync(join(f.dir,'avatar-space.sqlite'));
 db.prepare('UPDATE avatar_users SET token_hash=? WHERE id=?').run(randomUUID(),a.c.getState().identity.user.id);db.close();
 await assert.rejects(b.c.restoreIdentityBackup(encrypted,password,opts),e=>e.status===401);assert.equal(b.storage.getItem(SESSION_KEY),before);
 await assert.rejects(a.c.exportIdentityBackup(password,opts),e=>e.status===401);assert.equal(a.c.getState().identity.status,'invalid');
});
