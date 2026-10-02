// Execute the real UI binding with a bounded DOM/controller shell. These are
// callback, state and resource-lifetime checks, NOT browser/WebGL/visual QA.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import {memberFloorPositions,layoutSceneLabels} from '../web/event-room/scene-layout.js';
import { DEFAULT_AVATAR, SKINS, HAIRS, GARMENT_COLORS, SONGS, safeAvatar, escape as esc } from '../web/avatar/model.js';
import {renderAvatarSvg} from '../web/illustrated-avatar/index.js';
import {recapMarkup} from '../web/event-room/recap-view.js';
const source=readFileSync(new URL('../web/event-room/app.js',import.meta.url),'utf8');
const clone=value=>JSON.parse(JSON.stringify(value));
const defer=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};};
const tick=()=>new Promise(resolve=>setImmediate(resolve));
const actor='00000000-0000-4000-8000-000000000001';
const roomId='00000000-0000-4000-8000-000000000002';
const otherId='00000000-0000-4000-8000-000000000003';
const room=(id=roomId)=>({id,code:id===roomId?'AAAAAAAAAAAA':'BBBBBBBBBBBB',title:'Synthetic show',venue:'Synthetic venue',role:'host',joined:true,revision:1,status:'open'});
const photo=(n=1)=>({id:`10000000-0000-4000-8000-${String(n).padStart(12,'0')}`,roomId,ownerId:actor,visibility:'private',revision:1});
function initial(extra={}) {return {connection:'connected',identity:{status:'ready',user:{id:actor,name:'Synthetic viewer',avatar:DEFAULT_AVATAR,revision:1}},route:{kind:'home',target:null},room:null,preview:null,members:[],photos:[],myPhotos:{items:[],nextCursor:null},myRooms:{items:[],nextCursor:null},drafts:{photo:null,profile:null,room:null},draftVersions:{photo:0,profile:0,room:0},dirty:{photo:false,profile:false,room:false},pending:[],loading:[],storage:{ok:true,refreshRecovery:true},error:null,...extra};}
function element() {const events=new Map();return {events,hidden:false,innerHTML:'',textContent:'',scrollTop:0,dataset:{},isConnected:true,classList:{add(){},remove(){},toggle(){}},addEventListener(type,fn){const list=events.get(type)||[];list.push(fn);events.set(type,list);},setAttribute(){},removeAttribute(){},focus(){},append(){},remove(){},querySelector(){return null;},querySelectorAll(){return [];}};}
function harness(start=initial(),url='https://musicspace.test/event/') {
  let current=clone(start),subscriber;
  const elements=new Map(),doc=element(),window=element(),calls=[],revoked=[],timers=new Map();let nextTimer=0;
  const get=selector=>{if(!elements.has(selector))elements.set(selector,element());return elements.get(selector);};
  window.location={reload(){calls.push(['reload']);}};doc.querySelector=get;doc.querySelectorAll=()=>[];doc.createElement=()=>element();doc.activeElement=element();doc.hidden=false;
  const emit=next=>{current=clone(next);subscriber?.(clone(current));};
  const controller={getState:()=>clone(current),subscribe(fn){subscriber=fn;fn(clone(current));return ()=>{};},setDraft(kind,value){current.drafts[kind]=clone(value);current.draftVersions[kind]++;current.dirty[kind]=true;emit(current);},
    async connect(){calls.push(['connect']);return {applied:true};},async loadSocial(){calls.push(['loadSocial']);return {applied:true};},async loadSocialPeer(id){calls.push(['loadSocialPeer',id]);return {applied:true};},async loadMyRooms(){calls.push(['loadMyRooms']);return {applied:true};},async loadMyPhotos(){calls.push(['loadMyPhotos']);return {applied:true};},
    async previewRoom(code){calls.push(['previewRoom',code]);emit({...current,route:{kind:'preview',target:code},room:null,preview:{...room(code==='AAAAAAAAAAAA'?roomId:otherId),code}});return {applied:true,preview:current.preview};},
    async openRoom(id){calls.push(['openRoom',id]);emit({...current,route:{kind:'room',target:id},room:room(id)});return {applied:true,room:current.room};},
    async refreshRoom(){calls.push(['refreshRoom']);return {applied:true};},async fetchPhotoBlob(id){calls.push(['fetchPhotoBlob',id]);return new Blob(['synthetic'],{type:'image/jpeg'});},
    retry:async id=>({operationId:id,applied:false}),cancel(){},dispose(){},uploadPhoto:async()=>({applied:true}),establishIdentity:async()=>({applied:true}),createRoom:async()=>({applied:true}),joinRoom:async()=>({applied:true}),setPhotoVisibility:async()=>({applied:true}),removePhoto:async()=>({applied:true}),leaveRoom:async()=>({applied:true}),closeRoom:async()=>({applied:true})};
  class SafeURL extends URL {static createObjectURL(){return 'blob:synthetic-'+Math.random();}static revokeObjectURL(value){revoked.push(value);}}
  const location=new URL(url),history={replaceState(_a,_b,next){location.href=String(next);}};
  const engine={ready:Promise.resolve(),update(){},goTo(){},getState:()=>({view:'overview'}),setReducedMotion(){},dispose(){},pick(){return null;}};
  const context=vm.createContext({console,document:doc,window,location,history,navigator:{clipboard:{writeText:async()=>{}}},URL:SafeURL,Blob,
    createModerationPanel:options=>({openReports:async()=>calls.push(['myFeedback']),openManagement:async id=>calls.push(['manageRoom',id]),openFeedback:(target,options)=>calls.push(['feedback',clone(target),options===undefined?undefined:clone(options)]),close(){},syncIdentity(){},refresh:async()=>{},dispose(){}}),
    createExchangePanel:options=>({open:async id=>calls.push(['exchangeOpen',id]),openOffer:async p=>calls.push(['exchangeOffer',clone(p)]),close(){},syncIdentity(){},refresh:async()=>{},invalidate:scope=>calls.push(['exchangeInvalidate',clone(scope)]),getState:()=>({}),dispose(){}}),
    matchMedia:()=>({matches:true,addEventListener(){}}),setTimeout:(callback,delay)=>{const id=++nextTimer;timers.set(id,{callback,delay});return id;},clearTimeout:id=>timers.delete(id),createEventController:()=>controller,mountLivehouseScene:()=>engine,
    memberFloorPositions,layoutSceneLabels,renderAvatarSvg,recapMarkup,venueAssetUrl:'data:model/gltf-binary;base64,c3ludGhldGlj',SESSION_KEY:'music-space-avatar-session:v1',DEFAULT_AVATAR,SKINS,HAIRS,GARMENT_COLORS,SONGS,safeAvatar,esc,qrcode:()=>({addData(){},make(){},createSvgTag:()=>'<svg></svg>'}),
    FormData:class {constructor(form){this.values=form.values||{};}get(key){return this.values[key]??null;}},
  });
  const code=source.replace(/^import .*;$/gm,'').replace('void boot();','');
  vm.runInContext(code+`\nglobalThis.binding={scenePicked,openPanel,closePanel,synchronizePhotos,boot,saveWardrobeProfile,setWardrobeReturn:value=>{wardrobeReturn=value;},get:()=>({state,panelKind,panelTarget,detailEpoch,photoDraft,photoInputGeneration,formBusy,urls:[...urls]}),setPhotoDraft:value=>{photoDraft=value;},cache:(id,url,revision=1)=>urls.set(id,{url,revision})};`,context,{filename:'event-room-ui-binding.vm.js'});
  return {engine,controller,calls,revoked,emit,document:doc,element:get,async runPoll(){const entry=[...timers].find(([,t])=>t.delay===5000);assert.ok(entry,'visible poll is scheduled');timers.delete(entry[0]);await entry[1].callback();await tick();},async setVisible(value){doc.hidden=!value;for(const fn of doc.events.get('visibilitychange')||[])fn();await tick();},async focusWindow(){for(const fn of window.events.get('focus')||[])fn();await tick();},async storageChanged(key){for(const fn of window.events.get('storage')||[])fn({key});await tick();},async online(){for(const fn of window.events.get('online')||[])fn();await tick();},get:()=>context.binding.get(),binding:context.binding,body:get('#panel-body'),panel:get('#panel'),
    async click(dataset){const button={dataset,closest(selector){return selector==='button'?this:null;}};for(const fn of doc.events.get('click')||[])await fn({target:button});await tick();},
    submit(kind,values={},dataset={}){const form={dataset:{form:kind,...dataset},values,setAttribute(){},removeAttribute(){},querySelectorAll:()=>[]};for(const fn of get('#panel-body').events.get('submit')||[])fn({preventDefault(){},target:form});return form;},
    input(form,name,value){const target={name,value,closest:()=>form};for(const fn of get('#panel-body').events.get('input')||[])fn({target});},
  };
}

