// The 0.16 stylesheets are one cascade layer (geometry: placement beside the scene, breakpoints, the WebGL-off flow); the Doodle layer
// (css/doodle/, unlayered, so it wins every visual property it sets) is the look. Nothing else in the page imports CSS before them.
import '../css/legacy.css';
import '../css/doodle/index.css';
import { OverlayScrollbars } from 'overlayscrollbars';
import { mountThemes } from './themes.js';
import { icon } from './icons.js';
import { createMapState, mountMap, mountMapRecords } from './map.js';
import { mountHome } from './home.js';
import { mountMotion } from './motion.js';
import { mountOpenCatalogue, mountSavedMusic } from './open-catalogue.js';
import { qqLinkedCount, realSongs } from './map-catalogue.js';
import { artists } from './map-data.js';
import openCatalogue from '../assets/data/hf-collaborations.json';
import { eventRoomUrl } from '../../shared/site-base.js';
import { createExplorationStorage, EXPLORATION_KEY } from './exploration-storage.js';

// The key and version stay from 0.15 so a returning visitor keeps every exploration.
const STORAGE_KEY = EXPLORATION_KEY;
const views = ['home', 'explore', 'records'];
// Routes retired in 0.16: old links, saved views and an older scene build all land on the courtyard.
const LEGACY = new Map([['space', 'home'], ['live', 'home']]);
const root = document.querySelector('#app');
const toastElement = document.querySelector('#toast');
let toastTimer;
let cleanup;
let storageReady = false;
let conflictRenderQueued = false;
const explorationStorage = createExplorationStorage({
  storage: { getItem: key => localStorage.getItem(key), setItem: (key, value) => localStorage.setItem(key, value) },
  locks: navigator.locks,
  onChange() {
    if (!storageReady) return;
    updateChrome();
    // Never re-enter render from a migration or cleanup's synchronous update.
    if (explorationStorage.conflict && !conflictRenderQueued) {
      conflictRenderQueued = true;
      queueMicrotask(() => { conflictRenderQueued = false; render(); });
    }
  },
});
let recordsFilter = 'map';
let themeController;
let motion;
let spatialContext = {};
let droppedLegacy = false;

function initialState() {
  return { version: 1, view: 'home', map: createMapState(), routePayload: null };
}

function load() {
  try {
    const saved = JSON.parse(explorationStorage.initialRaw);
    if (saved?.version === 1 && saved.map) {
      // 0.15 saves also carry the Space demo (cards with photos) and its actor; neither is read any more.
      const { space, actor, ...kept } = saved;
      droppedLegacy = space !== undefined || actor !== undefined;
      // An undo slip belongs to the visit that made the removal; a new visit starts without one.
      if (kept.map) kept.map.undo = null;
      return { ...kept, routePayload: null };
    }
  } catch {
    // A new browser or cleared local data starts fresh.
  }
  return initialState();
}

function routeView(name) {
  const view = LEGACY.get(name) || name;
  return views.includes(view) ? view : 'home';
}

/** Old invitation links carried ?room=. A retired or unknown route shows the courtyard, and the address says so. */
function tidyUrl() {
  const url = new URL(location.href);
  if (url.searchParams.has('room')) url.searchParams.delete('room');
  // The skip link's own fragment is left alone; a bare address stays bare.
  if (url.hash && url.hash !== '#main-content') url.hash = `/${routeView(url.hash.slice(2))}`;
  if (url.href !== location.href) history.replaceState(null, '', url);
}

/** A 寻声 puzzle from a friend: `?from=<start>&to=<target>#/explore`. The pair is read once and taken
 *  off the address (a reload or a copied address does not deal it again); the record shop checks it
 *  against the catalogue. Nothing else is read from the link. */
function takeSharedRound() {
  const url = new URL(location.href);
  if (!url.searchParams.has('from') && !url.searchParams.has('to')) return null;
  const id = name => (url.searchParams.get(name) || '').trim().slice(0, 64);
  const round = { start: id('from'), target: id('to') };
  url.searchParams.delete('from');
  url.searchParams.delete('to');
  url.hash = '/explore';
  history.replaceState(null, '', url);
  return round;
}

const sharedRound = takeSharedRound();
const state = load();
state.view = routeView(location.hash.slice(2));
tidyUrl();
// The record shop deals the friend's pair on its first drawing (mountMap's {round:{start,target}} entry).
if (sharedRound) Object.assign(state, { view: 'explore', routePayload: { round: sharedRound, fromFriend: true } });

