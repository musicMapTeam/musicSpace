/**
 * profile.demo for the static build: everything the event room asks of the demo world, assembled from the modules next to it.
 *
 *   const demo = createDemoProfile({ getWorld, eventDate, samples, loadSample, demoTime, reset, build, channel, persistent, readOnly, ready, random });
 *
 * Options are read when they are needed, not when this runs, so a value that is only known later (persistent and readOnly come from the
 * boot, the world from the seed) can be given as a function, a getter or a plain value:
 *   getWorld()   the seeded world { people: { key: { id, npc: { name } } }, room: { id, code } } (or { castIds, castNames, roomCode }) or null
 *                before it exists. Only ids, names and the room code are read; a token in it is never touched.
 *   samples      [{ id, label, note, thumbUrl }] the bundled example photos
 *   loadSample   async id => File
 *   demoTime     { ms, label, note } for the demo-only capture-time button; a missing part defaults to the product's own words / 21:47 of eventDate
 *   reset        () => Promise: wipe this browser's example data and start over (the boot owns it)
 *   ready        a Promise that resolves when the world is seeded (it rejects in safe mode)
 *   build, channel, persistent, readOnly   shown by the About panel
 *
 * The returned object is the DemoProfile of the design (section 10.2): mode, roomCode, eventDate, isCast, castLabel, samples, loadSample,
 * demoTime, entryMarkup, enter, roomInviteMarkup, aboutMarkup, reset, createTour, onWorldChanged, notifyChanged; plus
 *   defaultName, defaultAvatar   the nickname (访客 + digits) and the random look the entry form starts with, fixed for this page load
 *   entryDefaults(state)         { name, avatar, preparing, castNames } for entryMarkup; a saved profile draft wins over the random look
 *   isReady()                    false until `ready` resolved
 *   castNames()                  the cast's display names, for the entry form and About
 *   syncEntry(root)              patches an open entry form in place (submit button, status line) once the world is ready, so what the
 *                                visitor already typed survives; returns false when no entry form is inside `root`
 * None of the methods needs `this` (notifyChanged may be handed to the autopilot as it is). When `ready` resolves, notifyChanged() fires
 * once, so a page that registered with onWorldChanged can re-render whatever was waiting for the world.
 */
import { SKINS, TEMPLATES, safeAvatar } from '../../avatar/model.js';
import { venueTime } from '../../js/moment.js';
import { CAST_LABEL, DEMO_TIME_COPY } from './copy.js';
import { entryMarkup, enter } from './entry-panel.js';
import { aboutMarkup, roomInviteMarkup } from './about-panel.js';
import { createTour } from './tour.js';

const pick = (list, random) => list[Math.min(list.length - 1, Math.floor(random() * list.length))];

/** One of the product's own looks (TEMPLATES) with a random skin tone: always a valid v2 avatar. */
export function randomAvatar(random = Math.random) {
  return safeAvatar({ ...pick(TEMPLATES, random).avatar, skin: Math.min(SKINS.length - 1, Math.floor(random() * SKINS.length)) });
}

/** 访客 + four digits: well inside the 18-character nickname limit. */
export const randomName = (random = Math.random) => `访客${1000 + Math.floor(random() * 9000)}`;

/** 21:47 on the event day, Asia/Shanghai: the moment of the cast's three same-night photos. */
function eventNight(eventDate) {
  const day = String(eventDate || '').match(/^(\d{4})[-./](\d{1,2})[-./](\d{1,2})/);
  return day ? venueTime(+day[1], +day[2], +day[3], 21, 47) : venueTime(2026, 9, 26, 21, 47);
}

const defined = object => Object.fromEntries(Object.entries(object || {}).filter(([, value]) => value !== undefined));

