// DOM callback shell only; layout/pixels and actual pointers need browser QA.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {escape as esc} from '../web/avatar/model.js';
const source=readFileSync(new URL('../web/event-room/moderation-panel.js',import.meta.url),'utf8').replace(/^import .*;$/gm,'').replace('export function createModerationPanel','function createModerationPanel');
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`,h=id(1),a=id(2),b=id(3),r=id(4),p=id(5),report={id:id(6),roomId:r,targetId:b,targetName:'Target <script>',photoId:p,category:'spam',details:'Untrusted <script>alert(1)</script>',status:'open',revision:1};
const tick=()=>new Promise(done=>setImmediate(done));
function node(){const selectors=new Map(),events=new Map();return{hidden:false,innerHTML:'',textContent:'',dataset:{},scrollTop:0,setAttribute(){},append(){},remove(){},focus(){},contains(){return false;},querySelector(s){if(!selectors.has(s))selectors.set(s,node());return selectors.get(s);},querySelectorAll(){return[];},addEventListener(type,fn){const list=events.get(type)||[];list.push(fn);events.set(type,list);},events};}
function setup(actor=a){const root=node(),calls=[],document={createElement:()=>root,activeElement:{isConnected:true,focus(){}},hidden:false};let subscriber,state={actorId:actor,identityStatus:'ready',reports:{items:[],nextCursor:null,loaded:false},management:null,error:null,lastResult:null,storage:{ok:true},pending:[],loading:[]};
 const emit=()=>subscriber?.(structuredClone(state));
 const client={getState:()=>structuredClone(state),subscribe(fn){subscriber=fn;emit();},syncIdentity(){emit();},close(){state.management=null;emit();},async reports(){calls.push(['reports']);state.reports={items:[report],nextCursor:null,loaded:true};emit();},async management(roomId){calls.push(['management',roomId]);state.management={room:{id:r,title:'Synthetic show'},reports:{items:[report],nextCursor:null,loaded:true},exclusions:{items:[],nextCursor:null,loaded:true},loaded:true};emit();},async refresh(){calls.push(['refresh']);},async submitReport(...args){calls.push(['submitReport',...args]);return{committed:true,currentConfirmed:true};},async exclude(...args){calls.push(['exclude',...args]);return{committed:true,currentConfirmed:true};},async reportAction(...args){calls.push(['reportAction',...args]);return{committed:true,currentConfirmed:true};},async restore(...args){calls.push(['restore',...args]);return{committed:true,currentConfirmed:true};},dispose(){}};
 const ctx={actorId:actor,room:{id:r,title:'Synthetic show',joined:true,hostId:h},members:[{id:h,name:'Host'},{id:a,name:'Reporter'},{id:b,name:'Target <script>',joinedAt:'reviewed-time'}],photos:[{id:p,roomId:r,ownerId:b,visibility:'members'}]};
 const sandbox=vm.createContext({document,esc,createModerationController:()=>client,console});vm.runInContext(source+'\nglobalThis.create=createModerationPanel;',sandbox);const panel=sandbox.create({container:node(),getContext:()=>ctx,onChanged:()=>calls.push(['changed']),onViewPhoto:photoId=>calls.push(['photo',photoId])});
 return{setState(next){Object.assign(state,next);emit();},root,body:root.querySelector('.moderation-body'),client,panel,calls,ctx,async click(dataset){const button={dataset,hasAttribute:key=>Object.hasOwn(dataset,key.replace(/^data-/,'').replace(/-([a-z])/g,(_,c)=>c.toUpperCase())),closest:()=>button};for(const fn of root.events.get('click')||[])fn({target:button});await tick();},input(name,value){const target={name,value,checked:value};for(const fn of root.events.get('input')||[])fn({target});},async submit(){for(const fn of root.events.get('submit')||[])fn({preventDefault(){}});await tick();}};
}
test('feedback panel requires explicit consent and transmits only the chosen current target and literal details',async()=>{
 const q=setup();q.panel.openFeedback(q.ctx.members[2],{photoId:p});assert.equal(q.calls.some(c=>c[0]==='submitReport'),false);assert.match(q.body.innerHTML,/本场房主/);assert.match(q.body.innerHTML,/type="submit" disabled/);assert.doesNotMatch(q.body.innerHTML,/<script>/);
 q.input('details','Synthetic <script> literal');await q.submit();assert.equal(q.calls.some(c=>c[0]==='submitReport'),false);q.input('consent',true);await q.submit();
 const call=q.calls.find(c=>c[0]==='submitReport');assert.equal(call[1],r);assert.equal(call[2].targetId,b);assert.equal(call[2].photoId,p);assert.equal(call[2].reportConsent,true);assert.equal(call[2].details,'Synthetic <script> literal');assert.doesNotMatch(q.body.innerHTML,/<script>/);
});
test('opening host removal only shows named scope and sends nothing until the distinct confirmation button',async()=>{
 const q=setup(h);await q.panel.openManagement(r);await q.click({modReportRemove:report.id});assert.equal(q.calls.some(c=>c[0]==='exclude'),false);assert.match(q.body.innerHTML,/Target &lt;script&gt;/);assert.match(q.body.innerHTML,/只移出这一场，TA 在照片墙上的分享会撤下。/);
 await q.click({modConfirm:''});const call=q.calls.find(c=>c[0]==='exclude');assert.equal(call[1],r);assert.equal(call[2].id,b);assert.equal(call[3].report.id,report.id);assert.equal(call[3].removalConsent,true);
});
test('feedback refuses host self-review, unavailable photos and closing an unsent draft makes no submission',()=>{
 const q=setup();assert.throws(()=>q.panel.openFeedback(q.ctx.members[0]),/这是本场房主，你可以屏蔽 TA 或离场。/);assert.throws(()=>q.panel.openFeedback(q.ctx.members[2],{photoId:id(99)}),/这张照片看不到了。/);
 q.panel.openFeedback(q.ctx.members[2]);q.input('details','Unsent synthetic draft');q.panel.close();assert.equal(q.root.hidden,true);assert.equal(q.calls.some(c=>c[0]==='submitReport'),false);
});


test('restore admission clearly waits for the original unresolved removal and enables only after it is settled',async()=>{
 const q=setup(h);await q.panel.openManagement(r);const exclusion={roomId:r,userId:b,targetName:'Target',revision:1,active:true};
 const management={room:{id:r,title:'Synthetic show'},reports:{items:[report],nextCursor:null,loaded:true},exclusions:{items:[exclusion],nextCursor:null,loaded:true},loaded:true};
 const pending=[{id:id(90),type:'exclude',roomId:r,entityId:b,label:'Target',status:'uncertain',error:{message:'Original response not confirmed',uncertain:true}}];
 q.setState({management,pending});await q.click({modTab:'exclusions'});assert.match(q.body.innerHTML,/data-mod-restore="[^" ]+" disabled/);assert.match(q.body.innerHTML,/还有一步没完成，请先处理下方的记录。/);
 await q.click({modRestore:b});assert.equal(q.calls.some(call=>call[0]==='restore'),false);assert.doesNotMatch(q.body.innerHTML,/data-mod-confirm/);
 q.setState({pending:[]});await q.click({modRestore:b});assert.match(q.body.innerHTML,/data-mod-confirm >/);
 q.setState({pending});assert.match(q.body.innerHTML,/data-mod-confirm disabled/);await q.click({modConfirm:''});assert.equal(q.calls.some(call=>call[0]==='restore'),false);
 q.setState({pending:[]});await q.click({modConfirm:''});assert.equal(q.calls.filter(call=>call[0]==='restore').length,1);
});
