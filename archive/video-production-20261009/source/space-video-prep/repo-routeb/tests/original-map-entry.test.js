import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
// The module is loaded through a data: URL, which cannot resolve relative imports: the catalogue import becomes a stub and the
// site-base import becomes the real web/shared/site-base.js text, so the navigation target below is the real helper's answer.
const siteBase=readFileSync(new URL('../web/shared/site-base.js',import.meta.url),'utf8');
const source=readFileSync(new URL('../web/event-room/original-map-entry.js',import.meta.url),'utf8').replace("import {realSongs} from '../../runtime-preview/src/map-catalogue.js';","const realSongs={'real-far-away':{}};").replace("import {siteUrl} from '../shared/site-base.js';",()=>siteBase);
assert.ok(!source.includes("from '../shared/site-base.js'"),'the site-base import was replaced');
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
test('return camera waits for the restored room and renderer without repeating the draft',()=>{
 const values=new Map(),key='music-space-map-return:v1';globalThis.sessionStorage={getItem:k=>values.get(k),setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)};
 values.set(key,JSON.stringify({actor:'a',scope:{kind:'room',id:'r'},returning:true,view:{view:'photos',roomId:'r'}}));let ready=false,returns=0,restores=0;
 const map=createMusicMap({controller:{getState:()=>({identity:{status:'ready',user:{id:'a'}}})},canRestore:v=>ready&&v.roomId==='r',onReturn:()=>returns++,onRestore:v=>{assert.equal(v.view,'photos');restores++;}});
 map.syncIdentity();assert.equal(returns,1);assert.equal(restores,0);ready=true;map.syncIdentity();map.syncIdentity();assert.equal(returns,1);assert.equal(restores,1);
});
test('opening the Map goes to music-map/ below the site root: the Node server, the Pages root and the preview channel',()=>{
 const values=new Map();globalThis.sessionStorage={getItem:k=>values.get(k),setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)};
 const docOf=(baseURI,hint)=>({baseURI,querySelector:selector=>selector==='meta[name="space-site-root"]'&&hint?{content:hint}:null});
 const cases=[
  ['Node server (no hints)',docOf('http://127.0.0.1:8787/event-room/?room=ABC123#overview'),'http://127.0.0.1:8787/music-map/#/explore'],
  ['Pages root',docOf('https://musicmapteam.github.io/musicSpace/?room=ABC123','./'),'https://musicmapteam.github.io/musicSpace/music-map/#/explore'],
  ['Pages preview',docOf('https://musicmapteam.github.io/musicSpace/preview/','./'),'https://musicmapteam.github.io/musicSpace/preview/music-map/#/explore'],
 ];
 try{
  for(const [name,doc,expected] of cases){
   globalThis.document=doc;const targets=[];globalThis.location={pathname:'/x/',search:'?room=ABC123',hash:'',assign:url=>targets.push(url)};
   const map=createMusicMap({controller:{getState:()=>({identity:{user:{id:'a'}}})}});map.open({kind:'room',id:'r'});map.open();
   assert.deepEqual(targets,[expected],name);
   assert.equal(JSON.parse(values.get('music-space-map-return:v1')).returnUrl,'/x/?room=ABC123',name+': the stored return address is the room page itself');
  }
 }finally{delete globalThis.document;}
});
