import './exchange-panel.css';
import {escape as esc} from '../avatar/model.js';
import {createExchangeController} from '../event-client/exchange-controller.js';
import {offerSuggestions} from './moment-model.js';
import {PLACEHOLDER,optionLabel,optionsMarkup,suggestionMarkup} from './exchange-suggest.js';

// The chosen photo written out under the select (doodle/panels-core.css lays the transparent select over it): 「我的第 1 张 · 已上墙」 kept whole, then what
// the rule says about it, which takes a line of its own when the two do not fit; the text is the option's own label (optionLabel()).
const SEP=' · ';
function chosenMarkup(row){if(!row)return esc(PLACEHOLDER);const [number,wall,...rest]=optionLabel(row).split(SEP),verdict=rest.join(SEP),head=`<span class="nowrap">${esc([number,wall].filter(Boolean).join(SEP))}</span>`;if(!verdict)return head;return `<span class="pc-dots"><span class="pc-dots__in"><span class="pc-dots__item">${head}</span><span class="exchange-select__sep">${SEP}</span><span class="pc-dots__item exchange-select__verdict${row.recommended?' is-recommended':''}">${esc(verdict)}</span></span></span>`;}
const statusLabel={pending:'等待对方回应',accepted:'交换已接受',declined:'对方谢绝了',cancelled:'申请已结束',revoked:'交换已撤销',expired:'申请已过期'};

/** Original source pixels are resized locally. Nothing is sent by this helper. */
export async function exchangePreview(blob){
 const image=await createImageBitmap(blob);
 try{const scale=Math.min(1,320/Math.max(image.width,image.height)),canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(image.width*scale));canvas.height=Math.max(1,Math.round(image.height*scale));canvas.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height);
  for(const quality of[.8,.65,.5,.35,.2]){const data=canvas.toDataURL('image/jpeg',quality);if(data.length<=43715)return data;}
  throw Error('预览太大，请换一张照片。');
 }finally{image.close();}
}