test('retry binding preserves applied=false and never opens an old operation room after newer navigation',async()=>{
  const h=harness(initial({room:room(otherId),route:{kind:'room',target:otherId}}));h.binding.openPanel('pending');const pending=defer();h.controller.retry=()=>pending.promise;
  await h.click({retry:'old-operation'});h.binding.openPanel('entry');pending.resolve({room:room(),applied:false});await tick();
  assert.equal(h.calls.some(([method,id])=>method==='openRoom'&&id===roomId),false,'old retry must not override a newer room/target');
  assert.equal(h.get().state.room?.id,otherId);
});

test('photo exchange entry keeps the exact target and exposes distinct wall/whole-sharing controls',async()=>{
 const mine=photo(),theirs={...photo(2),ownerId:otherId,visibility:'members'},h=harness(initial({room:room(),route:{kind:'room',target:roomId},photos:[mine,theirs],members:[{id:otherId,name:'B'}]}));
 h.binding.openPanel('photo',theirs.id);assert.match(h.body.innerHTML,/data-exchange-offer/);await h.click({exchangeOffer:theirs.id});
 assert.deepEqual(h.calls.find(call=>call[0]==='exchangeOffer')[1],theirs);
 h.binding.openPanel('photo',mine.id);assert.match(h.body.innerHTML,/照片墙：不展示/);assert.match(h.body.innerHTML,/收回这张照片的全部分享/);assert.doesNotMatch(h.body.innerHTML,/仅自己可见/);
});

test('whole-sharing withdrawal stays on the selected library photo and guards exchange images before and after commit',async()=>{
 const p=photo(),h=harness(initial({myPhotos:{items:[p],nextCursor:null}}));h.controller.withdrawPhoto=async(id,options)=>{h.calls.push(['withdrawPhoto',id,options.revision]);return{applied:true};};
 h.binding.openPanel('library');h.binding.openPanel('photo',p.id);await h.click({open:'withdraw',id:p.id});await h.click({confirm:'withdraw'});
 assert.deepEqual(h.calls.filter(call=>call[0]==='withdrawPhoto'),[['withdrawPhoto',p.id,1]]);assert.equal(h.calls.filter(call=>call[0]==='exchangeInvalidate'&&call[1].photoId===p.id).length,2);
});

test('upload completion cannot clear a newer photo draft edited during the pending save',async()=>{
  const original={roomId,dataUrl:'data:image/jpeg;base64,ORIGINAL',visibility:'private'},newer={...original,dataUrl:'data:image/jpeg;base64,NEWER'};
  const h=harness(initial({room:room(),route:{kind:'room',target:roomId},drafts:{photo:original,profile:null,room:null},draftVersions:{photo:1,profile:0,room:0}}));
  h.binding.setPhotoDraft(original);h.binding.openPanel('upload');const pending=defer();h.controller.uploadPhoto=()=>pending.promise;
  h.submit('upload',{visibility:'private'},{room:roomId});await tick();h.binding.setPhotoDraft(newer);h.controller.setDraft('photo',newer);pending.resolve({applied:true});await tick();
  assert.deepEqual(clone(h.get().state.drafts.photo),newer,'newer draft must survive earlier upload success');
});

