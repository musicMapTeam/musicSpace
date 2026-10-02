/** A local download, never a sharing mutation. Only the viewer's own photos
 * from the explicitly reviewed recap page can enter the card. */
const changed=()=>Object.assign(new Error('所选内容已变化，请重新核对后保存。'),{code:'MEMORY_REVIEW_CHANGED'});
function snapshot(state,selection){
 const user=state.identity?.user,recap=state.recap,room=recap?.room;
 if(state.identity?.status!=='ready'||!user||!room||!recap.loaded||recap.stale||state.connection==='offline'||recap.actorId!==user.id)throw changed();
 if(selection.consent!==true)throw Object.assign(new Error('请确认仅将所选内容下载到你的设备。'),{code:'MEMORY_CONSENT_REQUIRED'});
 const ids=selection.photoIds||[];
 if(!Array.isArray(ids)||ids.length>2||new Set(ids).size!==ids.length)throw Object.assign(new Error('最多选择两张自己的照片。'),{code:'MEMORY_SELECTION_REQUIRED'});
 const photos=ids.map(id=>{const p=recap.photos.items.find(p=>p.id===id);if(!p||p.ownerId!==user.id||p.roomId!==room.id)throw changed();return{id:p.id,roomId:p.roomId,ownerId:p.ownerId,revision:p.revision};});
 return {actorId:user.id,room:{id:room.id,title:room.title,venue:room.venue||''},author:{name:user.name,avatar:selection.includeAvatar?{...user.avatar}:null},includeAvatar:!!selection.includeAvatar,photos};
}
function sameReview(a,b){return JSON.stringify(a)===JSON.stringify(b);}
export function createMemoryCardExporter({getState,refresh,fetchPhotoBlob,render,save,onState=()=>{},now=()=>new Date()}){
 let active=null,serial=0;
 function cancel(){if(!active)return false;active.abort.abort();active=null;serial++;onState({busy:false,cancelled:true});return true;}
 async function run(selection){
  if(active)return {busy:true};
  selection={...selection,photoIds:[...(selection.photoIds||[])]};
  const reviewed=snapshot(getState(),selection),token=++serial,abort=new AbortController();active={token,abort};onState({busy:true,error:null,saved:false,cancelled:false});
  const current=()=>{if(!active||active.token!==token||abort.signal.aborted)throw Object.assign(new Error('已取消保存。'),{code:'MEMORY_CANCELLED'});if(!sameReview(reviewed,snapshot(getState(),selection)))throw changed();};
  try{
   await refresh();current();
   const photos=[];
   for(const photo of reviewed.photos){const blob=await fetchPhotoBlob(photo.id,{signal:abort.signal,recapRoomId:reviewed.room.id});current();photos.push({blob,authorName:reviewed.author.name});}
   const blob=await render({room:reviewed.room,author:reviewed.author,includeAvatar:reviewed.includeAvatar,photos,savedAt:now()});current();
   // Recheck after image decoding too: a second tab may have removed a photo.
   await refresh();current();
   await save(blob,'MusicSpace-memory-'+now().toISOString().slice(0,10)+'.png');
   onState({busy:false,saved:true,error:null});return {downloaded:true};
  }catch(error){if(!active||active.token!==token||error.code==='MEMORY_CANCELLED'||abort.signal.aborted)return {cancelled:true};onState({busy:false,error:{code:error.code||'MEMORY_EXPORT_FAILED',message:error.message||'暂未保存，恢复连接后可重试。'}});throw error;}
  finally{if(active?.token===token){active=null;onState({busy:false});}}
 }
 return {run,cancel,isBusy:()=>!!active};
}
