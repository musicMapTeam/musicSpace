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
import { SAME_MOMENT_MS } from './moment.js';
import { AI_OFF_LINES, aiState } from './photo-insight.js';
import { STATE_KEY, STORAGE_ADVICE, adoptLegacyStorage, storageFailureKind } from './storage.js';

const views = ['space', 'records', 'live'];
const root = document.querySelector('#app');
const toastElement = document.querySelector('#toast');
let toastTimer;
let cleanup;
let recordsFilter = 'live';
let demoActive = false;
let themeController;
let motion;
let spatialContext = {};
let spatialActionVersion = 0;
let started = false; // the first page is drawn; a later answer about rooms has to repaint it

/** What the browser did with the last save of the demo state; `kind` says why it refused (see storage.js). */
const storage = { ok: true, kind: '' };
let noticeClosed = ''; // the failure whose notice the visitor closed; a different failure, or a save that works again, brings it back

/**
 * Whether a room server stands behind this page. Static hosting (GitHub Pages, any plain file host, a file on disk,
 * vite preview) has none, so everything that needs one is hidden or sent to the local demo, which then carries the
 * whole story with the visitor's own photo. The page does not go looking for a server over the network:
 *  - the room server writes <meta name="space-rooms" content="1"> into the page it serves, so the page believes in
 *    its rooms at once and only confirms with /api/live/health in the background, giving them up if that fails;
 *  - the Vite dev server has a proxy to the room server, so there (and only there) the page asks, as it always did,
 *    and adopts an answer that arrives after the first page;
 *  - anything else is the static version and sends no request at all.
 */
const backend = {
  available: false,
  note: '真实房间需要完整版服务；线上可先用示例体验完整流程。',
};
// A page saved to disk or copied to GitHub Pages can still carry the tag; there is no server behind it.
const hosted = location.protocol !== 'file:' && !/(^|\.)github\.io$/.test(location.hostname);
const roomsMeta = document.querySelector('meta[name="space-rooms"]');
const detection = !hosted ? 'static'
  : roomsMeta && !/^(0|false|no|off)$/i.test(roomsMeta.content.trim()) ? 'served'
    : import.meta.env.DEV ? 'probe' : 'static';
backend.available = detection === 'served';