test('identity invalidation at the library immediately removes stale photo DOM and revokes its blob URL',async()=>{
  const p=photo(),s=initial({myPhotos:{items:[p],nextCursor:null}}),h=harness(s);h.binding.cache(p.id,'blob:previous-private');h.binding.openPanel('library');assert.match(h.body.innerHTML,/blob:previous-private/);
  h.emit({...s,identity:{...s.identity,status:'invalid'},myPhotos:{items:[],nextCursor:null}});
  assert.ok(h.revoked.includes('blob:previous-private'),'invalid identity must release previously authorized image URL');
  assert.ok(h.panel.hidden||!h.body.innerHTML.includes('blob:previous-private'),'private image must leave the visible library');
});

test('a member appearance change keeps authorized wall photos attached; identity loss still clears them',async()=>{
  const p={...photo(),visibility:'members'},member={id:actor,name:'Synthetic viewer',avatar:DEFAULT_AVATAR};
  const s=initial({room:room(),route:{kind:'room',target:roomId},members:[member],photos:[p]}),h=harness(s);
  await tick();h.binding.cache(p.id,'blob:retained-wall');const updates=[];h.engine.update=value=>updates.push(clone(value));
  h.emit({...s,members:[{...member,avatar:{...DEFAULT_AVATAR,topColor:2}}]});
  assert.ok(updates.some(value=>value.people),'appearance change reaches the scene');
  assert.ok(updates.filter(value=>Object.hasOwn(value,'photos')).every(value=>value.photos.length===1&&value.photos[0].url==='blob:retained-wall'),'people-only updates must not detach the photo before republishing it');
  assert.ok(!h.revoked.includes('blob:retained-wall'));
  updates.length=0;
  h.emit({...s,identity:{...s.identity,status:'invalid'},room:null,members:[],photos:[]});
  assert.ok(updates.some(value=>Array.isArray(value.photos)&&value.photos.length===0),'identity loss still clears scene photos');
  assert.ok(h.revoked.includes('blob:retained-wall'));
});

test('explicit next batch makes photo 25 visible and fetches its authorized blob',async()=>{
  const photos=Array.from({length:25},(_,i)=>photo(i+1)),h=harness(initial({myPhotos:{items:photos,nextCursor:null}}));h.binding.openPanel('library');await h.binding.synchronizePhotos();
  assert.match(h.body.innerHTML,/data-show-more/);assert.ok(!h.body.innerHTML.includes(`data-photo="${photos[24].id}"`));
  await h.click({showMore:''});await tick();await h.click({photo:photos[24].id});await tick();
  assert.ok(h.calls.some(([method,id])=>method==='fetchPhotoBlob'&&id===photos[24].id),'selected photo must load even outside initial bounded grid batch');
});

test('boot invitation cannot supersede a preview the user chose while connection was pending',async()=>{
  const h=harness(initial(),'https://musicspace.test/event/?room=AAAAAAAAAAAA'),pending=defer();h.controller.connect=()=>pending.promise;
  const boot=h.binding.boot();await h.click({open:'entry'});h.submit('preview',{code:'BBBBBBBBBBBB'});await tick();pending.resolve({applied:true});await boot;await tick();
  assert.equal(h.get().state.preview?.code,'BBBBBBBBBBBB','manual target must take precedence over stale bootstrap URL');
});

test('create form matches the event API’s forty-character text bounds',()=>{
  const h=harness();h.binding.openPanel('create');
  assert.match(h.body.innerHTML,/name="title"[^>]*maxlength="40"/);assert.match(h.body.innerHTML,/name="venue"[^>]*maxlength="40"/);
});

test('departed host management closes only the chosen owned room without opening its roster',async()=>{
  const managed={...room(),joined:false},h=harness(initial({myRooms:{items:[managed],nextCursor:null}}));
  h.controller.closeRoom=async(id,options)=>{h.calls.push(['closeRoom',id,options.revision]);return {applied:true,room:{...managed,status:'closed',revision:2}};};
  h.binding.openPanel('rooms');assert.match(h.body.innerHTML,/data-manage-close/);await h.click({manageClose:roomId});await h.click({confirm:'close'});
  assert.deepEqual(h.calls.filter(c=>c[0]==='closeRoom'),[['closeRoom',roomId,1]]);assert.equal(h.calls.some(c=>c[0]==='openRoom'),false);
});

test('internal room-state reset does not swallow the selected departed-room preview',async()=>{
  const managed={...room(),joined:false},h=harness(initial({room:room(otherId),route:{kind:'room',target:otherId},myRooms:{items:[managed],nextCursor:null}}));
  h.binding.openPanel('rooms');await h.click({room:roomId,joined:'false'});await tick();
  assert.equal(h.get().panelKind,'preview');assert.equal(h.get().state.preview?.code,managed.code);
});

test('join consent is unchecked initially and its exact checkbox value reaches the controller',async()=>{
  const p=room(),h=harness(initial({route:{kind:'preview',target:p.code},preview:p}));const requests=[];
  h.controller.joinRoom=async(code,options)=>{requests.push([code,options.joinConsent]);return {applied:false};};h.binding.openPanel('preview');
  const consent=h.body.innerHTML.match(/<input name="consent"[^>]+>/)?.[0];assert.ok(consent);assert.ok(!consent.includes('checked'));
  h.submit('join',{}, {code:p.code});await tick();assert.deepEqual(requests,[[p.code,false]]);
  h.submit('join',{consent:'on'}, {code:p.code});await tick();assert.deepEqual(requests[1],[p.code,true]);
});

test('brand navigation prevents a waiting success callback from reopening its old panel',async()=>{
  const h=harness(initial({room:room(),route:{kind:'room',target:roomId}})),pending=defer();h.controller.retry=()=>pending.promise;
  h.binding.openPanel('pending');await h.click({retry:'old-operation'});
  h.element('.brand').onclick({preventDefault(){}});assert.equal(h.get().panelKind,null);
  pending.resolve({applied:true});await tick();assert.equal(h.get().panelKind,null,'brand navigation must supersede the old action callback');
});