/* In the record shop a toast sits just above the dock or the hand (map-round.css, map-spatial.css); a phone
 * never puts one over the masthead. Where it would lie over a name tag or a song title on the table, it is
 * lifted: on a desktop to the top middle, clear of the brand and the paper slips; on a phone to just under
 * the masthead (over the round's question slip, which it repeats), clear of the brand. */
const TOAST_AVOID = '.world-music-label:not([hidden]),.world-music-link:not([hidden])';
let toastFrame = 0;
// The scene hides its tags under an open paper with visibility, not [hidden]: only a tag one can see counts.
const seen = element => element.checkVisibility ? element.checkVisibility({ visibilityProperty: true, opacityProperty: true }) : getComputedStyle(element).visibility === 'visible';
function toastCovers(selector, box, gap = 4) {
  return [...document.querySelectorAll(selector)].some(element => {
    if (!seen(element)) return false;
    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0 && rect.left < box.right + gap && rect.right > box.left - gap && rect.top < box.bottom + gap && rect.bottom > box.top - gap;
  });
}
function placeToast() {
  toastElement.classList.remove('toast--top');
  toastElement.style.removeProperty('--toast-top');
  if (state.view !== 'explore' || document.body.classList.contains('spatial-fallback')) return;
  if (!toastCovers(TOAST_AVOID, toastElement.getBoundingClientRect())) return;
  const phone = window.innerWidth <= 760;
  const brand = document.querySelector('.app-studio-shell .brand')?.getBoundingClientRect();
  if (phone && brand) toastElement.style.setProperty('--toast-top', `${Math.round(brand.bottom + 8)}px`);
  toastElement.classList.add('toast--top');
  const lifted = toastElement.getBoundingClientRect();
  const keepClear = phone ? '.brand,.masthead-tools' : '.brand,.masthead-tools,.map-round-head,.map-studio-head';
  if (toastCovers(TOAST_AVOID, lifted) || toastCovers(keepClear, lifted)) {
    toastElement.classList.remove('toast--top');
    toastElement.style.removeProperty('--toast-top');
  }
}

// Opening the shop's 目录 paper clears a toast, which would otherwise lie over its first items for a moment.
document.addEventListener('toggle', event => {
  if (!event.target.open || !event.target.matches?.('.map-shop-menu')) return;
  clearTimeout(toastTimer); cancelAnimationFrame(toastFrame); toastElement.classList.remove('visible');
}, true);

function toast(message) {
  clearTimeout(toastTimer);
  cancelAnimationFrame(toastFrame);
  toastElement.textContent = message;
  // The scene redraws its tags on the next frame after the change that raised this toast: place, then show.
  toastFrame = requestAnimationFrame(() => {
    toastFrame = requestAnimationFrame(() => {
      placeToast();
      toastElement.classList.add('visible');
      toastTimer = setTimeout(() => toastElement.classList.remove('visible'), 3200);
    });
  });
}

function persist() {
  const saved = explorationStorage.save(state);
  updateChrome();
  return saved;
}

function canUpdate() {
  return explorationStorage.check();
}

function update(mutator) {
  if (!canUpdate()) return false;
  mutator(state);
  void persist();
  return true;
}

function navigate(name, payload = null) {
  const view = LEGACY.get(name) || name;
  if (!views.includes(view)) return;
  if (view === 'records' && !payload) recordsFilter = 'map';
  state.view = view;
  state.routePayload = payload;
  const nextUrl = new URL(location.href);
  nextUrl.hash = `/${view}`;
  if (location.href !== nextUrl.href) history.pushState(null, '', nextUrl);
  // Navigation must never write an old exploration snapshot over another tab.
  explorationStorage.check();
  render();
  window.scrollTo({ top: 0, behavior: 'instant' });
  document.querySelector('#main-content').focus({ preventScroll: true });
}

const api = { getState: () => state, update, canUpdate, render, navigate, toast, icon,
  spatial: {
    publish(content) {
      spatialContext = content;
      document.body.dataset.spatialSection = content.mode || state.view;
      themeController?.setContent(content.cards || [], content.mode);
      themeController?.setMusic(content.music || null);
    },
    musicControl(command) { return themeController?.musicControl(command); },
  },
};
window.addEventListener('music-space-map-artist',event=>{
  if(typeof event.detail?.artistId==='string')navigate('explore',{artistId:event.detail.artistId});
});

