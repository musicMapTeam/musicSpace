// A deliberately small DOM shim for state/event behavior. This is NOT a browser,
// CSS layout, accessibility-tree, screen-reader, GPU or touch-device test.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createWardrobe } from '../web/event-room/wardrobe.js';
import { DEFAULT_AVATAR, TEMPLATES, applyLookPreset } from '../web/avatar/model.js';

const deferred = () => { let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject}; };
const dataKey = name => name.replace(/^data-/,'').replace(/-([a-z])/g,(_,c)=>c.toUpperCase());
const attrs = text => Object.fromEntries([...text.matchAll(/([\w-]+)(?:="([^"]*)")?/g)].map(m=>[m[1],m[2]??'']));
class NodeShim {
  constructor(doc,tag='div',attributes={}){this.doc=doc;this.tagName=tag;this.attributes=attributes;this.dataset=Object.fromEntries(Object.entries(attributes).filter(([k])=>k.startsWith('data-')).map(([k,v])=>[dataKey(k),v]));this.className=attributes.class||'';this.children=[];this.disabled=false;this.isConnected=true;this.listeners={};this.textContent='';this.value=attributes.value||'';}
  setAttribute(k,v){this.attributes[k]=String(v);}
  hasAttribute(k){return Object.hasOwn(this.attributes,k);}
  append(node){node.parent=this;this.children.push(node);}
  remove(){this.isConnected=false;if(this.parent)this.parent.children=this.parent.children.filter(n=>n!==this);}
  focus(){this.doc.activeElement=this;}
  closest(selector){return this.matches(selector)?this:this.parent?.closest(selector)||null;}
  matches(selector){
    if(selector==='.wardrobe-name input')return this.tagName==='input';
    if(selector.includes(':not([disabled])'))return !this.disabled&&this.matches(selector.replace(':not([disabled])',''));
    if(selector.startsWith('.'))return this.className.split(' ').includes(selector.slice(1));
    if(selector.startsWith('[')){const m=selector.match(/^\[([^=\]]+)(?:="([^"]*)")?\]$/);return Boolean(m&&this.hasAttribute(m[1])&&(m[2]===undefined||this.attributes[m[1]]===m[2]));}
    return this.tagName===selector;
  }
  querySelectorAll(selector){const selectors=selector.split(',').map(s=>s.trim()),all=[];const walk=n=>{for(const child of n.children){if(selectors.some(s=>child.matches(s)))all.push(child);walk(child);}};walk(this);return all;}
  querySelector(selector){return this.querySelectorAll(selector)[0]||null;}
  addEventListener(type,listener){this.listeners[type]=listener;}
  set innerHTML(html){
    const detach=n=>{for(const child of n.children){detach(child);child.isConnected=false;if(this.doc.activeElement===child)this.doc.activeElement=this.doc.body;}};detach(this);this.children=[];this.markup=html;
    if(this.className==='wardrobe'){
      for(const cls of ['wardrobe-figure','wardrobe-pieces','wardrobe-count','wardrobe-error'])this.append(new NodeShim(this.doc,'div',{class:cls}));
      const input=html.match(/<input\b([^>]*)>/);if(input)this.append(new NodeShim(this.doc,'input',attrs(input[1])));
      if(html.includes('class="wardrobe-examples"')){const details=new NodeShim(this.doc,'details',{class:'wardrobe-examples'});details.open=false;details.append(new NodeShim(this.doc,'summary'));this.append(details);}
    }
    if(this.className==='wardrobe'||this.className==='wardrobe-pieces'){
      for(const match of html.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/g)){
        const attributes=attrs(match[1]);
        // Part buttons are owned by the separately refreshed pieces node.
        if(this.className==='wardrobe'&&Object.hasOwn(attributes,'data-part'))continue;
        const b=new NodeShim(this.doc,'button',attributes);b.textContent=match[2].replace(/<[^>]*>/g,'');(Object.hasOwn(attributes,'data-preset')?this.querySelector('details')||this:this).append(b);
      }
    }
  }
  get innerHTML(){return this.markup||'';}
}
function fixture(t,{onSave=async()=>{},identity={id:'actor-a',revision:3,name:'Lin',avatar:{...DEFAULT_AVATAR}}}={}){
  const previous=globalThis.document,doc={activeElement:null,createElement(tag){return new NodeShim(doc,tag);}};doc.body=new NodeShim(doc,'body');const classes=new Set();doc.body.classList={add:x=>classes.add(x),remove:x=>classes.delete(x),contains:x=>classes.has(x)};doc.activeElement=doc.body;globalThis.document=doc;
  const container=new NodeShim(doc),opener=new NodeShim(doc,'button');opener.focus();const previews=[],saves=[];let closed=0,actor=identity;
  const wardrobe=createWardrobe({container,getIdentity:()=>actor,onSave:async(...args)=>{saves.push(structuredClone(args));return onSave(...args);},onPreview:a=>previews.push(structuredClone(a)),onClose:()=>closed++});
  const root=container.children[0];t.after(()=>{wardrobe.dispose();globalThis.document=previous;});
  const click=async selector=>{const target=root.querySelector(selector);assert.ok(target,`missing ${selector}`);return root.listeners.click({target});};
  const input=name=>{const target=root.querySelector('input');target.value=name;root.listeners.input({target});};
  return {wardrobe,root,doc,opener,saves,previews,click,input,setActor:x=>actor=x,get closed(){return closed;}};
}

test('wardrobe starts hidden; ordinary cancel makes no save and restores the opener', t=>{
  const f=fixture(t);assert.equal(f.root.hidden,true);f.wardrobe.open();assert.equal(f.wardrobe.isOpen,true);assert.equal(f.previews.length,1);f.wardrobe.close();assert.equal(f.saves.length,0);assert.equal(f.wardrobe.isOpen,false);assert.equal(f.root.hidden,true);assert.equal(f.closed,1);assert.equal(f.doc.activeElement,f.opener);
});

test('part changes preserve name and other parts; preview callbacks cannot mutate the draft', async t=>{
  const f=fixture(t);f.wardrobe.open();f.input('New name');const before=f.wardrobe.getDraft();await f.click('[data-value="3"]');const after=f.wardrobe.getDraft();assert.equal(after.name,'New name');assert.equal(after.avatar.hair,3);for(const key of Object.keys(before.avatar).filter(k=>k!=='hair'))assert.equal(after.avatar[key],before.avatar[key]);f.previews.at(-1).hair=7;assert.equal(f.wardrobe.getDraft().avatar.hair,3);assert.equal(f.saves.length,0);
});

test('component categories and choices precede optional collapsed combination examples',async t=>{
 const f=fixture(t);f.wardrobe.open();const markup=f.root.innerHTML;
 assert.ok(markup.indexOf('class="wardrobe-tabs"')<markup.indexOf('class="wardrobe-examples"'));
 assert.ok(markup.indexOf('class="wardrobe-pieces"')<markup.indexOf('class="wardrobe-examples"'));
 assert.match(markup,/换一件，其他保持不变/);assert.doesNotMatch(markup,/从一套开始/);
 const details=f.root.querySelector('details');assert.equal(details.open,false);assert.equal(details.querySelectorAll('[data-preset]').length,6);
 const original=f.wardrobe.getDraft();details.open=true;assert.deepEqual(f.wardrobe.getDraft(),original);
 for(const [category,value] of [['hair',7],['eyewear',0],['top',4],['bottom',2],['shoes',3],['accessory','chain']]){
  const before=f.wardrobe.getDraft();await f.click(`[data-category="${category}"]`);await f.click(`[data-value="${value}"]`);
  assert.deepEqual(f.wardrobe.getDraft(),{name:before.name,avatar:{...before.avatar,[category]:value}});
 }
 assert.equal(f.saves.length,0);f.wardrobe.close();f.wardrobe.open();assert.equal(f.root.querySelector('details').open,false);
});

test('bare eyes preview in all angles, cancel leaves saved glasses, explicit save sends only the chosen change',async t=>{
 const original={...DEFAULT_AVATAR,eyewear:5,hair:7,skin:4},identity={id:'actor-a',revision:8,name:'Kai',avatar:original};
 const f=fixture(t,{identity});f.wardrobe.open();assert.equal(f.wardrobe.getDraft().avatar.eyewear,5);
 await f.click('[data-category="eyewear"]');assert.match(f.root.querySelector('.wardrobe-count').textContent,/可以不戴/);
 await f.click('[data-value="0"]');assert.equal(f.root.querySelector('[data-value="0"]').attributes['aria-pressed'],'true');
 for(const view of ['front','quarter','side','back']){await f.click(`[data-angle="${view}"]`);assert.match(f.root.querySelector('.wardrobe-figure').innerHTML,/<g data-layer="eyewear" data-part="0"><\/g>/);}
 assert.deepEqual(f.wardrobe.getDraft().avatar,{...original,eyewear:0});assert.equal(identity.avatar.eyewear,5);assert.equal(f.saves.length,0);
 f.wardrobe.close();f.wardrobe.open();assert.equal(f.wardrobe.getDraft().avatar.eyewear,5);
 await f.click('[data-category="eyewear"]');await f.click('[data-value="0"]');await f.click('[data-wardrobe-save]');
 assert.equal(f.saves.length,1);assert.deepEqual(f.saves[0],[{name:'Kai',avatar:{...original,eyewear:0}},{revision:8,actorId:'actor-a'}]);
});

test('preset application follows model contract: name, skin, expression and pose survive', async t=>{
  const identity={id:'actor-a',revision:2,name:'Personal name',avatar:{...DEFAULT_AVATAR,skin:4,expression:'wink',pose:'wave',accessory:'chain'}};const f=fixture(t,{identity});f.wardrobe.open();await f.click('[data-preset="4"]');const draft=f.wardrobe.getDraft();assert.equal(draft.name,identity.name);assert.deepEqual(draft.avatar,applyLookPreset(identity.avatar,TEMPLATES[4].avatar));for(const k of ['skin','expression','pose'])assert.equal(draft.avatar[k],identity.avatar[k]);
});

test('blank nickname cannot save and focuses the name input',async t=>{
  const f=fixture(t);f.wardrobe.open();f.input('   ');await f.click('[data-wardrobe-save]');assert.equal(f.saves.length,0);assert.match(f.root.querySelector('.wardrobe-error').textContent,/昵称/);assert.equal(f.doc.activeElement,f.root.querySelector('input'));
});

test('a double save click sends once with a frozen profile, captured actor and revision',async t=>{
  const gate=deferred(),f=fixture(t,{onSave:()=>gate.promise});f.wardrobe.open();const pending=f.click('[data-wardrobe-save]');await f.click('[data-wardrobe-save]');assert.equal(f.saves.length,1);assert.deepEqual(f.saves[0][1],{revision:3,actorId:'actor-a'});assert.equal(f.root.querySelector('[data-wardrobe-save]').disabled,true);gate.resolve();await pending;assert.equal(f.wardrobe.isOpen,false);
});

test('ordinary save rejection retains draft and enables retry',async t=>{
  let fail=true;const f=fixture(t,{onSave:async()=>{if(fail)throw Error('Synthetic offline');}});f.wardrobe.open();f.input('Draft name');await f.click('[data-value="3"]');const draft=f.wardrobe.getDraft();await f.click('[data-wardrobe-save]');assert.equal(f.wardrobe.isOpen,true);assert.deepEqual(f.wardrobe.getDraft(),draft);assert.equal(f.root.querySelector('[data-wardrobe-save]').disabled,false);assert.equal(f.root.querySelector('input').disabled,false);assert.match(f.root.querySelector('.wardrobe-error').textContent,/Synthetic offline/);fail=false;await f.click('[data-wardrobe-save]');assert.equal(f.saves.length,2);assert.equal(f.wardrobe.isOpen,false);
});

test('actor changed before save is rejected without submitting',async t=>{
  const f=fixture(t);f.wardrobe.open();f.setActor({id:'actor-b',revision:1,name:'Another person',avatar:{...DEFAULT_AVATAR}});await f.click('[data-wardrobe-save]');assert.equal(f.saves.length,0);assert.match(f.root.querySelector('.wardrobe-error').textContent,/身份已经变化/);
});

test('old save completion cannot close a more recently reopened wardrobe',async t=>{
  const gate=deferred(),f=fixture(t,{onSave:()=>gate.promise});f.wardrobe.open();const pending=f.click('[data-wardrobe-save]');f.wardrobe.close();f.wardrobe.open();f.input('New draft');gate.resolve();await pending;assert.equal(f.wardrobe.isOpen,true);assert.equal(f.wardrobe.getDraft().name,'New draft');
});

test('Escape cancels an unsaved draft without calling save',t=>{
  const f=fixture(t);f.wardrobe.open();let stopped=false;f.root.listeners.keydown({key:'Escape',stopPropagation(){stopped=true;}});assert.equal(f.saves.length,0);assert.equal(f.wardrobe.isOpen,false);assert.equal(stopped,true);
});

test('saving cannot be misleadingly cancelled while its write is still pending',async t=>{
  const gate=deferred(),f=fixture(t,{onSave:()=>gate.promise});f.wardrobe.open();const pending=f.click('[data-wardrobe-save]');await f.click('[data-wardrobe-close]');const remainsOpen=f.wardrobe.isOpen;gate.resolve();await pending;assert.equal(remainsOpen,true,'Either block close while saving or explicitly label continuation; current Cancel is misleading');
});

test('changing a part keeps keyboard focus on the replacement choice',async t=>{
  const f=fixture(t);f.wardrobe.open();const choice=f.root.querySelector('[data-value="3"]');choice.focus();await f.click('[data-value="3"]');assert.notEqual(f.doc.activeElement,f.doc.body);assert.equal(f.doc.activeElement.dataset.value,'3');assert.equal(f.doc.activeElement.isConnected,true);
});


test('identity replacement can force-close an in-flight wardrobe without a late completion reopening it',async t=>{
 const gate=deferred(),f=fixture(t,{onSave:()=>gate.promise});f.wardrobe.open();const save=f.click('[data-wardrobe-save]');f.wardrobe.close({force:true});f.setActor({id:'actor-b',revision:1,name:'B',avatar:{...DEFAULT_AVATAR}});assert.equal(f.wardrobe.isOpen,false);gate.resolve();await save;assert.equal(f.wardrobe.isOpen,false);assert.equal(f.closed,1);
});

test('uncertain save preserves the draft and requires original-operation recovery instead of a new save',async t=>{
 const f=fixture(t,{onSave:async()=>{const e=Error('unknown commit');e.uncertain=true;throw e;}});f.wardrobe.open();await f.click('[data-wardrobe-save]');await f.click('[data-wardrobe-save]');assert.equal(f.saves.length,1);assert.equal(f.root.querySelector('[data-wardrobe-save]').disabled,true);assert.match(f.root.querySelector('.wardrobe-error').textContent,/原内容重试/);f.wardrobe.close();assert.equal(f.wardrobe.isOpen,false);
});
