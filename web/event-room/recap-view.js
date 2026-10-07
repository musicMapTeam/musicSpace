import {escape as esc} from '../avatar/model.js';
import {renderAvatarSvg} from '../illustrated-avatar/index.js';

export function recapMarkup({recap,photoCards,pages={photos:1,friends:1},error=null,stale=false}){
 const r=recap?.room;
 if(!r)return `<small class="eyebrow">这一晚</small><h2>把留下的，再看一遍。</h2><p>${esc(error?.message||'正在读取这一晚…')}</p>${error?'<button class="primary" data-recap-refresh>重新读取这一晚</button>':''}`;
 const pager=kind=>`<div class="recap-pagination"><button data-recap-page="${kind}" data-recap-dir="previous" ${pages[kind]<=1?'disabled':''}>上一页</button><span>第 ${pages[kind]} 页</span><button data-recap-page="${kind}" data-recap-dir="next" ${!recap[kind]?.nextCursor?'disabled':''}>下一页</button></div>`;
 const photos=recap.photos?.items||[],friends=recap.friends?.items||[];
 return `<header class="recap-ticket"><small class="eyebrow">这一晚 · ${r.status==='open'?'仍在进行':'已散场'}</small><h2>${esc(r.title)}</h2><p class="recap-venue"><span class="pc-dots"><span class="pc-dots__in"><span class="pc-dots__item">${esc(r.venue||'这一场')}</span><span class="recap-venue__sep"> · </span><span class="pc-dots__item">${r.joined?'你仍是本场成员':'你已离场'}</span></span></span></p></header>${stale?'<p class="social-notice">先显示上次读取的记录。</p>':''}
 <section class="recap-section"><h3>散场以后，继续聊。</h3><button class="primary" data-open="conversation" data-id="${r.id}">回到这一场的聊天室</button><button data-open="communities">Livehouse 乐迷社群</button></section>
 <section class="recap-keepsake"><h3>把这一晚，留在手里。</h3><p>用你的照片和小人，做一张纪念卡。</p><button class="primary" data-open="memory-card" ${stale||!recap.loaded?'disabled':''}>保存我的纪念卡 ↗</button></section>
 <section class="recap-section"><h3>留下的视角</h3>${r.joined?'':'<p class="fine">离场后只保留自己的照片。</p>'}${photoCards(photos)}${pager('photos')}</section>
 <section class="recap-section"><h3>交换过的另一面</h3><p class="fine">散场后也能看，随时可以撤销。</p><button class="quiet" data-open="exchanges">查看我的照片交换 ↗</button></section>
 <section class="recap-section"><h3>在这一场认识的人</h3><div class="recap-friends">${friends.map(f=>`<button data-open="chats" data-id="${esc(f.userId)}"><span aria-hidden="true">${renderAvatarSvg(f.peer.avatar,{view:'quarter',width:68,height:142})}</span><span><b>${esc(f.peer.name)}</b><small>继续聊聊 ↗</small></span></button>`).join('')||'<p>还没有在这一场认识的人。</p>'}</div>${pager('friends')}</section>
 <button class="quiet" data-recap-refresh>刷新这一晚</button>
 <section class="recap-next recap-section"><h3>再见，在下一场。</h3><button class="primary" data-open="entry">用邀请码<span class="nowrap">去另一个现场</span></button><button type="button" data-open="create">我是 Livehouse / <span class="nowrap">主办方，开个房</span></button><button type="button" data-open="rooms">我的现场记录</button></section>`;
}