/** The courtyard only navigates and forwards record-table actions to the shop. */
function onSpatialAction(action) {
  if (action.type === 'music' && canUpdate()) spatialContext.onMusic?.(action);
  if (action.type === 'navigate') navigate(action.view);
  // 'editor' and 'photo' came from Space's desk and photo wall; an older scene build may still send them.
}

function updateChrome() {
  document.querySelectorAll('[data-nav]').forEach(el => {
    const active = el.dataset.nav === state.view;
    el.classList.toggle('active', active);
    if (active) el.setAttribute('aria-current', 'page');
    else el.removeAttribute('aria-current');
  });
  const storageNote = document.querySelector('#storage-warning');
  if (storageNote) {
    storageNote.hidden = !(explorationStorage.failed || explorationStorage.conflict);
    const message = document.querySelector('#storage-message');
    message.textContent = explorationStorage.conflict
      ? '另一个标签页改了探索记录，这一页先不保存了。重新载入后继续。'
      : '这次修改没存上：浏览器存储不可用。可以先下载备份。';
    document.querySelector('#retry-save').hidden = explorationStorage.conflict;
    document.querySelector('#reload-records').hidden = !explorationStorage.conflict;
  }
  const sectionNames = { home: '音乐探索', explore: '唱片店', records: '我的发现' };
  // The brand comes first in the tab, as it does on the masthead.
  document.title = `Music Space · ${sectionNames[state.view]}`;
}

function navItems() {
  return [
    ['home', 'heart', '小院'],
    ['explore', 'record', '唱片店'],
    ['records', 'bookmark', '我的发现'],
  ].map(([view, name, title]) => `
    <button class="nav-item" data-nav="${view}">
      ${icon(name)}<span>${title}</span>
    </button>`).join('');
}

/** 关于 · 数据来源: what the table, the listening links and the open catalogue are made of, counted from the data itself. */
function dataSourcesHTML() {
  const recordings = Object.values(realSongs);
  const day = iso => iso.split('-').map(Number);
  const span = dates => {
    const sorted = [...new Set(dates)].sort(); const [y, m, d] = day(sorted[0]); const [y2, m2, d2] = day(sorted[sorted.length - 1]);
    return y === y2 && m === m2 ? `${y} 年 ${m} 月 ${d === d2 ? d : `${d}–${d2}`} 日` : `${sorted[0]} 至 ${sorted[sorted.length - 1]}`;
  };
  const source = openCatalogue.source;
  // The Doodle fonts live with the event room: its own fonts/doodle/ on every build (site root on Pages, /event-room/ on Node).
  const fontsLicence = new URL('fonts/doodle/LICENSES.txt', eventRoomUrl()).href;
  const out = (href, label) => `<a href="${href}" target="_blank" rel="noopener noreferrer">${label}<span aria-hidden="true"> ↗</span><span class="sr-only">（新标签页）</span></a>`;
  return `<section class="about-sources" id="about-sources" aria-labelledby="about-sources-title" tabindex="-1">
      <h3 id="about-sources-title">数据来源</h3>
      <ul>
        <li><b>合唱目录</b><span>${artists.length} 位音乐人、${recordings.length} 首共同演唱录音，每首都附有出处，资料访问于 ${span(recordings.flatMap(song => [song.checkedAt, ...song.creditSources.map(source => source.checkedAt)]))}；出处在每首歌的「来源」里。路线和「最短」只算这 ${recordings.length} 首。</span></li>
        <li><b>QQ 音乐</b><span>${qqLinkedCount} 首在 QQ 音乐有同一录音的页面（${span(recordings.flatMap(song => song.listenLinks.map(link => link.checkedAt)))}按页面信息确认）；另外 ${recordings.length - qqLinkedCount} 首的原因写在「来源」里。</span></li>
        <li><b>开放曲库</b><span>${openCatalogue.tracks.length} 首，取自 Hugging Face 数据集 ${source.repository}（快照 ${source.revision.slice(0, 7)}）里 ${openCatalogue.genres.join('、')} 的共同署名记录（全库 ${openCatalogue.counts.rows.toLocaleString('en-US')} 行）。数据卡标注的许可是 ${source.licenseLabel}，没有写明具体版本；这里只取曲名、艺人、专辑和行号，不含音频。${out(source.url, '数据集')}</span></li>
        <li><b>字体</b><span>ZCOOL QingKe HuangYou、LXGW Marker Gothic、Yozai、Luckiest Guy、Smiley Sans 的子集（SIL OFL 1.1、Apache 2.0）。${out(fontsLicence, '许可全文')}</span></li>
        <li><b>代码</b><span>three.js、Sakura Crossing、OverlayScrollbars、qrcode-generator（MIT），GSAP（Standard No Charge 许可）；许可全文附在网页源码里。</span></li>
        <li><b>来历</b><span>唱片店、寻声和合唱目录来自 Music Map。</span></li>
      </ul>
    </section>`;
}

