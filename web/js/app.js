import '../css/base.css';
import '../css/space.css';
import '../css/live.css';
import '../css/themes.css';
import '../css/theme-sakura.css';
import 'overlayscrollbars/overlayscrollbars.css';
import '../css/compact.css';
import '../css/app-studio.css';
import '../css/space-studio.css';
import '../css/spatial-world.css';
import '../css/library.css';
import '../css/product-finish.css';
import '../css/live-compose.css';
import '../css/memory-export.css';
import '../css/courtyard-ui.css';
import '../css/spatial-objects.css';
import '../css/scene-panels.css';
import '../css/scene-layout.css';
import '../css/duet-ceremony.css';
import '../css/night-shell.css';
import { OverlayScrollbars } from 'overlayscrollbars';
import { mountThemes } from './themes.js';
import { icon } from './icons.js';
import { createSpaceState, mountSpace, mountSpaceRecords } from './space.js';
import { mountHome } from './home.js';
import { mountLiveLibrary } from './live-library.js';
import { mountLive } from './live.js';
import { mountMotion } from './motion.js';
import { STATE_KEY, adoptLegacyStorage } from './storage.js';

const views = ['space', 'records', 'live'];
const root = document.querySelector('#app');
const toastElement = document.querySelector('#toast');
let toastTimer;
let cleanup;
let saveFailed = false;
let recordsFilter = 'live';
let demoActive = false;
let themeController;
let motion;
let spatialContext = {};
let spatialActionVersion = 0;

/**
 * Answered once at boot. Static hosting (GitHub Pages, file://) has no room server, so everything that needs
 * one is hidden or sent to the local demo, which then carries the whole story with the visitor's own photo.
 */
const backend = {
  available: false,
  note: '真实房间需要完整版服务；线上可先用示例体验完整流程。',
};

async function probeBackend() {
  // Opened from disk, or on GitHub Pages: there is no server to ask, so skip the request (and its 404 in the console).
  if (location.protocol === 'file:' || /(^|\.)github\.io$/.test(location.hostname)) return;
  // No abort timer here: a busy main thread would fire it before the answer is read. The boot waits separately
  // (see the end of this file) and adopts an answer that comes later.
  try {
    const response = await fetch('/api/live/health', { cache: 'no-store' });
    const body = response.ok && (response.headers.get('content-type') || '').includes('application/json') ? await response.json() : null;
    backend.available = body?.ok === true;
  } catch {
    backend.available = false;
  }
}

const validSpace = space => Boolean(space?.cards && Array.isArray(space.exchanges) && space.reactions?.a && space.reactions?.b
  && Array.isArray(space.records?.a) && Array.isArray(space.records?.b));

function initialState() {
  return { version: 1, view: 'space', actor: 'a', space: createSpaceState(), routePayload: null };
}

function load() {
  // Space stores its state under its own key (see storage.js). A 0.15 save left in Map's key is copied over, never changed.
  adoptLegacyStorage(validSpace);
  try {
    const saved = JSON.parse(localStorage.getItem(STATE_KEY));
    if (saved?.version === 1 && validSpace(saved.space)) {
      // A carried-over 0.15 save can still hold a link back to the record shop. That half belongs to another product.
      const kept = { ...saved };
      delete kept.map;
      delete kept.space.mapReturnId;
      return { ...kept, actor: kept.actor === 'b' ? 'b' : 'a', routePayload: null };
    }
  } catch {
    // A new browser or cleared local data starts a fresh demo.
  }
  return initialState();
}

const state = load();

/** The local demo lives under #/space/demo so Back, reload and shared links land on it. */
const demoKeys = ['showDemo', 'editCard', 'requestTarget', 'exchangeId', 'cardSaved', 'previewCardId', 'eventId'];
const isDemoPayload = payload => Boolean(payload && !payload.home && demoKeys.some(key => payload[key]));
const routeHash = (view, payload) => (view === 'space' && isDemoPayload(payload) ? '/space/demo' : `/${view}`);

function routeUrl(view, payload) {
  const url = new URL(location.href);
  url.hash = routeHash(view, payload);
  if (view !== 'live') url.searchParams.delete('room');
  return url;
}

