import {escape as esc} from '../avatar/model.js';
import {renderAvatarSvg} from '../illustrated-avatar/index.js';

export function recapMarkup({recap,photoCards,pages={photos:1,friends:1},error=null,stale=false}){
 const r=recap?.room;
 if(!r)return `<small class="eyebrow">这一晚</small><h2>把留下的，再看一遍。</h2><p>${esc(error?.message||'正在核对你现在可以查看的照片和联系…')}</p>${error?'<button class="primary" data-recap-refresh>重新读取这一晚</button>':''}`;
 const pager=kind=>`<div class="recap-pagination"><button data-recap-page="${kind}" data-recap-dir="previous" ${pages[kind]<=1?'disabled':''}>上一页</button><span>第 ${pages[kind]} 页</span><button data-recap-page="${kind}" data-recap-dir="next" ${!recap[kind]?.nextCursor?'disabled':''}>下一页</button></div>`;
 const photos=recap.photos?.items||[],friends=recap.friends?.items||[];
 return `<small class="eyebrow">这一晚 · ${r.status==='open'?'仍在进行':'已散场'}</small><h2>${esc(r.title)}</h2><p class="recap-venue">${esc(r.venue||'这一场')} · ${r.joined?'你仍是本场成员':'你已离场'}</p>${stale?'<p class="social-notice">暂未确认最新状态。下面是上次读取的记录，恢复连接后会重新核对。</p>':''}
 <section class="recap-keepsake"><h3>把这一晚，留在手里。</h3><p>选择自己的照片和小人，做一张带署名的私人纪念卡。</p><button class="primary" data-open="memory-card" ${stale||!recap.loaded?'disabled':''}>保存我的纪念卡 ↗</button><p class="fine">不包含私聊、朋友名单或他人的照片，不自动公开。</p></section>
 <section class="recap-section"><h3>留下的视角</h3><p class="fine">${r.joined?'自己的照片，以及读取时仍获授权的共享照片。':'离场后只保留自己的照片，不再读取别人的共享图。'}</p>${photoCards(photos)}${pager('photos')}</section>
 <section class="recap-section"><h3>交换过的另一面</h3><p class="fine">已经双方同意的定向交换有独立权限。散场后仍可查看，也可以随时撤销。</p><button class="quiet" data-open="exchanges">查看我的照片交换 ↗</button></section>
 <section class="recap-section"><h3>从本场开始的联系</h3><p class="fine">现在仍互为朋友。关系变化后，这里也会更新。</p><div class="recap-friends">${friends.map(f=>`<button data-open="chats" data-id="${esc(f.userId)}"><span aria-hidden="true">${renderAvatarSvg(f.peer.avatar,{view:'quarter',width:68,height:142})}</span><span><b>${esc(f.peer.name)}</b><small>继续聊聊 ↗</small></span></button>`).join('')||'<p>这里还没有当前有效的双向联系。</p>'}</div>${pager('friends')}</section>
 <p class="fine recap-refresh-note">只显示当前有权查看的内容；刷新和切页会重新核对。</p><button class="quiet" data-recap-refresh>刷新这一晚</button>
 <section class="recap-next"><h3>再见，在下一场。</h3><button class="primary" data-open="entry">输入另一个现场的邀请码</button><div class="row"><button type="button" data-open="create">自己开一场</button><button type="button" data-open="rooms">我的现场记录</button></div></section>`;
}
