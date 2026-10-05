/**
 * The four-step 「示例路线」 card of the static build: a slim card above .presence that says what to do next and finishes itself.
 *
 *   const tour = createTour({ container, esc, onAction, samples?, storage? });
 *   tour.update(view);   // from renderState, as often as you like (it only touches the DOM when the card changes)
 *   tour.dispose();
 *
 * container   an element the caller dedicates to the card (put it as the FIRST child of .presence; demo.css lays it out there; a host that
 *             sits just before .presence is moved in). The tour makes it the live region (class demo-tour, role=region,
 *             aria-live=polite) and replaces its content.
 * onAction    (action, { kind, id }) for a click on a card button. `action` is the button's data-tour-action: 'open:upload' | 'open:wall' |
 *             'open:people' | 'open:recap' | 'sample:<sample id>', or 'skip' for 「跳过路线」. Opening a panel and loading a sample are
 *             the caller's work; the tour only reports.
 * samples     [{ id, label }] the sample buttons of step 1, the first one primary (default: the crowd photo, then the stage photo).
 * storage     where the card remembers skip/collapse (default localStorage under 'music-space-tour:v1', a purge-listed key).
 *
 * view = { stage: 'lobby' | 'room', ownPhotos, hasPairing, exchanges: { total }, friends, openedRecap, panel, readOnly? }
 * Completion comes from the view (see tourProgress): the card shows the first step that is not done and, when all four are, the
 * closing card. It is hidden in the lobby, in a read-only tab, while a panel is open (the panel covers it) and after 「跳过路线」.
 *
 * No AI words on the card: they may only be said while the browser can run the model, and the card does not know that.
 */
import { escape } from '../../avatar/model.js';
import { TOUR_SAMPLES, TOUR_MORE } from './copy.js';

export const TOUR_STORAGE_KEY = 'music-space-tour:v1';

export const TOUR_STEPS = Object.freeze([
  Object.freeze({ id: 'photo', title: '放一张你的照片', hint: '选一张示例照片最快；也可以用你自己的照片。' }),
  Object.freeze({ id: 'other-side', title: '看「同一刻的另一面」', hint: '照片墙会标出和你同一刻、拍到另一面的那张。没看到的话，给照片选好视角并确认拍摄时间，或者换一张示例照片。', action: ['open:wall', '去照片墙看看'] }),
  Object.freeze({ id: 'exchange', title: '发起交换', hint: '点「和 TA 交换这个视角」，勾选同意再发出；对方接受后，两张照片互相可见。', action: ['open:wall', '回到照片墙'] }),
  Object.freeze({ id: 'people', title: '招个手 / 私聊 / 回看这一晚', hint: '向同场的示例角色招手，对方接受后可以私聊；散场后还能回看这一晚。', action: ['open:people', '看看同场的人'], extra: ['open:recap', '回看这一晚'] }),
]);

const positive = value => Number(value) > 0;

/**
 * Which steps are done, which one is current and whether the card shows at all.
 *   1 放一张你的照片        done when the visitor has a photo of their own on the wall
 *   2 看「同一刻的另一面」  done when that photo has a same-moment partner AND the wall was seen, or when an exchange already exists
 *   3 发起交换              done when any exchange exists
 *   4 招个手 / 私聊 / 回看  done when the visitor has a friend or opened the recap
 * `flags.seenWall` is the tour's own memory of having seen the wall with a pairing on it.
 */
export function tourProgress(view = {}, flags = {}) {
  const photo = positive(view.ownPhotos);
  const exchange = positive(view.exchanges?.total);
  const seen = Boolean(flags.seenWall) || view.panel === 'wall';
  const done = [photo, photo && (exchange || (Boolean(view.hasPairing) && seen)), exchange, positive(view.friends) || Boolean(view.openedRecap)];
  const first = done.indexOf(false);
  return {
    done,
    current: first < 0 ? null : first,
    complete: first < 0,
    visible: view.stage === 'room' && !view.readOnly && !flags.skipped && !view.panel,
  };
}