test('returning from owner library to room wall refetches member photos evicted by the library scope',async()=>{
  const mine=photo(1),theirs={...photo(2),ownerId:otherId,visibility:'members'},h=harness(initial({room:room(),route:{kind:'room',target:roomId},photos:[mine,theirs],myPhotos:{items:[mine],nextCursor:null}}));
  h.binding.openPanel('wall');await tick();h.binding.openPanel('library');await tick();
  assert.equal(h.get().urls.some(([id])=>id===theirs.id),false,'library must not retain another member in its authorized owner list');
  await h.click({open:'wall'});await tick();
  assert.equal(h.get().urls.some(([id])=>id===theirs.id),true,'return to the room should restore its independently authorized photo');
});

test('closing owner library restores room-photo scope for the 3D wall without changing rooms',async()=>{
  const mine=photo(1),theirs={...photo(2),ownerId:otherId,visibility:'members'},h=harness(initial({room:room(),route:{kind:'room',target:roomId},photos:[mine,theirs],myPhotos:{items:[mine],nextCursor:null}}));
  h.binding.openPanel('library');await tick();h.binding.closePanel(false);await tick();
  assert.equal(h.get().panelKind,null);assert.equal(h.get().state.room.id,roomId);assert.equal(h.get().urls.some(([id])=>id===theirs.id),true);
});

test('joined room menu exposes recovery for an uncertain operation after refresh',()=>{
  const h=harness(initial({room:room(),route:{kind:'room',target:roomId},pending:[{id:'synthetic-op',type:'uploadPhoto',status:'uncertain',durable:true}]}));
  h.binding.openPanel('room');assert.match(h.body.innerHTML,/data-open="pending"/);assert.match(h.body.innerHTML,/1 个操作待确认/);
});

test('a definitive failure menu is labelled unfinished rather than awaiting confirmation',()=>{
 const h=harness(initial({room:room(),route:{kind:'room',target:roomId},pending:[{id:'failed-op',type:'uploadPhoto',status:'failed',durable:true,error:{uncertain:false,message:'Synthetic429'}}]}));
 h.binding.openPanel('room');assert.match(h.body.innerHTML,/1 个操作未完成/);assert.doesNotMatch(h.body.innerHTML,/操作待确认/);
 h.binding.openPanel('pending');assert.match(h.body.innerHTML,/已明确失败/);assert.match(h.body.innerHTML,/移除失败记录/);
});

test('host management and member feedback route to the reviewed room/person while removed history does not offer rejoin',async()=>{
 const active={...room(),hostId:actor},target={id:otherId,name:'Synthetic peer',joinedAt:'reviewed'},h=harness(initial({room:active,route:{kind:'room',target:roomId},members:[{id:actor,name:'Host'},target]}));
 h.binding.openPanel('room');assert.match(h.body.innerHTML,/管理这一场/);await h.click({open:'moderation',id:roomId});assert.deepEqual(h.calls.find(c=>c[0]==='manageRoom'),['manageRoom',roomId]);
 h.binding.openPanel('person',otherId);assert.match(h.body.innerHTML,/向本场房主反馈/);await h.click({open:'feedback',id:otherId});assert.equal(h.calls.find(c=>c[0]==='feedback')[1].id,otherId);
 const removed={...room(),role:'member',joined:false,entryState:'removed'},other=harness(initial({myRooms:{items:[removed],nextCursor:null}}));other.binding.openPanel('rooms');assert.match(other.body.innerHTML,/已被移出/);assert.doesNotMatch(other.body.innerHTML,/data-room=/);assert.match(other.body.innerHTML,/回看这一晚/);
});

test('owner library never offers to share an old room photo to the wrong current-room audience',async()=>{
  const p=photo(),h=harness(initial({room:room(otherId),route:{kind:'room',target:otherId},myPhotos:{items:[p],nextCursor:null}}));
  h.binding.openPanel('library');await tick();await h.click({photo:p.id});
  assert.doesNotMatch(h.body.innerHTML,/data-visibility="members"/);
  assert.match(h.body.innerHTML,/照片所属的现场/);
  assert.match(h.body.innerHTML,/移除这张照片/);
});

test('corrupt persisted photo draft cannot inject markup into the upload review',()=>{
  const unsafe={roomId,dataUrl:'" onerror="alert(1)',visibility:'private'},h=harness(initial({room:room(),route:{kind:'room',target:roomId},drafts:{photo:unsafe,profile:null,room:null}}));
  h.binding.openPanel('upload');assert.doesNotMatch(h.body.innerHTML,/onerror|alert\(1\)/);assert.match(h.body.innerHTML,/type="submit" disabled/);
});

test('resolved unapplied retry repaints the current pending list without forcing navigation',async()=>{
  const s=initial({room:room(),route:{kind:'room',target:roomId},pending:[{id:'saved-op',type:'uploadPhoto',status:'uncertain',durable:true}]}),h=harness(s);
  h.controller.retry=async()=>{h.emit({...s,pending:[]});return {applied:false};};h.binding.openPanel('pending');await h.click({retry:'saved-op'});
  assert.equal(h.get().panelKind,'pending');assert.match(h.body.innerHTML,/没有待确认的操作/);assert.equal(h.calls.some(c=>c[0]==='openRoom'),false);
});

const socialState=extra=>({actorId:actor,incoming:[],outgoing:[],friends:[],blocks:[],nextCursors:{incoming:null,outgoing:null,friends:null,blocks:null},loaded:true,stale:false,...extra});
const peer={id:otherId,name:'Synthetic peer',avatar:DEFAULT_AVATAR};
const greeting={id:'20000000-0000-4000-8000-000000000001',roomId,senderId:otherId,recipientId:actor,peer,status:'pending',revision:3};

test('opening a person does not send or accept; a greeting is sent only by explicit button action',async()=>{
  const h=harness(initial({room:room(),route:{kind:'room',target:roomId},members:[peer],social:socialState()}));
  h.controller.sendGreeting=async(id,o)=>{h.calls.push(['sendGreeting',id,o.roomId]);return {applied:true};};
  h.binding.openPanel('person',otherId);assert.match(h.body.innerHTML,/data-social-send/);assert.equal(h.calls.some(c=>c[0]==='sendGreeting'),false);
  await h.click({socialSend:otherId});assert.deepEqual(h.calls.filter(c=>c[0]==='sendGreeting'),[['sendGreeting',otherId,roomId]]);
});