/** One look at the room server's health endpoint: true only for a JSON answer that says ok. */
async function askHealth() {
  try {
    const response = await fetch('/api/live/health', { cache: 'no-store' });
    const body = response.ok && (response.headers.get('content-type') || '').includes('application/json') ? await response.json() : null;
    return body?.ok === true;
  } catch {
    return false;
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
  // An invite code means something only on the live page of a room server; anywhere else it is dropped from the address.
  if (view !== 'live' || !backend.available) url.searchParams.delete('room');
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

// Words that say something was kept in this browser. After a refused write they would be untrue.
const SAVE_CLAIM = /已(?:私下)?保存|已收进|已存入/;
const storageAdvice = () => STORAGE_ADVICE[storage.kind] || '';

/**
 * A toast that reports a save must not outlive a failed one: when the browser refused the last write, the message is
 * replaced by the reason. `saved: true` marks a message as a save report, `saved: false` exempts it. Unmarked messages
 * that use the words above count as save reports, except on the room page, where 已保存 means the server kept it
 * and a full or blocked localStorage changes nothing about that.
 */
function toast(message, { saved } = {}) {
  const claimsSave = saved ?? (state.view !== 'live' && SAVE_CLAIM.test(message));
  const text = claimsSave && !storage.ok ? `没能存入浏览器：${storageAdvice()}` : message;
  clearTimeout(toastTimer);
  toastElement.textContent = text;
  toastElement.classList.add('visible');
  toastTimer = setTimeout(() => toastElement.classList.remove('visible'), Math.min(7000, Math.max(3200, text.length * 120)));
}

/** Writes the state to this browser and records the outcome. Returns true when the browser kept it. */
function persist() {
  try {
    localStorage.setItem(STATE_KEY, JSON.stringify(state));
    storage.ok = true;
    storage.kind = '';
    noticeClosed = '';
  } catch (error) {
    storage.ok = false;
    storage.kind = storageFailureKind(error);
  }
  updateChrome();
  return storage.ok;
}

/** True when the browser kept the change, so a caller can word its own confirmation. */
function update(mutator) {
  mutator(state);
  return persist();
}

/** For pages that report saves: whether the last write was kept and, if not, why (`kind`) and what to tell the visitor. */
function storageState() {
  return { ok: storage.ok, kind: storage.kind, advice: storage.ok ? '' : storageAdvice() };
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

const api = { getState: () => state, update, render, navigate, toast, icon, backend, storageState,
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
  if (storageNote) {
    storageNote.hidden = storage.ok || noticeClosed === storage.kind;
    // What to do about it depends on why the browser refused (see storage.js); the text is only rewritten when it changes.
    const line = storageNote.querySelector('[data-storage-text]');
    const text = storage.ok ? '' : `没能保存到浏览器，当前页面内容仍保留。${storageAdvice()}。`;
    if (line && line.textContent !== text) line.textContent = text;
  }
  const sectionNames = { space: demoActive ? '示例现场' : '同一刻，另一面', records: '留住这次相遇', live: '邀请同场，交换视角' };
  document.title = `Music Space · ${sectionNames[state.view]}`;
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
  const model = aiState();
  const facts = [
    ['现场卡', '默认私藏，双方同意后交换。'],
    ['同一刻', `按照片的拍摄时间判断，相差 ${SAME_MOMENT_MS / 60_000} 分钟内算同一刻；读不到时间，就按你选的时刻。`],
    // Said only where it is true: a browser without WebAssembly SIMD (or a file:// page) never runs the model, and a model that
    // failed to load is not promised either. The facts are drawn again each time the dialog opens.
    ['AI', model === 'on'
      ? 'AI 在本机判断视角，判断时照片不上传（第一次要下载约 10 MB）；没把握就不替你选，选了也随时可改。'
      : AI_OFF_LINES[model]],
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
      <button class="brand" data-nav="space" aria-label="Music Space · 樱下放映 · 散场以后，回到小院">
        <span class="brand-mark" aria-hidden="true"><i></i><i></i><i></i></span>
        <span class="brand-wordmark">Music Space<small>樱下放映 · 散场以后</small></span>
      </button>
      <nav class="primary-nav" aria-label="主要导航"></nav>
      <div class="masthead-tools"><button class="demo-help icon-button" id="demo-help" aria-label="关于 Music Space" aria-haspopup="dialog" aria-controls="about-dialog">${icon('info')}</button></div>
    </header>
    <!-- Right after the masthead in reading and tab order; it is pinned under it on screen. -->
    <div id="storage-warning" class="storage-warning" role="alert" hidden><span data-storage-text></span><button id="retry-save">重试保存</button><button id="close-storage-note" class="storage-warning__close" aria-label="先不提醒">${icon('x')}</button></div>
    <div id="sakura-world" class="spatial-world" hidden></div>
    <div class="app-body">
      <main id="main-content" class="main-content" tabindex="-1"></main>
    </div>
    <nav class="mobile-nav" aria-label="手机导航"></nav>
    <dialog id="about-dialog" class="about-dialog" aria-labelledby="about-title">
      <div class="about-top"><h2 id="about-title">Music Space</h2><button class="icon-button" id="close-about" aria-label="关闭关于">${icon('x')}</button></div>
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
  document.querySelector('#demo-help').addEventListener('click', () => {
    root.querySelector('.about-facts').innerHTML = aboutFacts();
    dialog.showModal();
  });
  document.querySelector('#close-about').addEventListener('click', () => dialog.close());
  document.querySelector('#start-experience').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
  document.querySelector('#retry-save').addEventListener('click', () => {
    persist();
    toast(storage.ok ? '已保存到当前浏览器' : `仍未保存：${storageAdvice()}`, { saved: false });
  });
  document.querySelector('#close-storage-note').addEventListener('click', () => {
    noticeClosed = storage.kind;
    updateChrome();
    document.querySelector('#main-content').focus({ preventScroll: true });
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
  // A hand-edited or retired address (#/explore) settles on the one that is shown, as it does when the page loads.
  const shown = routeUrl(route.view, route.payload);
  if (route.rerouted || (location.hash && shown.hash !== location.hash)) history.replaceState(null, '', shown);
  if (route.rerouted) toast(backend.note);
  state.view = route.view;
  state.routePayload = route.payload;
  persist();
  render();
});

function start() {
  started = true;
  recordsFilter = backend.available ? 'live' : 'demo';
  refreshChrome();
  const route = resolveRoute(routeFromLocation());
  state.view = route.view;
  state.routePayload = route.payload;
  // Old bookmarks (#/explore), blocked routes and an invite code the static build cannot use settle on the address that is
  // actually shown.
  const shown = routeUrl(route.view, route.payload);
  const staleHash = Boolean(location.hash) && location.hash !== '#main-content' && shown.hash !== location.hash;
  const strayRoom = !backend.available && new URLSearchParams(location.search).has('room');
  if (route.rerouted || staleHash || strayRoom) history.replaceState(null, '', shown);
  persist();
  render();
  if (route.rerouted) toast(backend.note);
}

/**
 * The answer about the room server arrived, or changed, after the first page was drawn: a slow probe in dev finds
 * rooms, or a served page finds its API gone. Navigation, pills and pages follow without a reload. A visitor in the
 * middle of the demo keeps it (its own actions cope with rooms coming or going), and an open dialog is left alone
 * until it closes.
 */
function adoptBackend(available) {
  if (backend.available === available) return;
  backend.available = available;
  if (!started) return; // start() has not drawn anything yet and will read the answer itself
  refreshChrome();
  const repaint = () => {
    const route = resolveRoute({ view: state.view, payload: state.routePayload });
    if (route.rerouted) {
      state.view = route.view;
      state.routePayload = route.payload;
      history.replaceState(null, '', routeUrl(route.view, route.payload));
      persist();
      render();
      toast(backend.note);
    } else if (!demoActive && (state.view === 'space' || state.view === 'records')) {
      render();
    }
  };
  const open = document.querySelector('dialog[open]');
  if (open) open.addEventListener('close', repaint, { once: true });
  else repaint();
}

/** A served page believes in its room server at once; this only checks, twice, before it gives the rooms up. */
async function confirmRooms() {
  if (await askHealth()) return;
  await new Promise(resolve => setTimeout(resolve, 1500)); // a restarting server is not a missing one
  if (!(await askHealth())) adoptBackend(false);
}

// Keep window scrolling and focus navigation native; only replace its chrome.
OverlayScrollbars(document.body, {
  overflow: { x: 'hidden', y: 'scroll' },
  scrollbars: { theme: 'os-theme-music', autoHide: 'scroll', autoHideDelay: 650, dragScroll: true, clickScroll: false },
});
// Dev only, where the proxy can answer: the probe runs while the shell and the courtyard build.
const answer = detection === 'probe' ? askHealth().then(adoptBackend) : null;
// The courtyard opens on the shot of the page that will actually be shown; only the dev probe has to guess.
state.view = detection === 'probe' ? routeFromLocation().view : resolveRoute(routeFromLocation()).view;
shell();
themeController = mountThemes({ onAction: onSpatialAction, view: state.view,
  onShot(key, id, travelling) { document.body.dataset.spatialShot = key; document.body.toggleAttribute('data-spatial-travelling', travelling); },
});
motion = mountMotion();
if (answer) {
  // The allowance starts after the courtyard is built: a busy phone must not lose the race to its own main thread.
  // An invite link or #/live is worth a longer wait; the home page settles for 1.5 s and adopts a late answer.
  const allowance = routeFromLocation().view === 'live' ? 8000 : 1500;
  Promise.race([answer, new Promise(resolve => setTimeout(resolve, allowance))]).then(start);
} else {
  start();
  if (detection === 'served') confirmRooms();
}