function routeFromLocation() {
  const [head, sub] = location.hash.slice(2).split('/');
  const invited = /^\d{6}$/.test(new URLSearchParams(location.search).get('room') || '');
  const view = invited && (!head || head === 'live') ? 'live' : views.includes(head) ? head : 'space';
  return { view, payload: view === 'space' && sub === 'demo' ? { showDemo: true } : null };
}

/** Without a room server the live page is never a destination: the demo takes its place. */
function resolveRoute({ view, payload }) {
  if (view === 'live' && !backend.available) return { view: 'space', payload: { showDemo: true }, rerouted: true };
  return { view, payload, rerouted: false };
}

function toast(message) {
  clearTimeout(toastTimer);
  toastElement.textContent = message;
  toastElement.classList.add('visible');
  toastTimer = setTimeout(() => toastElement.classList.remove('visible'), 3200);
}

function persist() {
  try {
    localStorage.setItem(STATE_KEY, JSON.stringify(state));
    saveFailed = false;
  } catch {
    saveFailed = true;
  }
  updateChrome();
}

function update(mutator) {
  mutator(state);
  persist();
}

function navigate(view, payload = null) {
  if (!views.includes(view)) return;
  const route = resolveRoute({ view, payload });
  if (route.rerouted) toast(backend.note);
  if (route.view === 'records' && !route.payload) recordsFilter = backend.available ? 'live' : 'demo';
  spatialActionVersion++;
  state.view = route.view;
  state.routePayload = route.payload;
  const nextUrl = routeUrl(route.view, route.payload);
  if (location.href !== nextUrl.href) history.pushState(null, '', nextUrl);
  persist();
  render();
  window.scrollTo({ top: 0, behavior: 'instant' });
  document.querySelector('#main-content').focus({ preventScroll: true });
}

const api = { getState: () => state, update, render, navigate, toast, icon, backend,
  spatial: {
    publish(content) {
      spatialContext = content;
      document.body.dataset.spatialSection = content.mode || state.view;
      themeController?.setContent(content.cards || [], content.mode);
    },
    focus(kind, id) { return themeController?.focus(kind, id) || Promise.resolve(true); },
    restore() { themeController?.restore(); },
  },
};

async function onSpatialAction(action) {
  const version = ++spatialActionVersion;
  if (action.type === 'navigate') { navigate(action.view, action.view === 'space' ? { home: true } : null); return; }
  if (action.type === 'editor') {
    if (!spatialContext.onEdit) {
      if (backend.available) navigate('live', { intent: 'make-card' });
      else navigate('space', { showDemo: true, editCard: true });
      return;
    }
    const arrived = await themeController.focus('editor');
    if (arrived && version === spatialActionVersion) spatialContext.onEdit?.();
  }
  if (action.type === 'photo' && spatialContext.onPhoto) {
    const arrived = await themeController.focus('photo', action.id);
    if (arrived && version === spatialActionVersion) spatialContext.onPhoto?.(action.id);
  }
}

function updateChrome() {
  // Without rooms the second nav item is the demo, which is a mode of the home route.
  const current = !backend.available && demoActive ? 'demo' : state.view;
  document.querySelectorAll('[data-nav]').forEach(el => {
    const active = el.dataset.nav === current;
    el.classList.toggle('active', active);
    if (active) el.setAttribute('aria-current', 'page');
    else el.removeAttribute('aria-current');
  });
  const storageNote = document.querySelector('#storage-warning');
  if (storageNote) storageNote.hidden = !saveFailed;
  const sectionNames = { space: demoActive ? '示例现场' : '同一刻，另一面', records: '留住这次相遇', live: '邀请同场，交换视角' };
  document.title = `${sectionNames[state.view]} · Music Space`;
}

function navItems() {
  return [
    ['space', 'heart', '小院'],
    backend.available ? ['live', 'users', '照片墙'] : ['demo', 'users', '示例'],
    ['records', 'bookmark', '收藏'],
  ].map(([view, name, title]) => `
    <button class="nav-item" data-nav="${view}">
      ${icon(name)}<span>${title}</span>
    </button>`).join('');
}