/** The content of the card (the container itself carries the region attributes). '' when the card is hidden. */
export function tourMarkup({ progress, collapsed = false, esc = escape, samples = TOUR_SAMPLES } = {}) {
  if (!progress?.visible) return '';
  const total = TOUR_STEPS.length;
  const step = progress.complete ? null : TOUR_STEPS[progress.current];
  const label = collapsed ? '展开' : '收起';
  const bar = `<span class="demo-tour-bar" aria-hidden="true">${progress.done.map(done => `<i${done ? ' class="on"' : ''}></i>`).join('')}</span>`;
  const head = `<div class="demo-tour-head"><p class="demo-tour-title"><strong>示例路线 ${progress.complete ? total : progress.current + 1}/${total}</strong> · ${step ? step.title : '路线走完了'}</p>`
    + `<button type="button" class="demo-tour-toggle" data-tour-toggle aria-expanded="${!collapsed}" aria-label="${label}示例路线">${label}</button></div>${bar}`;
  if (collapsed) return head;
  const button = (action, text, primary) => `<button type="button" class="demo-tour-action ${primary ? 'primary' : 'quiet'}" data-tour-action="${esc(action)}">${esc(text)}</button>`;
  let actions;
  if (!step) actions = '';
  else if (step.id === 'photo') actions = (Array.isArray(samples) ? samples : []).map((sample, index) => button(`sample:${sample.id}`, sample.label, index === 0)).join('') + button('open:upload', '用我自己的照片', false);
  else actions = button(step.action[0], step.action[1], true) + (step.extra ? button(step.extra[0], step.extra[1], false) : '');
  const hint = step ? step.hint : `更多可以逛：${TOUR_MORE.join('、')}。`;
  const skip = step ? '<button type="button" class="demo-tour-skip quiet" data-tour-skip>跳过路线</button>' : '<button type="button" class="demo-tour-skip primary" data-tour-skip>知道了，收起路线</button>';
  return `${head}<p class="demo-tour-hint">${hint}</p><div class="demo-tour-actions">${actions}${skip}</div>`;
}

const CONTROLS = '[data-tour-action],[data-tour-skip],[data-tour-toggle]';

export function createTour({ container, esc = escape, onAction, samples, storage } = {}) {
  if (!container) return { update: () => ({ visible: false, step: null, complete: false, done: [] }), dispose() {} };
  const store = () => { try { return storage ?? globalThis.localStorage ?? null; } catch { return null; } };
  const state = { skipped: false, collapsed: false, seenWall: false };
  try {
    const saved = JSON.parse(store()?.getItem(TOUR_STORAGE_KEY) || 'null');
    for (const key of Object.keys(state)) state[key] = saved?.[key] === true;
  } catch { /* unreadable or unavailable storage: the card still works, it just forgets */ }
  const save = () => { try { store()?.setItem(TOUR_STORAGE_KEY, JSON.stringify({ v: 1, ...state })); } catch { /* quota or blocked: in-memory only */ } };

  // A host placed just before .presence (a natural reading of 「above .presence」) moves in as its first child, where demo.css lays it out.
  const presence = container.nextElementSibling;
  if (presence?.classList?.contains('presence') && presence.firstChild !== container) presence.prepend(container);

  container.classList?.add('demo-tour');
  container.setAttribute?.('role', 'region');
  container.setAttribute?.('aria-live', 'polite');
  container.setAttribute?.('aria-label', '示例路线');

  let view = {};
  let shown = null;
  let live = true;

  function render() {
    const progress = tourProgress(view, state);
    const html = tourMarkup({ progress, collapsed: state.collapsed, esc, samples });
    container.hidden = !progress.visible;
    // The expanded card takes the place of the presence's own text and buttons on phones (demo.css); a class on the parent says so
    // without needing :has(), which some WeChat WebViews do not know yet.
    container.parentElement?.classList?.toggle('demo-tour-open', progress.visible && !state.collapsed);
    if (html !== shown) { container.innerHTML = html; shown = html; }
    return { visible: progress.visible, step: progress.complete ? null : progress.current + 1, complete: progress.complete, done: progress.done };
  }

  function onClick(event) {
    const hit = event?.target?.closest?.(CONTROLS);
    if (!hit || !live) return;
    const { tourAction, tourSkip, tourToggle } = hit.dataset || {};
    if (tourToggle !== undefined) { state.collapsed = !state.collapsed; save(); render(); return; }
    if (tourSkip !== undefined) { state.skipped = true; save(); render(); onAction?.('skip', { kind: 'skip', id: '' }); return; }
    if (typeof tourAction === 'string' && tourAction) {
      const cut = tourAction.indexOf(':');
      onAction?.(tourAction, { kind: cut < 0 ? tourAction : tourAction.slice(0, cut), id: cut < 0 ? '' : tourAction.slice(cut + 1) });
    }
  }
  container.addEventListener?.('click', onClick);

  return {
    update(next) {
      if (!live) return { visible: false, step: null, complete: false, done: [] };
      view = next || {};
      if (view.panel === 'wall' && view.hasPairing && positive(view.ownPhotos) && !state.seenWall) { state.seenWall = true; save(); }
      return render();
    },
    dispose() {
      if (!live) return;
      live = false;
      container.removeEventListener?.('click', onClick);
      container.parentElement?.classList?.remove('demo-tour-open');
      container.hidden = true;
      container.innerHTML = '';
    },
  };
}
