import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../web/event-room/original-map-entry.js',import.meta.url),'utf8').replace("import {realSongs} from '../../runtime-preview/src/map-catalogue.js';","const realSongs={'real-far-away':{}};");
const {createMusicMap}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
test('original Map returns only explicit drafts to the same identity, once',()=>{
 const values=new Map();globalThis.sessionStorage={getItem:k=>values.get(k),setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)};
 let navigations=0;globalThis.location={pathname:'/event-room/',search:'',hash:'',assign:()=>navigations++};
 let identity={status:'ready',user:{id:'a'}},shares=0,relays=0,returns=0;
 const map=createMusicMap({controller:{getState:()=>({identity})},onShare:()=>shares++,onRelay:()=>relays++,onReturn:()=>returns++});
 map.open({kind:'room',id:'r'});map.open();assert.equal(navigations,1);assert.equal(shares,0);
 const key='music-space-map-return:v1',context=JSON.parse(values.get(key));
 values.set(key,JSON.stringify({...context,action:'share',recordingId:'hf-unverified'}));map.syncIdentity();assert.equal(shares,0);
 values.set(key,JSON.stringify({...context,action:'share',recordingId:'real-far-away'}));identity.user.id='b';map.syncIdentity();assert.equal(shares,0);
 identity.user.id='a';values.set(key,JSON.stringify({...context,action:'share',recordingId:'real-far-away'}));map.syncIdentity();map.syncIdentity();assert.equal(shares,1);
 values.set(key,JSON.stringify({...context,action:'relay',recordingId:'real-far-away'}));map.syncIdentity();assert.equal(relays,1);
 values.set(key,JSON.stringify({...context,returning:true}));map.syncIdentity();assert.equal(returns,1);
});
test('blocked session storage leaves the current screen and reports a retryable error',()=>{
 globalThis.sessionStorage={setItem(){throw Error('blocked');}};let errors=0,navigations=0;globalThis.location={pathname:'/event-room/',assign:()=>navigations++};
 const map=createMusicMap({controller:{getState:()=>({identity:{user:{id:'a'}}})},onError:()=>errors++});map.open();assert.equal(errors,1);assert.equal(navigations,0);
});
test('offline opening preserves the current screen for an explicit retry',()=>{
 const prior=Object.getOwnPropertyDescriptor(globalThis,'navigator');Object.defineProperty(globalThis,'navigator',{value:{onLine:false},configurable:true});let errors=0,navigations=0;globalThis.location={assign:()=>navigations++};
 try{const map=createMusicMap({controller:{getState:()=>{throw Error('must not leave');}},onError:()=>errors++});map.open();assert.equal(errors,1);assert.equal(navigations,0);}finally{if(prior)Object.defineProperty(globalThis,'navigator',prior);else delete globalThis.navigator;}
});