export function createDemoProfile(options = {}) {
  const read = name => { const value = options[name]; return typeof value === 'function' ? value() : value; };
  const random = typeof options.random === 'function' ? options.random : Math.random;
  const defaultName = randomName(random);
  const defaultAvatar = randomAvatar(random);
  const eventDate = options.eventDate || '2026.09.26';

  const listeners = new Set();
  const notifyChanged = () => { for (const listener of [...listeners]) { try { listener(); } catch { /* a refresh that failed must not stop the others */ } } };
  const onWorldChanged = listener => {
    if (typeof listener !== 'function') return () => {};
    listeners.add(listener);
    return () => listeners.delete(listener);
  };

  let ready = options.ready == null;
  const whenReady = () => Promise.resolve(typeof options.ready === 'function' ? options.ready() : options.ready);
  if (!ready) Promise.resolve().then(whenReady).then(() => { ready = true; notifyChanged(); }, () => notifyChanged());

  // The world is what ensureShowcase returns ({ people: { key: { id, npc: { name } } }, room: { code } }); a plainer { castIds, castNames,
  // roomCode } is read too, so the boot may hand over a copy without the tokens. Only ids, names and the code are ever read.
  const world = () => read('getWorld') || {};
  const people = () => { const raw = world().people; return Array.isArray(raw) ? raw : Object.values(raw || {}); };
  const words = list => (Array.isArray(list) ? list : []).filter(name => typeof name === 'string' && name);
  const roomCode = () => world().room?.code ?? world().roomCode ?? null;
  const castNames = () => { const names = words(people().map(person => person?.npc?.name ?? person?.name)); return names.length ? names : words(world().castNames); };
  const isCast = id => Boolean(id) && (people().some(person => person?.id === id) || (Array.isArray(world().castIds) && world().castIds.includes(id)));

  function entryDefaults(state = {}) {
    const draft = state?.drafts?.profile;
    return { name: draft?.name || defaultName, avatar: draft?.avatar || defaultAvatar, preparing: !ready, castNames: castNames() };
  }

  return {
    mode: 'static',
    eventDate,
    get samples() { return read('samples') || []; },
    loadSample: id => options.loadSample(id),
    get demoTime() {
      const given = read('demoTime') || {};
      return { ms: Number.isFinite(given.ms) ? given.ms : eventNight(eventDate), label: given.label || DEMO_TIME_COPY.label, note: given.note || DEMO_TIME_COPY.note };
    },
    defaultName,
    defaultAvatar,
    entryDefaults,
    isReady: () => ready,
    roomCode,
    isCast,
    castNames,
    castLabel: member => (isCast(member?.id) ? CAST_LABEL : ''),
    syncEntry(root) {
      const form = root?.querySelector?.("form[data-form='demo-entry']");
      if (!form) return false;
      const submit = form.querySelector("button[type='submit']");
      const status = form.querySelector('.demo-entry-status');
      if (submit) submit.disabled = !ready;
      if (status) status.textContent = ready ? '' : '正在布置示例现场…';
      return true;
    },
    entryMarkup: ({ state, esc, avatarSvg, defaults } = {}) => entryMarkup({ state, esc, avatarSvg, defaults: { ...entryDefaults(state), ...defined(defaults) } }),
    enter: (values, controller) => enter(values, controller, { ready: whenReady, roomCode }),
    roomInviteMarkup: room => roomInviteMarkup({ isShowcase: Boolean(room?.code) && room.code === roomCode() }),
    aboutMarkup: (extra = {}) => aboutMarkup({ build: read('build'), castNames: castNames(), persistent: read('persistent') !== false, channel: read('channel') || '', readOnly: Boolean(read('readOnly')), ...defined(extra) }),
    reset: () => {
      if (typeof options.reset !== 'function') throw new Error('这个示例现在不能重置。');
      return options.reset();
    },
    createTour: tourOptions => {
      const tour = createTour({ samples: read('samples'), ...defined(tourOptions) });
      return { ...tour, update: view => tour.update({ ...view, readOnly: Boolean(read('readOnly')) }) };
    },
    onWorldChanged,
    notifyChanged,
  };
}
