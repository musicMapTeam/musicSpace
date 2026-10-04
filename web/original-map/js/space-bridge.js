import {realSongs} from '../../../runtime-preview/src/map-catalogue.js';
import '../css/space-bridge.css';
const KEY='music-space-map-return:v1';
let context=null;try{context=JSON.parse(sessionStorage.getItem(KEY)||'null');}catch{}
// Only this application's route is an allowed return destination.
const returnUrl=context?.returnUrl?.startsWith('/event-room/')&&!context.returnUrl.startsWith('//')?context.returnUrl:'/event-room/';
const bar=document.createElement('aside');bar.className='space-map-return';bar.setAttribute('aria-label','返回 Music Space');
const back=document.createElement('button');back.textContent='← 返回现场';back.onclick=()=>{if(!online())return;try{if(context)sessionStorage.setItem(KEY,JSON.stringify({...context,returning:true}));}catch{}location.assign(returnUrl);};bar.append(back);
const note=document.createElement('span');note.textContent='原版三维唱片桌';bar.append(note);document.querySelector('.masthead-tools').prepend(bar);
const status=document.createElement('p');status.className='space-map-status';status.setAttribute('role','status');status.hidden=true;bar.after(status);
function online(){if(navigator.onLine!==false){status.hidden=true;return true;}status.hidden=false;status.textContent='当前离线，请恢复连接后重试返回。探索记录与聊天草稿仍保留。';return false;}
window.addEventListener('online',()=>{status.hidden=true;});
if(realSongs[context?.recordingId]){
 const song=realSongs[context.recordingId],b=document.createElement('button');b.textContent='带来的歌';b.title=`从《${song.title}》的作者继续探索`;b.setAttribute('aria-label',b.title);
 b.onclick=()=>window.dispatchEvent(new CustomEvent('music-space-map-artist',{detail:{artistId:song.artists[0]}}));bar.append(b);
}
// Add draft actions beside the original track controls. Never translate an
// unverified/open-directory entry into the server's curated recording IDs.
function decorate(){
 document.querySelectorAll('[data-map-action="save"][data-id]').forEach(save=>{
  const id=save.dataset.id,track=save.closest('.map-track')||save.parentElement;
  if(!context?.scope||!realSongs[id]||track.nextElementSibling?.dataset.spaceMapRecording===id)return;
  const controls=document.createElement('div');controls.className='space-map-draft';controls.dataset.spaceMapRecording=id;track.after(controls);
  for(const [action,label] of [['share','带回聊天草稿'],['relay','作为接龙起点']]){
   const b=document.createElement('button');b.className='button button--quiet';b.dataset.spaceMapAction=action;b.textContent=label;
   b.onclick=e=>{e.stopPropagation();if(!online())return;try{sessionStorage.setItem(KEY,JSON.stringify({...context,recordingId:id,action}));location.assign(returnUrl);}catch{status.hidden=false;status.textContent='无法保存草稿，请保留当前页面后重试。';}};
   controls.append(b);
  }
 });
}
const observer=new MutationObserver(decorate);observer.observe(document.querySelector('#app'),{subtree:true,childList:true});decorate();
window.addEventListener('pagehide',()=>observer.disconnect());