test('recipient sees separate accept and reject choices; accept forwards the exact request revision',async()=>{
  const h=harness(initial({social:socialState({incoming:[greeting]})}));
  h.controller.acceptGreeting=async(id,o)=>{h.calls.push(['acceptGreeting',id,o.revision]);return {applied:true};};
  h.binding.openPanel('social');assert.match(h.body.innerHTML,/愿意认识你/);assert.match(h.body.innerHTML,/先不了，谢谢/);assert.equal(h.calls.some(c=>c[0]==='acceptGreeting'),false);
  await h.click({greetingAction:'accept',id:greeting.id,revision:'3'});assert.deepEqual(h.calls.filter(c=>c[0]==='acceptGreeting'),[['acceptGreeting',greeting.id,3]]);
});

test('sender can cancel the pending request but the rendered outgoing row never offers acceptance',async()=>{
  const g={...greeting,senderId:actor,recipientId:otherId},h=harness(initial({social:socialState({outgoing:[g]})}));
  h.controller.cancelGreeting=async(id,o)=>{h.calls.push(['cancelGreeting',id,o.revision]);return {applied:true};};h.binding.openPanel('social');
  assert.match(h.body.innerHTML,/撤回招呼/);assert.doesNotMatch(h.body.innerHTML,/data-greeting-action="accept"/);
  await h.click({greetingAction:'cancel',id:g.id,revision:String(g.revision)});assert.deepEqual(h.calls.filter(c=>c[0]==='cancelGreeting'),[['cancelGreeting',g.id,3]]);
});

test('block has a named confirmation and uses the reviewed peer, never an implicit action on opening',async()=>{
  const s=initial({room:room(),route:{kind:'room',target:roomId},members:[peer],social:socialState()}),h=harness(s);
  h.controller.blockUser=async id=>{h.calls.push(['blockUser',id]);h.emit({...s,members:[],social:socialState({blocks:[{userId:id,peer,revision:1}]})});return {applied:true};};
  h.binding.openPanel('block-user',otherId);assert.match(h.body.innerHTML,/Synthetic peer/);assert.equal(h.calls.some(c=>c[0]==='blockUser'),false);
  await h.click({socialBlock:otherId});assert.deepEqual(h.calls.filter(c=>c[0]==='blockUser'),[['blockUser',otherId]]);
});

test('a blocked peer/photo disappearing from canonical room state removes the visible photo and its blob',async()=>{
  const p={...photo(2),ownerId:otherId,visibility:'members'},s=initial({room:room(),route:{kind:'room',target:roomId},photos:[p],members:[peer],social:socialState()}),h=harness(s);
  h.binding.cache(p.id,'blob:before-block');h.binding.openPanel('photo',p.id);assert.match(h.body.innerHTML,/blob:before-block/);
  h.emit({...s,members:[],photos:[],social:socialState({blocks:[{userId:otherId,peer,revision:1}]})});await tick();assert.ok(h.revoked.includes('blob:before-block'));assert.equal(h.get().panelKind,null);
});

test('removal and unblock stay separate explicit revision-bound actions',async()=>{
  const s=initial({social:socialState({friends:[{userId:otherId,peer,revision:7}],blocks:[{userId:otherId,peer,revision:9}]})}),h=harness(s);
  h.controller.removeFriend=async(id,o)=>{h.calls.push(['removeFriend',id,o.revision]);return {applied:true};};h.controller.unblockUser=async(id,o)=>{h.calls.push(['unblockUser',id,o.revision]);return {applied:true};};
  h.binding.openPanel('remove-friend',otherId);assert.match(h.body.innerHTML,/data-revision="7"/);await h.click({socialRemove:otherId,revision:'7'});
  h.binding.openPanel('unblock-user',otherId);assert.match(h.body.innerHTML,/不会恢复原来的朋友/);await h.click({socialUnblock:otherId,revision:'9'});
  assert.deepEqual(h.calls.filter(c=>['removeFriend','unblockUser'].includes(c[0])),[['removeFriend',otherId,7],['unblockUser',otherId,9]]);
});

test('invalid identity clears private social panels instead of leaving old relationship names visible',()=>{
  const s=initial({social:socialState({incoming:[greeting]})}),h=harness(s);h.binding.openPanel('social');assert.match(h.body.innerHTML,/Synthetic peer/);
  h.emit({...s,identity:{...s.identity,status:'invalid'},social:socialState()});assert.ok(h.panel.hidden);assert.doesNotMatch(h.body.innerHTML,/Synthetic peer/);
});

test('late social-list load does not reopen a panel after newer navigation',async()=>{
  const h=harness(),pending=defer();h.controller.loadSocial=()=>pending.promise;
  const old=h.click({open:'social'});await h.click({open:'entry'});pending.resolve({applied:true});await old;assert.equal(h.get().panelKind,'entry');
});

test('recovered social operation review names its frozen peer without any credentials',()=>{
  const h=harness(initial({pending:[{id:'op',type:'acceptGreeting',target:{userId:otherId,name:'Synthetic <peer>'},status:'uncertain',durable:true}]}));h.binding.openPanel('pending');
  assert.match(h.body.innerHTML,/接受招呼/);assert.match(h.body.innerHTML,/Synthetic &lt;peer&gt;/);assert.doesNotMatch(h.body.innerHTML,/Bearer|Idempotency-Key/);
});

test('stale social refresh never claims that a historical accept receipt is current friendship',async()=>{
  const h=harness(initial({social:socialState({incoming:[greeting],stale:true})}));h.controller.acceptGreeting=async()=>({applied:true});h.binding.openPanel('social');
  await h.click({greetingAction:'accept',id:greeting.id,revision:'3'});assert.match(h.element('#toast').textContent,/等待更新/);assert.doesNotMatch(h.element('#toast').textContent,/已经成为朋友/);
});

test('a social read failure cannot prevent the independently available invited-room preview',async()=>{
  const h=harness(initial(),'https://musicspace.test/event/?room=AAAAAAAAAAAA');h.controller.loadSocial=async()=>{throw Error('synthetic social outage');};await h.binding.boot();
  assert.equal(h.get().panelKind,'preview');assert.equal(h.get().state.preview.code,'AAAAAAAAAAAA');
});