function shell() {
  root.innerHTML = `
    <header class="app-masthead app-studio-shell">
      <button class="brand" data-nav="home" aria-label="Music Space 音乐探索，回到小院">
        <span class="brand-logo" aria-hidden="true">Music Space</span>
        <span class="brand-sticker" aria-hidden="true">音乐探索</span>
      </button>
      <nav class="primary-nav" aria-label="主要导航">${navItems()}</nav>
      <div class="masthead-tools"><button class="demo-help icon-button" id="demo-help" aria-label="关于音乐探索" aria-haspopup="dialog" aria-controls="about-dialog">${icon('info')}</button></div>
    </header>
    <div id="sakura-world" class="spatial-world" hidden></div>
    <div class="app-body">
      <div id="storage-warning" class="storage-warning" role="alert" hidden><span id="storage-message"></span><span class="storage-warning__actions"><button id="retry-save">重试</button><button id="reload-records" hidden>重新载入</button><button id="backup-records">下载备份</button></span></div>
      <main id="main-content" class="main-content" tabindex="-1"></main>
    </div>
    <nav class="mobile-nav" aria-label="手机导航">${navItems()}</nav>
    <dialog id="about-dialog" class="about-dialog" aria-labelledby="about-title">
      <div class="about-top"><h2 id="about-title">关于音乐探索</h2><button class="icon-button" id="close-about" aria-label="关闭">${icon('x')}</button></div>
      <p class="about-intro">从喜欢，<span>走向未知。</span></p>
      <div class="about-facts"><p><b>寻声</b><span>选好起点和终点，翻开手边的合唱，沿它走到下一位；翻开和提示不算步数。</span></p><p><b>图鉴</b><span>摊开全部合唱，从任意一位歌手出发随便走。</span></p><p><b>来源</b><span>每条连线是一首合唱录音，点歌旁的「来源」看出处。</span></p><p><b>曲库</b><span>开放曲库是公开数据集里的共同署名，不一定是合唱，不进入连线。</span></p><p><b>音频</b><span>这里不播放音乐；${qqLinkedCount} 首可以去 QQ 音乐听同一录音。</span></p></div>
      ${dataSourcesHTML()}
      <button class="button button--primary" id="start-experience">知道了</button>
    </dialog>`;
  root.addEventListener('click', event => {
    const item = event.target.closest('[data-nav]');
    if (item) {
      document.querySelector('#about-dialog').close();
      navigate(item.dataset.nav);
    }
    const filter = event.target.closest('[data-records-filter]');
    if (filter) {
      recordsFilter = filter.dataset.recordsFilter;
      state.routePayload = null;
      render();
      document.querySelector(`[data-records-filter="${recordsFilter}"]`)?.focus({ preventScroll: true });
    }
  });
  const dialog = document.querySelector('#about-dialog');
  document.querySelector('#demo-help').addEventListener('click', () => dialog.showModal());
  // 「数据来源」 (the open catalogue's footer) opens 关于 at its data-sources section, from any paper.
  document.addEventListener('click', event => {
    if (!event.target.closest('[data-about-sources]')) return;
    event.target.closest('dialog[open]')?.close();
    if (!dialog.open) dialog.showModal();
    const section = dialog.querySelector('#about-sources');
    section.scrollIntoView({ block: 'start' });
    // The sheet's title bar is sticky: step back until the section (its heading and first line) sits just under it.
    const covered = dialog.querySelector('.about-top').getBoundingClientRect().bottom + 10 - section.getBoundingClientRect().top;
    if (covered > 0) dialog.scrollTop -= covered;
    section.focus({ preventScroll: true });
  });
  document.querySelector('#close-about').addEventListener('click', () => dialog.close());
  document.querySelector('#start-experience').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
  document.querySelector('#retry-save').addEventListener('click', async () => {
    const saved = await persist();
    toast(saved ? '已保存' : '还是没存上');
  });
  document.querySelector('#reload-records').addEventListener('click', () => {
    if (explorationStorage.dirty && !window.confirm('重新载入会丢掉这一页没保存的探索，确定吗？')) return;
    location.reload();
  });
  document.querySelector('#backup-records').addEventListener('click', () => {
    const file = new Blob([JSON.stringify({ version: 1, map: state.map }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(file);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'music-space-map-exploration-backup.json';
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
}

/** 我的发现: the explorations walked here and the songs kept on the way. */
function mountRecords(container) {
  const section = state.routePayload?.section;
  if (section === 'map' || section === 'music') recordsFilter = section;
  const filters = [['map', '探索记录'], ['music', '留下的歌']];
  container.innerHTML = `<div class="records-page collection-page"><header class="records-heading"><h1>我的发现</h1><button class="button" data-records-explore>${icon('record')}去唱片店</button></header><div class="records-filters" role="group" aria-label="我的发现分类">${filters.map(([value, label]) => `<button data-records-filter="${value}" aria-pressed="${recordsFilter === value}">${label}</button>`).join('')}</div><div id="collection-content"></div></div>`;
  container.querySelector('[data-records-explore]').onclick = () => navigate('explore');
  const content = container.querySelector('#collection-content');
  return recordsFilter === 'music' ? mountSavedMusic(content, api) : mountMapRecords(content, api);
}

function render() {
  cleanup?.();
  cleanup = null;
  spatialContext = {};
  themeController?.setContent([]);
  if (state.view !== 'explore') themeController?.setMusic(null);
  const container = document.querySelector('#main-content');
  container.replaceChildren();
  document.body.dataset.view = state.view;
  document.body.dataset.spatialSection = state.view;
  themeController?.setView(state.view);
  if (explorationStorage.conflict) {
    themeController?.setMusic(null);
    container.innerHTML = '<section class="empty-state map-conflict"><h1>探索记录在别的标签页更新了</h1><p>重新载入后继续。</p></section>';
    updateChrome();
    return;
  }
  if (state.view === 'home') cleanup = mountHome(container, api);
  if (state.view === 'explore') cleanup = mountMap(container, api);
  if (state.view === 'records') cleanup = mountRecords(container);
  updateChrome();
  container.scrollTop = 0;
  motion?.enter(container, state.view);
}

window.addEventListener('popstate', () => {
  if (location.hash === '#main-content') return;
  state.view = routeView(location.hash.slice(2));
  state.routePayload = null;
  tidyUrl();
  explorationStorage.check();
  render();
});

window.addEventListener('storage', event => {
  if ((event.key === STORAGE_KEY || event.key === null) && (!event.storageArea || event.storageArea === localStorage)) explorationStorage.check();
});
window.addEventListener('focus', () => explorationStorage.check());
window.addEventListener('pageshow', () => explorationStorage.check());
window.addEventListener('beforeunload', event => {
  if (!explorationStorage.dirty) return;
  event.preventDefault();
  event.returnValue = '';
});

shell();
storageReady = true;
// Write the trimmed save once, so the dropped Space data frees its storage now.
if (droppedLegacy) persist();
themeController = mountThemes({ onAction: onSpatialAction, view: state.view,
  onShot(key, id, travelling) { document.body.dataset.spatialShot = key; document.body.toggleAttribute('data-spatial-travelling', travelling); },
});
motion = mountMotion();
const cleanupCatalogue=mountOpenCatalogue(api);
render();
// Keep window scrolling and focus navigation native; only replace its chrome.
const scrollbar=OverlayScrollbars(document.body, {
  overflow: { x: 'hidden', y: 'scroll' },
  scrollbars: { theme: 'os-theme-music', autoHide: 'scroll', autoHideDelay: 650, dragScroll: true, clickScroll: false },
});

// Page navigation owns one renderer at a time. A restored BFCache document
// recreates its disposed scene, rather than retaining a dead WebGL context.
window.addEventListener('pagehide',()=>{cleanup?.();cleanupCatalogue?.();motion?.dispose();scrollbar?.destroy();themeController?.dispose();});
window.addEventListener('pageshow',event=>{if(event.persisted)location.reload();});
