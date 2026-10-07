import {realSongs} from '../../../runtime-preview/src/map-catalogue.js';
import '../css/space-bridge.css';
import {eventRoomReturn} from '../../shared/site-base.js';
const KEY='music-space-map-return:v1';
let context=null;try{context=JSON.parse(sessionStorage.getItem(KEY)||'null');}catch{}
// Only this application's route is an allowed return destination: the event room's own page on this origin. Its path comes from the
// page's space-event-room hint (a static site carries the room at its root or under /preview/), '/event-room/' on the Node server.
const returnUrl=eventRoomReturn(context?.returnUrl);
const bar=document.createElement('aside');bar.className='space-map-return';bar.setAttribute('aria-label','返回 Music Space');
const back=document.createElement('button');back.className='space-map-back';back.innerHTML='<span aria-hidden="true">←</span> 返回现场';back.onclick=()=>{if(!online())return;try{if(context)sessionStorage.setItem(KEY,JSON.stringify({...context,returning:true}));}catch{}location.assign(returnUrl);};bar.append(back);
document.querySelector('.masthead-tools').prepend(bar);
const status=document.createElement('p');status.className='space-map-status';status.setAttribute('role','status');status.hidden=true;bar.after(status);
function online(){if(navigator.onLine!==false){status.hidden=true;return true;}status.hidden=false;status.textContent='离线了，联网后再返回现场。';return false;}
window.addEventListener('online',()=>{status.hidden=true;});
if(realSongs[context?.recordingId]){
 const song=realSongs[context.recordingId],b=document.createElement('button');b.className='space-map-context';b.textContent='这首歌';b.title=`从《${song.title}》的演唱者继续探索`;b.setAttribute('aria-label',`这首歌：${b.title}`);document.querySelector('.app-masthead').classList.add('space-map-has-recording');
 b.onclick=()=>window.dispatchEvent(new CustomEvent('music-space-map-artist',{detail:{artistId:song.artists[0]}}));bar.append(b);
}
// Add draft actions beside the original track controls. Never translate an
// unverified/open-directory entry into the server's curated recording IDs.
function decorate(){
 document.querySelectorAll('[data-map-action="save"][data-id]').forEach(save=>{
  const id=save.dataset.id,row=save.closest('.map-track')||save.parentElement;
  // A row's own folds (作品署名, 来源) stay with it; the draft actions follow them.
  const track=row.nextElementSibling?.classList.contains('map-track__folds')?row.nextElementSibling:row;
  if(!context?.scope||!realSongs[id]||track.nextElementSibling?.dataset.spaceMapRecording===id)return;
  const controls=document.createElement('div');controls.className='space-map-draft';controls.dataset.spaceMapRecording=id;track.after(controls);
  for(const [action,label] of [['share','带回聊天草稿'],['relay','作为接龙起点']]){
   const b=document.createElement('button');b.className='button button--quiet';b.dataset.spaceMapAction=action;b.textContent=label;
   b.onclick=e=>{e.stopPropagation();if(!online())return;try{sessionStorage.setItem(KEY,JSON.stringify({...context,recordingId:id,action}));location.assign(returnUrl);}catch{status.hidden=false;status.textContent='草稿没存上，请再试一次。';}};
   controls.append(b);
  }
 });
}
const observer=new MutationObserver(decorate);observer.observe(document.querySelector('#app'),{subtree:true,childList:true});decorate();
window.addEventListener('pagehide',()=>observer.disconnect());