export function createExchangePanel({container,getContext,fetchPhoto,onClose=()=>{},onPhotos=()=>{},pollMs=5000}){
 const client=createExchangeController(),root=document.createElement('section');root.className='photo-exchanges';root.hidden=true;root.setAttribute('role','dialog');root.setAttribute('aria-modal','true');root.setAttribute('aria-label','照片交换');container.append(root);
 root.innerHTML='<header><button data-x-back aria-label="返回交换列表">←</button><div><small>同一晚 / 另一面</small><h2>交换一个视角</h2></div><button data-x-close aria-label="关闭照片交换">×</button></header><div class="exchange-body"></div><div class="exchange-problem" role="status"></div>';
 const q=s=>root.querySelector(s),body=q('.exchange-body'),urls=new Map(),loadingImages=new Set();
 const interval=Number.isFinite(pollMs)&&pollMs>0?pollMs:5000;
 let state=client.getState(),opened=false,mode='list',compose=null,consent=false,confirmAction=null,lastFocus,lastMarkup='',epoch=0,disposed=false,busy=false,pollBusy=false,pollTimer,pages=[null],localError=null;
 const clearImages=()=>{epoch++;const retired=new Set(urls.values());for(const img of root.querySelectorAll('img'))if(retired.has(img.getAttribute('src')))img.removeAttribute('src');for(const url of retired)URL.revokeObjectURL(url);urls.clear();loadingImages.clear();};
 const image=(key,alt)=>urls.has(key)?`<img src="${urls.get(key)}" alt="${esc(alt)}">`:'<span class="exchange-image-wait">正在读取照片…</span>';
 const current=()=>state.current?.exchange;
 function problem(error){localError=error?.message||null;q('.exchange-problem').textContent=localError||state.error?.message||(!state.storage.ok?state.storage.message:'');}
 function stop(){clearTimeout(pollTimer);}
 function schedule(){stop();if(opened&&!disposed&&!document.hidden&&mode!=='compose')pollTimer=setTimeout(refresh,interval);}
 const isComposeCurrent=()=>{const ctx=getContext();return compose&&ctx.actorId===compose.actorId&&ctx.room?.id===compose.roomId&&ctx.room.joined&&ctx.room.status==='open'&&ctx.photos.some(p=>p.id===compose.target.id&&p.revision===compose.target.revision&&p.visibility==='members');};
 const ownPhotos=ctx=>ctx.photos.filter(p=>p.roomId===compose.roomId&&p.ownerId===state.actorId);
 function photoCell([who,what=''],key,alt,extra=''){return `<figure><div class="exchange-photo">${image(key,alt)}</div><figcaption><b><span class="exchange-who">${esc(who)}</span>${what?`<span class="nowrap">${esc(what)}</span>`:''}</b>${extra}</figcaption></figure>`;}
 function markup(){
  if(state.identityStatus!=='ready')return '<p>请先确认你的小人身份。</p>';
  if(mode==='compose'){
   const ctx=getContext(),choices=ownPhotos(ctx),selected=choices.find(p=>p.id===compose.selectedId),valid=isComposeCurrent()&&selected?.revision===compose.selectedRevision,rows=offerSuggestions(choices,compose.target,{eventDate:ctx.eventDate||''}),chosen=rows.find(row=>row.photo.id===compose.selectedId);
   return `<p class="exchange-intro">用我拍下的，换 <b>${esc(compose.peerName)}</b> 看到的。</p><div class="exchange-pair">${photoCell(['我','提供的'],selected?`own:${selected.id}:${selected.revision}`:'none','我选择提供的现场照片',selected?'<small>我选中的这一张</small>':'<small>先选一张自己的照片</small>')}${photoCell([`${compose.peerName}的`], `target:${compose.target.id}:${compose.target.revision}`,'希望交换的对方现场照片','<small>照片墙上的这一张</small>')}</div>
   <label class="exchange-choice">我提供哪一张<span class="exchange-select"><select data-x-choice aria-describedby="exchange-reason">${optionsMarkup(rows,{selectedId:compose.selectedId,esc})}</select><span class="exchange-select__shown" aria-hidden="true">${chosenMarkup(chosen)}</span></span></label>${suggestionMarkup(rows,{selectedId:compose.selectedId,target:compose.target,esc})}
   ${!choices.length?'<p>先放一张自己的照片，再来交换。</p>':''}
   <div class="exchange-agreement"><label><input data-x-consent type="checkbox" ${consent?'checked':''}>我同意先给小图，TA 接受后再给原图</label></div><button class="exchange-primary" data-x-send ${!valid||!consent||!compose.preview||busy?'disabled':''}>把这两张交给对方确认 ↗</button>${!valid&&compose.selectedId?'<p class="exchange-fine">照片有变化，请重新选择。</p>':''}`;
  }
  if(mode==='detail'){
   const row=current();if(!row)return `<p>${state.lastResult?.committed&&state.lastResult.exchangeId===state.current?.id?'服务已收到，无需重发。':'正在读取…'}</p><button data-x-refresh>重新读取</button>`;
   const mine=row.senderId===state.actorId,offeredOwner=mine?'我':row.peer.name,requestedOwner=mine?row.peer.name:'我',active=['pending','accepted'].includes(row.status),confirmed=state.current.confirmed;
   const saved=state.lastResult?.exchangeId===row.id&&state.lastResult.committed&&!confirmed;
   const displayImages=active&&confirmed;
   let content=`<p class="exchange-status exchange-status--${esc(row.status)}">${esc(statusLabel[row.status])}${!confirmed?' · 待刷新':''}</p><h3>和 <b>${esc(row.peer.name)}</b> 的两张照片</h3>${saved?'<p>服务已收到，无需重发。</p>':''}`;
   if(displayImages)content+=`<div class="exchange-pair">${photoCell([offeredOwner,'提供的'],`detail:${row.id}:${row.revision}:offered`,`${offeredOwner}提供的照片`, `<small>${row.status==='pending'&&!mine?'小图预览':'这次确定的一张'}</small>`)}${photoCell([requestedOwner,'提供的'],`detail:${row.id}:${row.revision}:requested`,`${requestedOwner}提供的照片`,'<small>这次确定的一张</small>')}</div>`;
   if(!active)content+='<p>这次交换已结束。</p>';
   if(row.status==='pending')content+=`<p class="exchange-fine">有效至 ${esc(new Date(row.expiresAt).toLocaleString('zh-CN',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'}))}</p>`;
   if(row.status==='pending'&&!mine&&confirmed)content+=`<div class="exchange-agreement"><p>接受后，你们互看这两张原图。</p><label><input data-x-consent type="checkbox" ${consent?'checked':''}>我同意交换这两张</label></div><button class="exchange-primary" data-x-action="accept" ${!consent||busy||!urls.has(`detail:${row.id}:${row.revision}:offered`)||!urls.has(`detail:${row.id}:${row.revision}:requested`)?'disabled':''}>同意，交换这两张</button><button data-x-action="decline" ${busy?'disabled':''}>这次先不了</button>`;
   if(row.status==='pending'&&mine&&confirmed)content+='<p>等 TA 接受后，就能互看原图。</p><button data-x-action="cancel">撤回这个申请</button>';
   if(row.status==='accepted'&&confirmed)content+='<p>散场后也能在「照片交换」里看。</p><button data-x-action="revoke">撤销这次交换</button>';
   if(confirmAction)content+=`<div class="exchange-confirm"><p>${confirmAction==='revoke'?'撤销后，你们都看不到对方那张了。':confirmAction==='cancel'?'撤回这个申请？':'谢绝这次交换？'}</p><button class="exchange-primary" data-x-confirm ${busy?'disabled':''}>确认${{revoke:'撤销',cancel:'撤回',decline:'谢绝'}[confirmAction]}</button><button data-x-dismiss>再想想</button></div>`;
   return content+'<button data-x-refresh>刷新</button>';
  }
  return `<p class="exchange-intro">你的每一次交换，都在这里。</p><div class="exchange-list">${state.list.items.map(row=>`<button data-x-open="${row.id}"><span><b>${esc(row.peer.name)}</b><small>${row.senderId===state.actorId?'我发起的':'对方发起的'} · ${esc(statusLabel[row.status])}</small></span><span>↗</span></button>`).join('')||(state.list.loaded?`<p>还没有交换。去照片墙找找同一刻的另一面。</p>${getContext()?.room?.joined?'<button class="exchange-primary" data-exchange-photos>回到本场照片墙</button>':''}`:'<p>正在读取交换记录…</p>')}</div><div class="exchange-pagination"><button data-x-page="previous" ${pages.length<=1?'disabled':''}>上一页</button><span>第 ${pages.length} 页</span><button data-x-page="next" ${!state.list.nextCursor?'disabled':''}>下一页</button></div><button data-x-list-refresh>刷新这一页</button>`;
 }
 function pendingMarkup(){return state.pending.map(op=>`<div class="exchange-pending"><b>${op.type==='create'?'发起交换':'处理交换'}</b><p>${op.status==='running'?'正在确认…':esc(op.error?.message||'结果未确认，可以重试')}</p>${op.status!=='running'?`<button data-x-retry="${op.id}">重试</button>${op.status==='failed'&&!op.error?.uncertain?`<button data-x-discard="${op.id}">移除</button>`:''}`:`<button data-x-stop="${op.id}">不再等待</button>`}</div>`).join('');}
 function render(){if(!opened)return;const active=document.activeElement,key=active?.dataset?JSON.stringify(active.dataset):null,focused=body.contains(active),scroll=body.scrollTop,html=markup()+pendingMarkup();q('[data-x-back]').hidden=mode==='list';if(html!==lastMarkup){body.innerHTML=html;lastMarkup=html;body.scrollTop=scroll;if(focused){const replacement=[...body.querySelectorAll('button,input,select')].find(n=>JSON.stringify(n.dataset)===key);(replacement||q('[data-x-close]')).focus();}}problem(localError?{message:localError}:null);schedule();}
 async function loadImage(key,fn){if(urls.has(key)||loadingImages.has(key)||!opened)return;loadingImages.add(key);const captured=epoch;try{const blob=await fn();if(disposed||!opened||captured!==epoch)return;urls.set(key,URL.createObjectURL(blob));render();}catch(error){if(captured===epoch&&opened)problem(error);}finally{loadingImages.delete(key);}}
 function loadDetailImages(){const row=current();if(!opened||mode!=='detail'||!row||!state.current.confirmed||!['pending','accepted'].includes(row.status))return;const mine=row.senderId===state.actorId;
  for(const [side,id]of[['offered',row.offeredPhotoId],['requested',row.requestedPhotoId]]){const key=`detail:${row.id}:${row.revision}:${side}`;void loadImage(key,async()=>{
    if(row.status==='accepted')return client.fetchImage({photoId:id});
    if(side==='offered'&&!mine)return client.fetchImage({kind:'preview'});
    const captured=client.getState().current,blob=await fetchPhoto(id),now=client.getState();
    if(!now.current?.confirmed||now.actorId!==state.actorId||now.current.id!==row.id||now.current.exchange.revision!==captured.exchange.revision||now.current.exchange.status!=='pending')throw Error('照片有变化，请刷新。');return blob;
  });}
 }
 client.subscribe(next=>{const previous=state;state=next;if(previous.actorId!==next.actorId||next.identityStatus!=='ready'){clearImages();compose=null;consent=false;confirmAction=null;if(opened){mode='list';pages=[null];}}else if(previous.current?.id!==next.current?.id||previous.current?.exchange?.revision!==next.current?.exchange?.revision||previous.current?.confirmed&&!next.current?.confirmed){clearImages();consent=false;confirmAction=null;}render();loadDetailImages();});
 async function refresh(){if(!opened||disposed||document.hidden||pollBusy||busy||mode==='compose')return;pollBusy=true;try{await(mode==='detail'?client.refresh():client.refreshList());}catch(error){problem(error);}finally{pollBusy=false;schedule();}}
 function begin(){lastFocus=document.activeElement;opened=true;root.hidden=false;localError=null;lastMarkup='';consent=false;confirmAction=null;client.syncIdentity();q('[data-x-close]').focus();}
 async function open(id=null){clearImages();compose=null;mode=id?'detail':'list';pages=[null];begin();render();try{await(id?client.open(id):client.list());}catch(error){problem(error);}schedule();}
 async function openOffer(photo){const ctx=getContext();if(!ctx.actorId||!ctx.room?.joined||ctx.room.status!=='open'||photo.roomId!==ctx.room.id||photo.visibility!=='members'||photo.ownerId===ctx.actorId)throw Error('只能交换照片墙上别人的照片。');
  clearImages();client.close();mode='compose';compose={actorId:ctx.actorId,roomId:ctx.room.id,target:{...photo},peerName:ctx.members.find(m=>m.id===photo.ownerId)?.name||'同场观众',selectedId:null,selectedRevision:null,preview:null};begin();render();
  const captured=epoch,targetKey=`target:${photo.id}:${photo.revision}`;await loadImage(targetKey,async()=>{const blob=await fetchPhoto(photo.id);if(captured!==epoch||!isComposeCurrent())throw Error('场次或照片已变化。');return blob;});
  if(captured!==epoch||!compose||compose.selectedId||!urls.has(targetKey))return;const fresh=getContext(),pick=offerSuggestions(ownPhotos(fresh),compose.target,{eventDate:fresh.eventDate||''}).find(row=>row.recommended);if(pick)await choose(pick.photo.id);
 }
 function close({restore=true}={}){if(!opened)return;opened=false;root.hidden=true;stop();clearImages();client.close();compose=null;consent=false;confirmAction=null;body.innerHTML='';lastMarkup='';onClose();if(restore&&lastFocus?.isConnected)lastFocus.focus();}
 async function choose(id){if(!compose)return;const ctx=getContext(),selected=ctx.photos.find(p=>p.id===id&&p.ownerId===state.actorId&&p.roomId===compose.roomId);consent=false;compose.selectedId=selected?.id||null;compose.selectedRevision=selected?.revision||null;compose.preview=null;localError=null;render();if(!selected)return;const captured=epoch,selection=id;
  try{const blob=await fetchPhoto(id),preview=await exchangePreview(blob);if(captured!==epoch||compose?.selectedId!==selection||!isComposeCurrent())return;const currentPhoto=getContext().photos.find(p=>p.id===id);if(currentPhoto?.revision!==selected.revision)throw Error('照片有变化，请重新选择。');compose.preview=preview;const key=`own:${id}:${selected.revision}`;if(!urls.has(key))urls.set(key,URL.createObjectURL(blob));render();}catch(error){problem(error);}
 }
 async function mutate(fn){if(busy)return;busy=true;localError=null;render();try{const result=await fn();if(!opened||result?.applied===false)return;mode='detail';compose=null;consent=false;confirmAction=null;render();loadDetailImages();if(result.committed&&!result.permissionConfirmed)problem({message:'服务已收到，无需重发。'});}catch(error){problem(error);}finally{busy=false;render();}}
 root.addEventListener('change',e=>{if(e.target.hasAttribute('data-x-choice'))void choose(e.target.value);if(e.target.hasAttribute('data-x-consent')){consent=e.target.checked;render();}});
 root.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;if(b.hasAttribute('data-exchange-photos')){close();onPhotos();return;}
  if(b.hasAttribute('data-x-close'))close();
  if(b.hasAttribute('data-x-back'))void open();
  if(b.dataset.xOpen)void open(b.dataset.xOpen);
  if(b.hasAttribute('data-x-send')){if(!compose||!consent||!compose.preview||!isComposeCurrent())return;const payload={recipientId:compose.target.ownerId,offeredPhotoId:compose.selectedId,requestedPhotoId:compose.target.id,offeredRevision:compose.selectedRevision,requestedRevision:compose.target.revision,offerPreviewConsent:true,offerOriginalConsent:true,offeredPreviewDataUrl:compose.preview},roomId=compose.roomId;void mutate(()=>client.create(roomId,payload));}
  if(b.dataset.xAction){if(b.dataset.xAction==='accept')void mutate(()=>client.respond('accept',{revision:current()?.revision,exchangeConsent:consent}));else{confirmAction=b.dataset.xAction;render();}}
  if(b.hasAttribute('data-x-confirm')&&confirmAction){const action=confirmAction;void mutate(()=>client.respond(action,{revision:current()?.revision}));}
  if(b.hasAttribute('data-x-dismiss')){confirmAction=null;render();}
  if(b.hasAttribute('data-x-refresh'))void refresh();
  if(b.hasAttribute('data-x-list-refresh'))void refresh();
  if(b.dataset.xPage){if(b.dataset.xPage==='next'&&state.list.nextCursor)pages.push(state.list.nextCursor);else if(b.dataset.xPage==='previous'&&pages.length>1)pages.pop();void client.list({cursor:pages.at(-1)}).catch(problem);}
  if(b.dataset.xRetry)void mutate(()=>client.retry(b.dataset.xRetry));
  if(b.dataset.xDiscard)try{client.discard(b.dataset.xDiscard);}catch(error){problem(error);}
  if(b.dataset.xStop){client.stopWaiting(b.dataset.xStop);problem({message:'已停止等待。'});}
 });
 root.addEventListener('keydown',e=>{if(e.key==='Escape'){e.stopPropagation();close();}if(e.key==='Tab'){const nodes=[...root.querySelectorAll('button:not([disabled]),input:not([disabled]),select:not([disabled])')].filter(n=>n.getClientRects().length);if(e.shiftKey&&document.activeElement===nodes[0]){e.preventDefault();nodes.at(-1)?.focus();}else if(!e.shiftKey&&document.activeElement===nodes.at(-1)){e.preventDefault();nodes[0]?.focus();}}});
 const visible=()=>{if(document.hidden)stop();else void refresh();};document.addEventListener('visibilitychange',visible);
 return {open,openOffer,close,refresh,syncIdentity(value){if(arguments.length)client.syncIdentity(value);else client.syncIdentity();},invalidate(options){clearImages();client.invalidatePermissions(options);if(mode==='compose')render();},getState:()=>client.getState(),dispose(){disposed=true;stop();clearImages();client.dispose();document.removeEventListener('visibilitychange',visible);root.remove();}};
}
