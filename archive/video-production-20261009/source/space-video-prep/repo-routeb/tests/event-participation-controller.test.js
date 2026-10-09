import {test} from 'node:test';
import assert from 'node:assert/strict';
import {participationFixture} from './helpers/participation-fixture.js';
import {createEventController,SESSION_KEY} from '../web/event-client/controller.js';
import {DEFAULT_AVATAR} from '../web/avatar/model.js';
const memory=()=>{const m=new Map();return{get length(){return m.size},key:i=>[...m.keys()][i]??null,getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,String(v)),removeItem:k=>m.delete(k)}};
async function person(t,f,storage=memory(),fetcher=fetch){const c=createEventController({baseUrl:f.baseUrl,storage,fetch:fetcher});t.after(()=>c.dispose());await c.connect();if(c.getState().identity.status==='missing')await c.establishIdentity({name:'合成恢复验收',avatar:DEFAULT_AVATAR});return{c,storage};}
const my=c=>c.getState().members.find(m=>m.id===c.getState().identity.user.id);
const roomInput={title:'合成参与恢复',venue:'合成',songId:'late-train',joinConsent:true};
test('participation controller: defaults quiet, original-key lost response recovers without reverting a later quiet choice',async t=>{
 const f=await participationFixture(t),storage=memory(),keys=[];let drop=true;
 const fetcher=async(url,o)=>{const r=await fetch(url,o);if(o.method==='PATCH'&&url.endsWith('/participation')){keys.push(new Headers(o.headers).get('Idempotency-Key'));if(drop){drop=false;throw Error('Synthetic response lost after commit');}}return r;};
 const a=await person(t,f,storage,fetcher),room=(await a.c.createRoom(roomInput)).room;assert.equal(my(a.c).participation,'quiet');
 await assert.rejects(a.c.setParticipation('open',{revision:1}),e=>e.uncertain);const op=a.c.getState().pending.find(p=>p.type==='setParticipation');assert.ok(op?.durable);a.c.dispose();
 const credentials=JSON.parse(storage.getItem(SESSION_KEY));assert.equal((await f.choice(room,{token:credentials.token},'quiet',2)).status,200);
 const reloaded=await person(t,f,storage,fetcher);await reloaded.c.openRoom(room.id);await reloaded.c.retry(op.id);assert.equal(my(reloaded.c).participation,'quiet');assert.equal(my(reloaded.c).participationRevision,3);assert.equal(keys.length,2);assert.equal(keys[0],keys[1]);assert.deepEqual(reloaded.c.getState().pending,[]);
});
test('participation controller: two tabs conflict refreshes canonical revision and never silently overwrites the other tab',async t=>{
 const f=await participationFixture(t),storage=memory(),a=await person(t,f,storage),room=(await a.c.createRoom(roomInput)).room,b=await person(t,f,storage);await b.c.openRoom(room.id);
 await a.c.setParticipation('open',{revision:1});await assert.rejects(b.c.setParticipation('quiet',{revision:1}),e=>e.code==='REVISION_CONFLICT');assert.equal(my(b.c).participation,'open');assert.equal(my(b.c).participationRevision,2);await b.c.setParticipation('quiet',{revision:2});await a.c.refreshRoom();assert.equal(my(a.c).participation,'quiet');assert.equal(my(a.c).participationRevision,3);
});
test('participation controller: cancel while waiting retains one frozen operation and exact request for recovery',async t=>{
 const f=await participationFixture(t);let entered,release,hold=true;const seen=new Promise(r=>entered=r),gate=new Promise(r=>release=r),keys=[];
 const fetcher=async(url,o)=>{const r=await fetch(url,o);if(url.endsWith('/participation')&&o.method==='PATCH'){keys.push(new Headers(o.headers).get('Idempotency-Key'));if(hold){hold=false;entered();await gate;}}return r;};
 const {c}=await person(t,f,memory(),fetcher);await c.createRoom(roomInput);const saving=c.setParticipation('open',{revision:1});await seen;const op=c.getState().pending.find(p=>p.type==='setParticipation');c.cancel(op.id);release();await assert.rejects(saving,e=>e.uncertain);assert.equal(c.reviewOperation(op.id).payload.mode,'open');await c.retry(op.id);assert.equal(my(c).participation,'open');assert.equal(my(c).participationRevision,2);assert.equal(keys[0],keys[1]);
});