function aboutFacts() {
  const facts = [
    ['现场卡', '默认私藏，双方同意后交换。'],
    ['票根', '对方同意后，两张卡合成两人署名的双联票根，收进我的记忆。'],
    ['示例', backend.available
      ? 'Lin、阿遥及预置照片均为虚构，也可以换成你自己的照片。'
      : 'Lin、阿遥及预置照片均为虚构，可换成你自己的照片，只存在这台设备上。'],
    ...(backend.available ? [] : [['房间', backend.note]]),
    ['身份', '仅在当前浏览器保留，清除网站数据后无法找回。'],
  ];
  return facts.map(([name, text]) => `<p><b>${name}</b><span>${text}</span></p>`).join('');
}

/** Everything that depends on the room server's answer: navigation, the invite-code pill and the About facts. */
function refreshChrome() {
  root.querySelector('.primary-nav').innerHTML = navItems();
  root.querySelector('.mobile-nav').innerHTML = navItems();
  const tools = root.querySelector('.masthead-tools');
  tools.querySelector('[data-join-room]')?.remove();
  if (backend.available) tools.insertAdjacentHTML('afterbegin', `<button class="courtyard-join" data-join-room>${icon('users')}输入邀请码</button>`);
  root.querySelector('.about-facts').innerHTML = aboutFacts();
  updateChrome();
}

