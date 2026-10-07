import {escape as esc} from '../avatar/model.js';
import {renderAvatarSvg} from '../illustrated-avatar/index.js';

/**
 * One private return point. Reads do not join a room or community.
 * identityBackup: false hides 「身份备份与恢复」 (the static build, whose world lives in this one browser: a backup has nowhere to go).
 */
export function createPersonalSpace({container,controller,identityBackup=true,onAction=()=>{},onCommunity=()=>{}}){
 let root=null,actor=null,epoch=0,privacy='',groups=[],rooms=[],friends=[],errors=[],loading=false,loaded=false,returnFocus=null;
 const user=()=>controller.getState().identity.user;
 function render(){
  if(!root)return;const focused=document.activeElement?.dataset?.space,scroll=root.querySelector('.community-scroll')?.scrollTop||0,u=user();
  if(!u||u.id!==actor){close();return;}
  root.innerHTML=`<header><span class="eyebrow">MY SPACE / 长期留在这里</span><button data-space="close" aria-label="关闭我的空间">×</button></header><div class="community-scroll"><section class="space-identity"><div>${renderAvatarSvg(u.avatar,{view:'quarter',width:120,height:245})}</div><div><small>我的小人</small><h2>${esc(u.name)}</h2><p>现场是认识的起点，散场后仍有地方回来。</p><button data-space="wardrobe">装扮我的小人</button></div></section>${loading?'<p role="status">正在读取…</p>':''}${errors.length?`<p role="alert">${esc(errors.join('；'))}</p><button data-space="refresh">重新读取</button>`:''}<nav class="space-shortcuts" aria-label="我的空间入口"><button data-space="communities">我的乐迷社群</button><button data-space="rooms">我的现场与回顾</button><button data-space="friends">好友与新招呼</button><button data-space="chats">私聊</button><button data-space="corners">共同记忆</button>${identityBackup?'<button data-space="identity-backup">身份备份与恢复</button>':''}</nav><section><h3>我的乐迷社群</h3>${groups.map(g=>`<button class="space-record" data-space-community="${g.id}"><b>${esc(g.title)}</b><span>${g.hostId===actor?'我主持 · ':''}${g.removed?'已被移除':g.joined?'已加入':'已退出'}${g.archived?' · 已归档':''}${g.badgeCount?' · '+g.badgeCount+' 条未读':''}</span></button>`).join('')||(!loading&&loaded&&!errors.length?'<p>还没有加入乐迷社群。</p>':'')}<button data-space="communities">加入或创建社群</button></section><section><h3>我的现场</h3>${rooms.slice(0,6).map(r=>`<button class="space-record" data-space-recap="${r.id}"><b>${esc(r.title)}</b><span>${r.status==='open'?'进行中':'已散场'} · ${r.role==='host'?'我主持 · ':''}${r.entryState==='removed'?'已被移除':r.joined?'已加入':'已离场'} · 回顾</span></button>`).join('')||(!loading&&loaded&&!errors.length?'<p>还没有去过的现场。</p>':'')}<button data-space="entry">进场或开个房</button><button data-space="rooms">全部现场和照片</button></section><section><h3>我的音乐朋友</h3>${friends.slice(0,6).map(f=>`<button class="space-record" data-space-chat="${f.userId}"><b>${esc(f.peer?.name||'朋友')}</b><span>朋友 · 私聊</span></button>`).join('')||(!loading&&loaded&&!errors.length?'<p>还没有朋友。去同场的人里打个招呼吧。</p>':'')}<button data-space="friends">全部好友与招呼</button></section><button data-space="refresh">刷新我的空间</button></div>`;
  root.querySelector('.community-scroll').scrollTop=scroll;if(focused)root.querySelector(`[data-space="${focused}"]`)?.focus();
 }
 async function refresh(){
  if(!root||loading)return;const gen=epoch;loading=true;groups=rooms=friends=[];errors=[];loaded=false;render();
  const results=await Promise.allSettled([controller.communityRequest('/communities'),controller.loadMyRooms(),controller.loadSocial()]);
  if(gen!==epoch||!root||user()?.id!==actor)return;
  const state=controller.getState();if(results[0].status==='fulfilled'&&results[0].value.actorId===actor)groups=results[0].value.communities;else errors.push('社群暂未读取');
  if(results[1].status==='fulfilled')rooms=state.myRooms.items;else errors.push('现场暂未读取');
  if(results[2].status==='fulfilled')friends=state.social.friends;else errors.push('好友暂未读取');
  loading=false;loaded=true;render();
 }
 function close(){epoch++;root?.remove();root=null;groups=rooms=friends=[];errors=[];loading=false;loaded=false;actor=null;if(returnFocus?.isConnected)returnFocus.focus();returnFocus=null;}
 async function open(){close();actor=user()?.id;if(!actor){onAction('profile');return;}returnFocus=document.getElementById('my-space')||document.activeElement;privacy=JSON.stringify(controller.getState().social?.blocks||[]);root=document.createElement('section');root.className='community-panel personal-space';root.setAttribute('role','dialog');root.setAttribute('aria-modal','true');root.setAttribute('aria-label','我的音乐空间');container.append(root);
  root.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;e.stopPropagation();if(b.dataset.space==='close'){close();return;}if(b.dataset.space==='refresh'){void refresh();return;}if(b.dataset.spaceCommunity){const g=groups.find(g=>g.id===b.dataset.spaceCommunity);if(g){close();onCommunity(g);}return;}const kind=b.dataset.spaceRecap?'recap':b.dataset.spaceChat?'chats':b.dataset.space;if(kind){const id=b.dataset.spaceRecap||b.dataset.spaceChat;close();onAction(kind,id);}});
  root.addEventListener('keydown',e=>{if(e.key==='Escape'){e.stopPropagation();close();}if(e.key==='Tab'){const ns=[...root.querySelectorAll('button:not([disabled])')].filter(n=>n.getClientRects().length);if(e.shiftKey&&document.activeElement===ns[0]){e.preventDefault();ns.at(-1)?.focus();}else if(!e.shiftKey&&document.activeElement===ns.at(-1)){e.preventDefault();ns[0]?.focus();}}});render();root.querySelector('[data-space="close"]')?.focus();await refresh();
 }
 return{open,close,syncIdentity(){if(root&&(user()?.id!==actor||privacy!==JSON.stringify(controller.getState().social?.blocks||[])))close();},dispose:close};
}