test('successful identity re-verification reloads cleared authorized photos even with unchanged metadata',async()=>{
  const p={...photo(),visibility:'members'},s=initial({room:room(),route:{kind:'room',target:roomId},photos:[p]}),h=harness(s);h.binding.cache(p.id,'blob:old');
  h.emit({...s,identity:{...s.identity,status:'unverified'}});assert.ok(h.revoked.includes('blob:old'));h.emit(s);await tick();
  assert.ok(h.calls.some(c=>c[0]==='fetchPhotoBlob'&&c[1]===p.id));assert.ok(h.get().urls.some(([id])=>id===p.id));
});

test('background scene loads only six shared wall images while explicit gallery can load its full24 batch',async()=>{
  const photos=Array.from({length:25},(_,i)=>({...photo(i+1),visibility:'members'})),h=harness(initial({room:room(),route:{kind:'room',target:roomId},photos}));
  await h.binding.synchronizePhotos();assert.equal(h.calls.filter(c=>c[0]==='fetchPhotoBlob').length,6);
  h.binding.openPanel('wall');await tick();assert.equal(new Set(h.calls.filter(c=>c[0]==='fetchPhotoBlob').map(c=>c[1])).size,24);
});

test('stale person relation is explicitly last confirmed rather than asserted current friendship',()=>{
  const h=harness(initial({social:socialState({friends:[{userId:otherId,peer,revision:1}],stale:true})}));h.binding.openPanel('person',otherId);
  assert.match(h.body.innerHTML,/上次确认/);assert.doesNotMatch(h.body.innerHTML,/你们已经互相同意成为朋友/);
});

test('ignored duplicate block confirmation never invalidates the original success feedback',async()=>{
  const s=initial({room:room(),route:{kind:'room',target:roomId},members:[peer],social:socialState()}),h=harness(s),pending=defer();let calls=0;
  h.controller.blockUser=async()=>{calls++;await pending.promise;h.emit({...s,members:[],social:socialState({blocks:[{userId:otherId,peer,revision:1}]})});return {applied:true};};
  h.binding.openPanel('block-user',otherId);await h.click({socialBlock:otherId});await h.click({socialBlock:otherId});pending.resolve();await tick();
  assert.equal(calls,1);assert.equal(h.get().panelKind,'blocked');assert.match(h.body.innerHTML,/屏蔽列表/);
});

test('explicit block is not held behind an in-flight acceptance and older feedback cannot override it',async()=>{
  const s=initial({room:room(),route:{kind:'room',target:roomId},members:[peer],social:socialState({incoming:[greeting]})}),h=harness(s),pending=defer();
  h.controller.acceptGreeting=()=>pending.promise;h.controller.blockUser=async id=>{h.calls.push(['blockUser',id]);h.emit({...s,members:[],social:socialState({blocks:[{userId:id,peer,revision:1}]})});return {applied:true};};
  h.binding.openPanel('social');await h.click({greetingAction:'accept',id:greeting.id,revision:'3'});await h.click({open:'block-user',id:otherId});await h.click({socialBlock:otherId});
  assert.equal(h.calls.some(c=>c[0]==='blockUser'),true);assert.equal(h.get().panelKind,'blocked');pending.resolve({applied:true});await tick();assert.equal(h.get().panelKind,'blocked');
});

test('an ended show never offers a new greeting while existing incoming requests stay actionable',()=>{
  const ended={...room(),status:'closed'},h=harness(initial({room:ended,route:{kind:'room',target:roomId},members:[peer],social:socialState()}));h.binding.openPanel('person',otherId);
  assert.doesNotMatch(h.body.innerHTML,/data-social-send/);assert.match(h.body.innerHTML,/这一场已结束/);
  h.emit({...h.get().state,social:socialState({incoming:[greeting]})});assert.match(h.body.innerHTML,/data-greeting-action="accept"/);
});

test('unchanged polling emissions preserve the existing social DOM instead of replacing focused controls',()=>{
  const s=initial({social:socialState({incoming:[greeting]})}),h=harness(s);h.binding.openPanel('social');let html=h.body.innerHTML,writes=0;
  Object.defineProperty(h.body,'innerHTML',{get:()=>html,set:value=>{writes++;html=value;},configurable:true});h.emit(s);h.emit({...s,loading:['social']});h.emit(s);
  assert.equal(writes,0);
});

test('changed social markup restores keyboard focus by stable request/action/revision key',()=>{
  const s=initial({social:socialState({incoming:[greeting]})}),h=harness(s);h.binding.openPanel('social');let focused=false;
  const attrs={'data-greeting-action':'accept','data-id':greeting.id,'data-revision':'3'},old={tagName:'BUTTON',getAttribute:key=>attrs[key]||null},next={tagName:'BUTTON',getAttribute:key=>attrs[key]||null,focus(){focused=true;}};
  h.document.activeElement=old;h.body.contains=node=>node===old;h.body.querySelectorAll=()=>[next];
  h.emit({...s,social:socialState({incoming:[{...greeting,peer:{...peer,name:'Changed nickname'}}]})});assert.equal(focused,true);
});

test('opening a later-page friend uses bounded canonical peer lookup rather than discarding it with page1',async()=>{
  const friend={userId:otherId,peer,revision:7},h=harness(initial({social:socialState({friends:[friend]})}));
  h.controller.loadSocial=async()=>{h.emit({...h.get().state,social:socialState()});return {applied:true};};
  h.controller.loadSocialPeer=async id=>{h.calls.push(['loadSocialPeer',id]);return {applied:true};};
  h.binding.openPanel('friends');await h.click({open:'person',id:otherId});assert.deepEqual(h.calls.filter(c=>c[0]==='loadSocialPeer'),[['loadSocialPeer',otherId]]);assert.match(h.body.innerHTML,/移除朋友/);assert.match(h.body.innerHTML,/Synthetic peer/);
});

