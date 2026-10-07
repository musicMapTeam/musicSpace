import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {escape as esc} from '../web/avatar/model.js';
import {pendingSavedMessageNotice} from '../web/event-room/chat-panel.js';
const confirmed={type:'send',saved:true,peerId:'peer-a',messageId:'message-a'};
test('a confirmed server save remains explicit when its history refresh has not arrived',()=>{
 assert.match(pendingSavedMessageNotice({lastResult:confirmed,current:{peerId:'peer-a',messages:[]},error:{message:'网络断开'}}),/服务已收到上一条.*无需重发/);
});
test('pending or unrelated messages never claim server confirmation',()=>{
 assert.equal(pendingSavedMessageNotice({lastResult:null,current:{peerId:'peer-a',messages:[]}}),null);
 assert.equal(pendingSavedMessageNotice({lastResult:{...confirmed,saved:false},current:{peerId:'peer-a',messages:[]}}),null);
 assert.equal(pendingSavedMessageNotice({lastResult:confirmed,current:{peerId:'peer-b',messages:[]}}),null);
});
test('confirmed history replacing the provisional save notice removes the notice',()=>{
 assert.equal(pendingSavedMessageNotice({lastResult:confirmed,current:{peerId:'peer-a',messages:[{id:'message-a'}]}}),null);
});

