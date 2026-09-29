import { SPACE_PHOTOS, SPACE_ACTORS, seedSpaceCard } from './space-data.js';
import { createPhotoStore } from './live-photo.js';
import { readSession } from './storage.js';

const escape = value => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));

/**
 * The front door belongs to the visitor. With a room server it starts real rooms and keeps the demo as a side door;
 * without one (static hosting) the two-person demo is the way in, and says so in one line.
 */
export function mountHome(container, api) {
  const rooms = api.backend.available;
  // The title is written once; data and photo loads only repaint the paper, so its entrance never replays.
  container.innerHTML = `<section class="space-page space-page--home space-studio space-studio--home home-studio" aria-labelledby="home-title">
    <div class="home-cover">
      <header class="home-hero">
        <p class="home-hero__kicker"><i aria-hidden="true"></i>音乐现场 · 散场以后</p>
        <h1 id="home-title" class="home-hero__title"><span>同一刻，</span><span>另一面。</span></h1>
        <p class="home-hero__lede">用另一位观众的视角，补完整你记住的那一晚。</p>
        <ol class="home-hero__steps" aria-label="怎么交换"><li>交换现场照片</li><li>双方同意</li><li>两人署名的双联票根</li></ol>
      </header>
      <div class="home-paper home-paper--compact" data-home-paper></div>
    </div>
    <div class="home-fallback-cards" data-home-fallback></div>
  </section>`;
  const page = container.firstElementChild;
  const paper = page.querySelector('[data-home-paper]');
  const fallback = page.querySelector('[data-home-fallback]');
  const life = new AbortController();
  const { signal } = life;
  let session = rooms ? readSession() : null;
  const photos = createPhotoStore(() => session?.token, signal);
  let catalogue = null;
  let error = '';
  let loading = Boolean(session?.token);
  const actor = api.getState().actor;
  const demoCards = [actor, actor === 'a' ? 'b' : 'a'].map(owner => {
    const card = api.getState().space.cards[owner] || seedSpaceCard(owner);
    if (owner !== actor && !card.isPublic) return null;
    const custom = card.photoKey === 'custom' && card.photoDataUrl;
    return { id: card.id, src: custom ? card.photoDataUrl : SPACE_PHOTOS[card.photoKey]?.url,
      title: `${SPACE_ACTORS[owner].name}的卡`, subtitle: `${SPACE_ACTORS[owner].name} · 本地示例`,
      caption: card.caption, eventTitle: '回声现场', date: '2026.09.26', alt: custom ? `${SPACE_ACTORS[owner].name}的现场照片，本地示例` : `${SPACE_ACTORS[owner].name}的本地示例照片`,
      isDemo: true, isOwn: owner === actor, local: true, exampleImage: !custom };
  }).filter(Boolean);

  function entries() {
    if (!catalogue?.cards.length) return demoCards;
    return catalogue.cards.slice(0, 2).map(card => ({ ...card,
      src: card.photoId ? photos.peek(card.photoId) : SPACE_PHOTOS[card.photoKey]?.url,
      title: card.event?.title || card.roomTitle, subtitle: `${card.ownerName} · 我的现场`,
      eventTitle: card.event?.title || card.roomTitle, date: card.event?.date || '',
      alt: card.photoId ? `${card.ownerName}的现场照片` : 'AI 示例照片',
      isDemo: Boolean(card.event?.isDemo || !card.photoId), isOwn: true, local: false, exampleImage: !card.photoId,
    }));
  }
  const makeCard = () => (rooms
    ? api.navigate('live', { intent: 'make-card' })
    : api.navigate('space', { showDemo: true, editCard: true }));
  function openCard(id) {
    const item = entries().find(card => card.id === id);
    if (!item) return;
    if (item.local) api.navigate('space', { showDemo: true, previewCardId: item.id });
    else api.navigate('records', { section: 'live', libraryItemId: `card:${item.id}` });
  }
  function publish() {
    api.spatial?.publish({ mode: 'home', cards: entries().filter(card => card.src), onPhoto: openCard, onEdit: makeCard });
  }
  function render() {
    if (signal.aborted) return;
    const recentOpen = Boolean(paper.querySelector('[data-home-recent]')?.open);
    const cards = entries();
    const recentRoom = catalogue?.rooms.find(room => room.id === session?.roomId) || catalogue?.rooms[0];
    const personal = cards.filter(card => !card.local);
    page.classList.toggle('home-studio--returning', personal.length > 0);
    const intro = personal.length ? `<details class="home-recent" data-home-recent ${recentOpen ? 'open' : ''}><summary><span>最近现场</span><small>${catalogue.cards.length}</small>${api.icon('chevron-right')}</summary><div class="home-memory-list">${personal.map(card => `<button class="home-memory" data-home="photo" data-id="${escape(card.id)}" aria-label="查看${escape(card.title)}"><span class="home-memory__image">${card.src ? `<img src="${escape(card.src)}" alt="${escape(card.alt)}">` : api.icon('image')}</span><span class="home-memory__copy"><small>${card.exampleImage ? 'AI 示例图 · ' : ''}我的现场</small><strong>${escape(card.title)}</strong></span>${api.icon('arrow-up-right')}</button>`).join('')}</div></details>` : `<div class="home-first-card"><span class="home-first-card__art" aria-hidden="true">${api.icon('camera')}</span><span class="home-first-card__copy"><strong>留住这一晚</strong><small>照片默认私藏，双方同意才交换</small></span></div>`;
    // One honest line that breaks at the semicolon instead of leaving a stray character on a second line.
    const note = () => api.backend.note.split('；').map((part, index, parts) => `<span style="display:inline-block">${escape(part)}${index < parts.length - 1 ? '；' : ''}</span>`).join('<wbr>');
    const actions = rooms
      ? `<div class="home-paper__actions"><button class="button button--primary" data-home="make">${api.icon('plus')}记录我的现场</button><button class="button button--secondary" data-home="invite">${api.icon('users')}邀请朋友</button></div>
      <div class="home-paper__foot">${recentRoom ? `<button data-home="resume" data-room="${escape(recentRoom.id)}" title="${escape(recentRoom.title)}">继续本场 ${api.icon('arrow-right')}</button>` : ''}<button data-home="join">我有邀请码 ${api.icon('arrow-right')}</button><button data-home="demo">体验示例 ${api.icon('arrow-up-right')}</button></div>`
      : `<div class="home-paper__actions"><button class="button button--primary" data-home="demo">${api.icon('swap')}体验示例</button><button class="button button--secondary" data-home="make-demo">${api.icon('camera')}用我的照片</button></div>
      <p class="home-paper__status">${note()}</p>`;
    paper.innerHTML = `${intro}
      ${actions}
      ${loading ? '<span class="home-paper__status" role="status">正在找回你的现场…</span>' : ''}${error ? `<div class="home-paper__status" role="status">${escape(error)} <button data-home="retry">重试</button></div>` : ''}`;
    fallback.innerHTML = cards.map(card => `<button data-home="photo" data-id="${escape(card.id)}">${card.src ? `<img src="${escape(card.src)}" alt="${escape(card.alt)}">` : ''}<span>${escape(card.title)}${card.local ? ' · 示例' : ''}</span></button>`).join('');
    publish();
  }
  async function load() {
    if (!rooms || !session?.token || loading && catalogue) return;
    loading = true; error = '';
    try {
      const response = await fetch('/api/live/library', { headers: { Authorization: `Bearer ${session.token}` }, cache: 'no-store', signal });
      // An identity the server no longer knows (a reset database) is the same as none: the front door stays quiet.
      if (response.status === 401 || response.status === 403) { session = null; loading = false; render(); return; }
      if (!response.ok || !response.headers.get('content-type')?.includes('application/json')) throw new Error('暂时读不到你的现场记录');
      catalogue = await response.json();
      catalogue.cards.sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
      if (signal.aborted) return;
      loading = false; render();
      await Promise.all(catalogue.cards.slice(0, 2).filter(card => card.photoId).map(async card => {
        try { await photos.load(card.photoId); if (!signal.aborted) render(); }
        catch (reason) { if (reason.name !== 'AbortError') { error = '有张照片没能读到'; render(); } }
      }));
    } catch (reason) {
      if (reason.name !== 'AbortError') { error = reason.message; loading = false; render(); }
    }
  }
  container.addEventListener('click', event => {
    const button = event.target.closest('[data-home]');
    if (!button) return;
    if (button.dataset.home === 'make') makeCard();
    if (button.dataset.home === 'make-demo') api.navigate('space', { showDemo: true, editCard: true });
    if (button.dataset.home === 'invite') api.navigate('live', { intent: 'invite' });
    if (button.dataset.home === 'demo') api.navigate('space', { showDemo: true });
    if (button.dataset.home === 'resume') api.navigate('live', { roomId: button.dataset.room });
    if (button.dataset.home === 'retry') load();
    if (button.dataset.home === 'join') api.navigate('live', { intent: 'join-room' });
    if (button.dataset.home === 'photo') openCard(button.dataset.id);
  }, { signal });
  render();
  load();
  return () => { life.abort(); api.spatial?.publish({ cards: [] }); photos.clear(); };
}