test('visible departed-home social state catches remote friend removal on the next5s poll without reload',async()=>{
  const s=initial({social:socialState({friends:[{userId:otherId,peer,revision:2}]})}),h=harness(s);
  h.controller.loadSocial=async()=>{h.calls.push(['loadSocial']);h.emit({...s,social:socialState()});return {applied:true};};
  await h.runPoll();assert.equal(h.get().state.social.friends.length,0);assert.equal(h.calls.filter(c=>c[0]==='loadSocial').length,1);
});

test('returning to a visible window refreshes departed-home state immediately and coalesces simultaneous focus',async()=>{
  const s=initial({social:socialState({friends:[{userId:otherId,peer,revision:2}]})}),h=harness(s),pending=defer();let calls=0;
  h.controller.loadSocial=async()=>{calls++;await pending.promise;h.emit({...s,social:socialState()});return {applied:true};};
  await h.setVisible(false);await h.focusWindow();assert.equal(calls,0,'hidden page has no social polling');
  await h.setVisible(true);await h.focusWindow();assert.equal(calls,1,'visibility and focus share one in-flight read');pending.resolve();await tick();
  assert.equal(h.get().state.social.friends.length,0);
});


test('first wardrobe identity save returns to the reviewed invitation with unchecked join consent',async()=>{
 const preview={...room(),code:'AAAAAAAAAAAA'},h=harness(initial({identity:{status:'missing',user:null},preview,route:{kind:'preview',target:'AAAAAAAAAAAA'}}));
 h.binding.setWardrobeReturn({kind:'preview',code:'AAAAAAAAAAAA'});h.controller.establishIdentity=async()=>({applied:true});
 await h.binding.saveWardrobeProfile({name:'First identity',avatar:DEFAULT_AVATAR},{});
 assert.equal(h.get().panelKind,'preview');assert.equal(h.get().state.preview.code,'AAAAAAAAAAAA');assert.equal(h.calls.some(c=>c[0]==='joinRoom'),false);
});

test('successful wardrobe save is not changed to failure by a later room-refresh outage',async()=>{
 const h=harness(initial({room:room(),route:{kind:'room',target:roomId}}));h.controller.saveProfile=async()=>({applied:true});h.controller.refreshRoom=async()=>{throw Error('Synthetic read outage');};
 await assert.doesNotReject(()=>h.binding.saveWardrobeProfile({name:'Saved',avatar:DEFAULT_AVATAR},{revision:1}));await tick();
 assert.match(h.element('#toast').textContent,/已保存/);
});

test('first wardrobe identity result cannot reopen its old invitation after newer navigation',async()=>{
 const gate=defer(),preview={...room(),code:'AAAAAAAAAAAA'},h=harness(initial({identity:{status:'missing',user:null},preview}));h.binding.setWardrobeReturn({kind:'preview',code:preview.code});h.controller.establishIdentity=()=>gate.promise;
 const save=h.binding.saveWardrobeProfile({name:'First',avatar:DEFAULT_AVATAR},{});await h.click({open:'entry'});gate.resolve({applied:true});await save;assert.equal(h.get().panelKind,'entry');
});


test('cross-tab credential storage change clears the old view and reloads once rather than reconnecting the old controller',async()=>{
 const previous=initial({room:room(),route:{kind:'room',target:roomId}}),h=harness(previous);h.binding.openPanel('people');let changed=true;
 h.controller.syncStoredIdentity=()=>{if(!changed)return false;changed=false;h.emit({...previous,identity:{status:'unverified',user:null,requiresReload:true},room:null,members:[],photos:[]});return true;};
 await h.storageChanged('music-space-avatar-session:v1');await h.online();await h.focusWindow();
 assert.equal(h.calls.filter(c=>c[0]==='reload').length,1);assert.equal(h.calls.filter(c=>c[0]==='connect').length,0);assert.equal(h.get().panelKind,null);
});

test('ordinary online recovery with unchanged credentials retains the selected view',async()=>{
 const h=harness(initial({room:room(),route:{kind:'room',target:roomId}}));h.binding.openPanel('people');h.controller.syncStoredIdentity=()=>false;await h.online();
 assert.equal(h.calls.filter(c=>c[0]==='connect').length,1);assert.equal(h.calls.filter(c=>c[0]==='reload').length,0);assert.equal(h.get().panelKind,'people');
});

test('real scene photo target opens only its current authorized photo, and pointer handlers exist',()=>{
 const p=photo(),h=harness(initial({room:room(),route:{kind:'room',target:roomId},photos:[p]}));
 assert.ok(h.element('#world').events.has('pointerdown'));assert.ok(h.element('#world').events.has('pointerup'));
 h.binding.scenePicked({kind:'photo',id:p.id});assert.equal(h.get().panelKind,'photo');assert.equal(h.get().panelTarget,p.id);
 h.binding.closePanel();h.binding.scenePicked({kind:'photo',id:'withdrawn-or-other-room'});assert.equal(h.get().panelKind,null);
});

test('mouse pointerup followed by its compatibility click cannot close the selected photo detail',async()=>{
 const p=photo(),h=harness(initial({room:room(),route:{kind:'room',target:roomId},photos:[p]}));await tick();
 const stage=h.element('#world'),target={tagName:'CANVAS',closest:()=>null};let picks=0;h.engine.pick=()=>{picks++;return {kind:'photo',id:p.id};};
 for(const pointerType of ['mouse','touch']){
  h.binding.closePanel();const event={button:0,pointerId:1,pointerType,clientX:680,clientY:325,target};
  for(const fn of stage.events.get('pointerdown')||[])fn(event);
  for(const fn of stage.events.get('pointerup')||[])fn(event);
  for(const fn of stage.events.get('click')||[])fn(event);
  for(const fn of h.document.events.get('click')||[])await fn(event);
  assert.equal(h.get().panelKind,'photo');assert.equal(h.get().panelTarget,p.id);
 }
 assert.equal(picks,2,'one pick per mouse/touch selection, never a second legacy click navigation');
});