// Thread placement in a DOM shell; pixels and real layout need browser QA. The shell copies the desktop panel: a 395 px thread that the
// pending row (29 px) and a .chat-problem line (70 px) shrink from below without moving scrollTop; growing back clamps scrollTop.
const ME='00000000-0000-4000-8000-000000000001',PEER='00000000-0000-4000-8000-000000000002',ROW=90,PAD=41,TOP=100,READ='2026-10-07T20:00:01.000Z';
const panelSource=readFileSync(new URL('../web/event-room/chat-panel.js',import.meta.url),'utf8').replace(/^import .*;$/gm,'').replace(/^export function /gm,'function ');
function chatShell(){
 const el=(props={})=>{const on={};return Object.defineProperties({hidden:false,disabled:false,value:'',textContent:'',innerHTML:'',dataset:{},setAttribute(){},append(){},remove(){},focus(){},contains:()=>false,querySelector:()=>null,querySelectorAll:()=>[],
  addEventListener(type,fn){(on[type]??=[]).push(fn);},fire:(type,event={})=>Promise.all((on[type]||[]).map(fn=>fn(event)))},Object.getOwnPropertyDescriptors(props));};
 const parts=new Map(),part=selector=>parts.get(selector)||parts.set(selector,el()).get(selector),problem=part('.chat-problem'),pending=part('.chat-pending');
 let rows=[],top=0;
 const thread=el({get clientHeight(){return 395-(problem.textContent?70:0)-(pending.innerHTML?29:0);},get scrollHeight(){return Math.max(this.clientHeight,PAD+rows.length*ROW);},
  get scrollTop(){return top=Math.max(0,Math.min(top,this.scrollHeight-this.clientHeight));},set scrollTop(value){top=value;void this.scrollTop;},
  getBoundingClientRect(){return{top:TOP,bottom:TOP+this.clientHeight,left:0,right:400,width:400,height:this.clientHeight};}});
 const messages=el({set innerHTML(html){rows=[...html.matchAll(/data-message="([^"]+)" (data-incoming)?/g)].map(([,id,incoming],i)=>({id,incoming:!!incoming,i}));},set textContent(_){rows=[];},
  querySelectorAll:selector=>rows.filter(row=>selector!=='[data-incoming]'||row.incoming).map(row=>({dataset:{message:row.id},contains:()=>true,
   getBoundingClientRect(){const y=TOP+20+row.i*ROW-thread.scrollTop;return{top:y,bottom:y+ROW-18,left:20,right:380,width:360,height:ROW-18};}}))});
 parts.set('.chat-thread',thread);parts.set('.chat-messages',messages);
 const line=(id,from,readAt=null)=>({id,senderId:from,recipientId:from===ME?PEER:ME,text:id,createdAt:READ,readAt});
 const state={actorId:ME,identityStatus:'ready',list:{items:[],nextCursor:null,loaded:true,totalUnreadCount:0},current:null,draft:'',error:null,storage:{ok:true,refreshRecovery:true,message:null},lastResult:null,outbox:[],loading:[]};
 let listener,sends=0,unconfirmed=false;const acknowledged=[],emit=()=>listener?.(structuredClone(state));
 const client={getState:()=>structuredClone(state),subscribe(fn){listener=fn;emit();},syncIdentity(){},async list(){},async refresh(){},close(){state.current=null;emit();},dispose(){},
  async open(peer){state.current={peerId:peer,chat:{peer:{name:'Peer'},canSend:true,receiptsAvailable:false},messages:[line('welcome-1',PEER,READ),line('welcome-2',PEER,READ),line('own-0',ME),line('reply-1',PEER,READ)],olderCursor:null,newerCursor:null,loaded:true};emit();},
  setDraft(text){state.draft=text;emit();},
  // The controller's emits for one confirmed send: the pending row, then the saved notice, then the refreshed history.
  async send(){const text=state.draft;state.outbox=[{id:'op',type:'send',peerId:PEER,text,status:'running',error:null,durable:true}];emit();await null;
   if(unconfirmed){unconfirmed=false;const error={message:'网络没有回应，请稍后重试',code:'NETWORK',status:0,retryable:true,uncertain:true};state.outbox=[{...state.outbox[0],status:'uncertain',error}];state.error=error;emit();throw Object.assign(new Error(error.message),error);}
   return this.retry('op');},
  async retry(op){const id=`own-${++sends}`,text=state.outbox.find(p=>p.id===op).text;state.outbox=[{id:op,type:'send',peerId:PEER,text,status:'running',error:null,durable:true}];state.error=null;emit();await null;
   state.outbox=[];state.draft='';state.lastResult={type:'send',operationId:op,peerId:PEER,messageId:id,saved:true};emit();await null;
   state.current.messages=[...state.current.messages,line(id,ME)];emit();return{message:{id}};},
  async acknowledge(ids){acknowledged.push(...ids);state.current.messages=state.current.messages.map(m=>ids.includes(m.id)?{...m,readAt:READ}:m);emit();return{acknowledged:ids};}};
 const timers=new Map();let timerId=0;
 const sandbox=vm.createContext({document:{createElement:()=>el({querySelector:part}),activeElement:null,hidden:false,addEventListener(){},removeEventListener(){},elementFromPoint:()=>({})},window:{innerWidth:1440,innerHeight:900},
  setTimeout:(fn,ms)=>{timers.set(++timerId,{fn,ms});return timerId;},clearTimeout:id=>timers.delete(id),esc,renderAvatarSvg:()=>'',createChatController:()=>client,console});
 vm.runInContext(panelSource+'\nglobalThis.create=createChatPanel;',sandbox);
 const panel=sandbox.create({container:el()});
 return{panel,thread,acknowledged,gap:()=>thread.scrollHeight-thread.scrollTop-thread.clientHeight,
  async say(text){part('textarea').value=text;await part('form').fire('submit',{preventDefault(){}});},
  unconfirmNextSend(){unconfirmed=true;},
  async retry(){const button={dataset:{chatRetry:'op'}};await part('.chat-pending').fire('click',{target:{closest:()=>button}});await new Promise(done=>setImmediate(done));},
  reply(id){state.error=null;state.current.messages=[...state.current.messages,line(id,PEER)];emit();},
  fail(message){state.error={message,code:'NETWORK',status:0,retryable:true,uncertain:true};emit();},
  async scrollTo(y){thread.scrollTop=y;await thread.fire('scroll');},
  async ack(){for(const [id,timer] of [...timers])if(timer.ms===350){timers.delete(id);await timer.fn();}}};
}
test('the pending row and saved notice shrinking the thread never leave the sent message or the next reply below the fold',async()=>{
 const h=chatShell();await h.panel.open(PEER);assert.equal(h.gap(),0);
 await h.say('second');assert.equal(h.gap(),0,'the visitor sees the message just sent');
 h.reply('reply-2');assert.equal(h.gap(),0,'the reply lands in view');
 await h.ack();assert.deepEqual(h.acknowledged,['reply-2']);
});
test('a reader resting at the bottom stays there when another status line shrinks the thread before the reply',async()=>{
 const h=chatShell();await h.panel.open(PEER);await h.say('second');
 h.fail('结果未确认，可以重发原消息');h.reply('reply-2');assert.equal(h.gap(),0);
 await h.ack();assert.deepEqual(h.acknowledged,['reply-2']);
});
test('a reader who scrolled up to read history is not moved by a reply, and the reply stays unread until seen',async()=>{
 const h=chatShell();await h.panel.open(PEER);await h.say('second');h.reply('reply-2');await h.ack();
 await h.scrollTo(0);h.reply('reply-3');assert.equal(h.thread.scrollTop,0);
 await h.ack();assert.equal(h.acknowledged.includes('reply-3'),false);
 await h.scrollTo(1e4);await h.ack();assert.equal(h.acknowledged.includes('reply-3'),true);
});
test('sending while scrolled up brings the sent message and the reply after it into view',async()=>{
 const h=chatShell();await h.panel.open(PEER);await h.say('second');h.reply('reply-2');await h.ack();
 await h.scrollTo(0);await h.say('third');assert.equal(h.gap(),0);
 h.reply('reply-3');assert.equal(h.gap(),0);await h.ack();assert.deepEqual(h.acknowledged,['reply-2','reply-3']);
});
test('retrying an unconfirmed send from history brings that message into view once it is saved',async()=>{
 const h=chatShell();await h.panel.open(PEER);await h.say('second');h.reply('reply-2');await h.ack();
 h.unconfirmNextSend();await h.say('third');await h.scrollTo(0);assert.equal(h.thread.scrollTop,0);
 await h.retry();assert.equal(h.gap(),0);
});
