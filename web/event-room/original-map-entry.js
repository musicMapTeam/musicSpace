import {realSongs} from '../../runtime-preview/src/map-catalogue.js';
const KEY='music-space-map-return:v1';
/** Full-page route: the original Map owns the screen and its single renderer. */
export function createMusicMap({controller,onShare=()=>{},onRelay=()=>{},onReturn=()=>{},getView=()=>null,canRestore=()=>true,onRestore=()=>{},onError=()=>{}}){
 let leaving=false,pendingView=null;
 function open(scope=null,_back=null,recordingId=null){
  if(leaving)return;
  if(globalThis.navigator?.onLine===false){onError(Error('当前离线，恢复连接后再打开音乐探索；聊天草稿会保留。'));return;}
  const actor=controller.getState().identity.user?.id||null;
  const context={actor,view:getView(),scope:scope?{kind:scope.kind,id:scope.id}:null,returnUrl:location.pathname+location.search+location.hash,recordingId:realSongs[recordingId]?recordingId:null};
  try{sessionStorage.setItem(KEY,JSON.stringify(context));}catch{onError(Error('浏览器无法保留返回位置，请允许本机存储后重试。'));return;}
  leaving=true;location.assign('/music-map/#/explore');
 }
 // Consume a draft request once, after identity is ready. Existing services
 // still check membership and require explicit send/start confirmation.
 function syncIdentity(){
  const identity=controller.getState().identity;if(identity.status!=='ready')return;
  if(pendingView?.actor!==identity.user?.id)pendingView=null;
  let saved;try{saved=JSON.parse(sessionStorage.getItem(KEY)||'null');}catch{return;}
  if(saved?.returning||saved?.action){
   sessionStorage.removeItem(KEY);
   if(saved.actor===identity.user?.id){
    if(saved.view)pendingView={actor:saved.actor,view:saved.view};
    if(saved.scope){
     if(!saved.action)onReturn(saved.scope);
     else if(realSongs[saved.recordingId]){
      if(saved.action==='share')onShare(saved.scope,saved.recordingId);
      if(saved.action==='relay')onRelay(saved.scope,saved.recordingId);
     }
    }
   }
  }
  if(pendingView&&canRestore(pendingView.view)){const view=pendingView.view;pendingView=null;onRestore(view);}
 }
 return {open,close(){},syncIdentity,dispose(){}};
}
