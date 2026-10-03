import {MUSIC_CATALOGUE,musicReference} from '../../runtime-preview/src/music-catalogue.js';
import {escape as esc} from '../avatar/model.js';
/** All artwork is original SVG/CSS; supplied metadata is re-resolved from our allowlist. */
export function renderMusicCard(reference){
 const r=musicReference(reference?.id);if(!r)return '';
 return `<aside class="music-reference"><span class="eyebrow">从一首合唱，走向另一位音乐人</span><h3>《${esc(r.title)}》</h3><p>${r.artists.map(esc).join(' × ')}</p><button type="button" data-music-explore="${esc(r.id)}">在应用内探索这段关系 ↗</button><a href="${esc(r.sourceUrl)}" target="_blank" rel="noopener noreferrer">${esc(r.sourceLabel)} · 署名依据 ↗</a><small>应用内 Music Map；本卡没有音频、歌词或唱片封面。资料核对于 ${r.checkedAt}。</small></aside>`;
}
export function renderMusicExplore(){
 return `<details class="music-explore"><summary>带一首歌来聊 · Music Map</summary><p class="fine">从已核对的共同演唱关系出发。探索不会发送消息；分享须自己确认，只进入当前聊天室。</p><div class="music-thread" aria-label="周杰伦的四段合唱关系"><svg viewBox="0 0 340 112" role="img" aria-label="周杰伦与张惠妹、费玉清、阿信、杨瑞代共同演唱"><path d="M35 56 L160 20 M35 56 L160 44 M35 56 L160 70 M35 56 L160 94" fill="none" stroke="currentColor" stroke-width="1.5"/><circle cx="35" cy="56" r="18" fill="#c6a385"/><text x="10" y="90">周杰伦</text>${MUSIC_CATALOGUE.map((r,i)=>`<circle cx="160" cy="${20+i*25}" r="4" fill="#63785c"/><text x="175" y="${24+i*25}">${esc(r.artists[1])} · ${esc(r.title)}</text>`).join('')}</svg></div>${MUSIC_CATALOGUE.map(r=>renderMusicCard(r)).join('')}<form data-group-music><label>分享这张音乐卡<select name="musicId">${MUSIC_CATALOGUE.map(r=>`<option value="${r.id}">${esc(r.title)} · ${r.artists.map(esc).join(' × ')}</option>`).join('')}</select></label><label>我的一句话<input name="note" maxlength="1000" placeholder="为什么想和这里的人聊这首歌？"></label><label><input name="consent" type="checkbox" required>确认把音乐卡和我的留言发给当前聊天室成员</label><button type="submit">分享音乐卡</button></form></details>`;
}