function shell() {
  root.innerHTML = `
    <header class="app-masthead app-studio-shell">
      <button class="brand" data-nav="space" aria-label="回到小院 · 樱下放映 Music Space">
        <span class="brand-mark" aria-hidden="true"><i></i><i></i><i></i></span>
        <span class="brand-wordmark">樱下放映<small>Music Space</small></span>
      </button>
      <nav class="primary-nav" aria-label="主要导航"></nav>
      <div class="masthead-tools"><button class="demo-help icon-button" id="demo-help" aria-label="关于 Music Space" aria-haspopup="dialog" aria-controls="about-dialog">${icon('info')}</button></div>
    </header>
    <div id="sakura-world" class="spatial-world" hidden></div>
    <div class="app-body">
      <div id="storage-warning" class="storage-warning" role="alert" hidden>这次修改尚未保存到浏览器，当前页面内容仍保留。可减少上传图片后重试。<button id="retry-save">重试保存</button></div>
      <main id="main-content" class="main-content" tabindex="-1"></main>
    </div>
    <nav class="mobile-nav" aria-label="手机导航"></nav>
    <dialog id="about-dialog" class="about-dialog" aria-labelledby="about-title">
      <div class="about-top"><h2 id="about-title">樱下放映</h2><button class="icon-button" id="close-about" aria-label="关闭关于">${icon('x')}</button></div>
      <p class="about-intro">同一刻，另一面。</p><div class="about-facts"></div>
      <button class="button button--primary" id="start-experience">知道了</button>
    </dialog>`;
  refreshChrome();
  root.addEventListener('click', event => {
    if (event.target.closest('[data-join-room]')) navigate('live', { intent: 'join-room' });
    const item = event.target.closest('[data-nav]');
    if (item) {
      document.querySelector('#about-dialog').close();
      const target = item.dataset.nav;
      if (target === 'demo') navigate('space', { showDemo: true });
      else navigate(target, target === 'space' ? { home: true } : null);
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
  document.querySelector('#close-about').addEventListener('click', () => dialog.close());
  document.querySelector('#start-experience').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
  document.querySelector('#retry-save').addEventListener('click', () => {
    persist();
    toast(saveFailed ? '仍未保存，可减少上传图片后重试' : '已保存到当前浏览器');
  });
}

function render() {
  spatialActionVersion++;
  cleanup?.();
  cleanup = null;
  spatialContext = {};
  themeController?.setContent([]);
  const container = document.querySelector('#main-content');
  container.replaceChildren();
  demoActive = state.view === 'space' && isDemoPayload(state.routePayload);
  document.body.dataset.view = state.view;
  document.body.dataset.spatialSection = state.view === 'space' ? 'home' : state.view;
  themeController?.setView(state.view);
  if (state.view === 'space') cleanup = demoActive ? mountSpace(container, api) : mountHome(container, api);
  if (state.view === 'live') cleanup = mountLive(container, api);
  if (state.view === 'records') {
    const payload = state.routePayload;
    const filters = backend.available ? [['live', '我的现场'], ['demo', '示例']] : [['demo', '示例']];
    if (payload?.spaceRecordId || payload?.section === 'space') recordsFilter = 'demo';
    else if (payload?.libraryItemId || payload?.section === 'live') recordsFilter = 'live';
    if (!filters.some(([value]) => value === recordsFilter)) recordsFilter = filters[0][0];
    container.innerHTML = `<div class="records-page collection-page"><header class="records-heading"><h1>我的收藏</h1><button class="button button--secondary" data-collection-make>${icon('plus')}${backend.available ? '记录现场' : '做一张卡'}</button></header>${filters.length > 1 ? `<div class="records-filters" role="group" aria-label="记录分类">${filters.map(([value, label]) => `<button data-records-filter="${value}" aria-pressed="${recordsFilter === value}">${label}</button>`).join('')}</div>` : ''}<div id="collection-content"></div></div>`;
    const content = container.querySelector('#collection-content');
    if (recordsFilter === 'live') cleanup = mountLiveLibrary(content, api);
    if (recordsFilter === 'demo') cleanup = mountSpaceRecords(content, api);
    container.querySelector('[data-collection-make]').onclick = () => {
      if (backend.available) navigate('live', { intent: 'make-card' });
      else navigate('space', { showDemo: true, editCard: true });
    };
  }
  updateChrome();
  container.scrollTop = 0;
  motion?.enter(container, state.view);
}

window.addEventListener('popstate', () => {
  if (location.hash === '#main-content') return;
  const route = resolveRoute(routeFromLocation());
  if (route.rerouted) {
    history.replaceState(null, '', routeUrl(route.view, route.payload));
    toast(backend.note);
  }
  state.view = route.view;
  state.routePayload = route.payload;
  persist();
  render();
});

let startedWith = null; // what the first page believed about the room server

function start() {
  startedWith = backend.available;
  recordsFilter = backend.available ? 'live' : 'demo';
  refreshChrome();
  const route = resolveRoute(routeFromLocation());
  state.view = route.view;
  state.routePayload = route.payload;
  // Old bookmarks (#/explore) and blocked routes settle on the address that is actually shown.
  const shown = routeUrl(route.view, route.payload);
  if (route.rerouted || (location.hash && location.hash !== '#main-content' && shown.hash !== location.hash)) history.replaceState(null, '', shown);
  persist();
  render();
  if (route.rerouted) toast(backend.note);
}

/** A slow device can answer the probe after the first page is up; the rooms then appear without a reload. */
function adoptLateAnswer() {
  if (startedWith !== false || !backend.available) return;
  refreshChrome();
  if (demoActive || document.querySelector('dialog[open]')) return;
  if (state.view === 'space' || state.view === 'records') render();
}

// The probe runs while the shell and the courtyard build; the first page waits for its answer.
const probe = probeBackend();
state.view = routeFromLocation().view;
shell();
themeController = mountThemes({ onAction: onSpatialAction, view: state.view,
  onShot(key, id, travelling) { document.body.dataset.spatialShot = key; document.body.toggleAttribute('data-spatial-travelling', travelling); },
});
motion = mountMotion();
// The allowance starts after the courtyard is built: a busy phone must not lose the race to its own main thread.
// An invite link or #/live is worth a longer wait; the home page settles for 1.5 s and adopts a late answer.
const allowance = routeFromLocation().view === 'live' ? 8000 : 1500;
Promise.race([probe, new Promise(resolve => setTimeout(resolve, allowance))]).then(start);
probe.then(adoptLateAnswer);
// Keep window scrolling and focus navigation native; only replace its chrome.
OverlayScrollbars(document.body, {
  overflow: { x: 'hidden', y: 'scroll' },
  scrollbars: { theme: 'os-theme-music', autoHide: 'scroll', autoHideDelay: 650, dragScroll: true, clickScroll: false },
});