test('quick identity shows nickname and optional wardrobe, preserves chosen parts and returns to the exact consent preview',async()=>{
 const look={...DEFAULT_AVATAR,hair:7,eyewear:0,top:4,bottom:2,shoes:3,accessory:'chain'},preview={...room(),code:'AAAAAAAAAAAA'};
 const h=harness(initial({identity:{status:'missing',user:null},route:{kind:'preview',target:preview.code},preview,drafts:{profile:{name:'Draft',avatar:look},room:null,photo:null}}));
 h.binding.openPanel('preview');h.binding.openPanel('profile');
 assert.match(h.body.innerHTML,/先留个昵称/);assert.match(h.body.innerHTML,/data-illustrated-avatar="1"/);assert.match(h.body.innerHTML,/data-open="wardrobe"/);assert.doesNotMatch(h.body.innerHTML,/<select/);
 let saved,joins=0;h.controller.establishIdentity=async profile=>{saved=clone(profile);h.emit({...h.get().state,identity:{status:'ready',user:{id:actor,name:profile.name,avatar:profile.avatar,revision:1}}});return {applied:true};};h.controller.joinRoom=async()=>{joins++;};
 h.submit('profile',{name:'Quick name'});await tick();await tick();
 assert.deepEqual(saved,{name:'Quick name',avatar:look});assert.equal(h.get().panelKind,'preview');assert.equal(h.get().state.preview.code,preview.code);assert.match(h.body.innerHTML,/data-form="join"/);assert.doesNotMatch(h.body.innerHTML,/checked/);assert.equal(joins,0,'saving a nickname never silently accepts joining');
});

test('a committed arrival with a failed room read shows exact-room recovery instead of closing into an empty view',async()=>{
 const h=harness(initial({route:{kind:'preview',target:'AAAAAAAAAAAA'},preview:{...room(),code:'AAAAAAAAAAAA'}}));
 let joins=0;h.controller.joinRoom=async()=>{joins++;return {applied:true,room:room(),actorId:actor};};
 h.binding.openPanel('preview');h.submit('join',{consent:'on'},{code:'AAAAAAAAAAAA'});await tick();
 assert.equal(joins,1);assert.equal(h.get().panelKind,'arrival');assert.match(h.body.innerHTML,/入场已确认/);assert.match(h.body.innerHTML,/data-arrival-retry/);
 const reads=[];h.controller.openRoom=async id=>{reads.push(id);h.emit({...h.get().state,room:room(),route:{kind:'room',target:id}});return {applied:true};};
 await h.click({arrivalRetry:''});assert.deepEqual(reads,[roomId]);assert.equal(joins,1);assert.equal(h.get().panelKind,null);
});

test('opening and paging recap does not navigate the active room and close restores room-photo scope',async()=>{
 const active=room(otherId),past=room(),p={...photo(),visibility:'private'},requests=[];
 const h=harness(initial({room:active,route:{kind:'room',target:otherId},photos:[]}));
 h.controller.loadRoomRecap=async(id,options)=>{requests.push([id,clone(options)]);const recap={roomId:id,room:{...past,joined:false},actorId:actor,loaded:true,photos:{items:[p],nextCursor:options.photosCursor?null:p.id},friends:{items:[],nextCursor:null},...options};h.emit({...h.get().state,recap});return {applied:true,...recap};};
 let cleared=0;h.controller.clearRoomRecap=()=>{cleared++;h.emit({...h.get().state,recap:null});};
 await h.click({open:'recap',id:roomId});await tick();assert.equal(h.get().panelKind,'recap');assert.equal(h.get().state.room.id,otherId);assert.match(h.body.innerHTML,/离场后只保留自己的照片/);assert.match(h.body.innerHTML,/输入另一个现场的邀请码/);
 await h.click({recapPage:'photos',recapDir:'next'});await tick();assert.deepEqual(requests.at(-1),[roomId,{photosCursor:p.id,friendsCursor:null}]);assert.equal(h.get().state.route.target,otherId);
 h.binding.closePanel();await tick();assert.equal(cleared,1);assert.equal(h.get().panelKind,null);assert.equal(h.get().state.room.id,otherId);assert.equal(h.get().urls.length,0);
});

test('recap returns after photo details without pretending an unknown author is the viewer',async()=>{
 const p={...photo(),ownerId:otherId,visibility:'members'},r=room(),h=harness(initial({room:r,route:{kind:'room',target:r.id}}));
 h.controller.loadRoomRecap=async()=>{h.emit({...h.get().state,recap:{roomId,room:r,actorId:actor,loaded:true,photos:{items:[p],nextCursor:null},friends:{items:[],nextCursor:null},photosCursor:null,friendsCursor:null}});return {applied:true};};
 h.controller.refreshRoomRecap=async()=>({applied:true});await h.click({open:'recap',id:roomId});await h.click({photo:p.id});assert.match(h.body.innerHTML,/同场观众的视角/);assert.match(h.body.innerHTML,/data-recap-back/);assert.doesNotMatch(h.body.innerHTML,/<h2>我的视角/);
 await h.click({recapBack:''});assert.equal(h.get().panelKind,'recap');assert.equal(h.get().panelTarget,roomId);
});

test('leaving opens only the just-left event recap, while old shared-photo URLs are removed',async()=>{
 const r=room(),p={...photo(),ownerId:otherId,visibility:'members'},h=harness(initial({room:r,route:{kind:'room',target:r.id},photos:[p]}));
 h.binding.cache(p.id,'blob:must-revoke');h.controller.leaveRoom=async()=>{h.emit({...h.get().state,room:null,members:[],photos:[],route:{kind:'home',target:null}});return {applied:true};};
 const reads=[];h.controller.loadRoomRecap=async id=>{reads.push(id);h.emit({...h.get().state,recap:{roomId:id,room:{...r,joined:false},actorId:actor,loaded:true,photos:{items:[],nextCursor:null},friends:{items:[],nextCursor:null},photosCursor:null,friendsCursor:null}});return {applied:true};};
 h.binding.openPanel('leave');await h.click({confirm:'leave'});await tick();assert.deepEqual(reads,[roomId]);assert.equal(h.get().panelKind,'recap');assert.equal(h.get().state.room,null);assert.ok(h.revoked.includes('blob:must-revoke'));assert.equal(h.get().urls.length,0);
});
