import { escape as defaultEscape } from '../avatar/model.js';
import {
  AI_NOTE, AI_NOTE_ROOM, AI_OFF_LINES, AI_THINKING, SUGGESTED_DESCRIPTION,
  aiAvailable, aiState, answerView, identifyViewpoint, loadingMarkup, moveLoading, paintAiLine, readPhotoTime, revealMessage,
  timeProblem, timeView, viewpointHint, warmUpViewpointAI,
} from '../js/photo-insight.js';
import { TAKEN_MIN, VIEWPOINTS, formatTaken, fromInputValue, onEventDay, takenFields, takenMax, toInputValue, validTakenAt } from '../js/moment.js';

/**
 * The event room's photo upload form: pick a photo (the person's own, or a bundled example), read WHEN it was taken from the original file,
 * let an on-device model SUGGEST which side of the night it shows, and keep the person's final choice. One module renders the whole form
 * and drives it; app.js only wires it in (see the contract below).
 *
 * What is true here, and said so on screen:
 *   - the AI only suggests a viewpoint (舞台 / 人海 / 身边 / 细节) and may say 「不确定」; whatever the person chooses is theirs, and saving
 *     never waits for the model; an answer that arrives after a choice, or after the save, is dropped;
 *   - the capture time comes from the photo's own EXIF (read from the ORIGINAL file, before the browser re-encodes it) or from what the
 *     person types; a file's modification time is only a guess shown as a guess and never sent unless the person edits it;
 *   - pairing, grouping and reasons are rules (web/js/moment.js), not AI, and nothing here pairs anything;
 *   - AI wording appears only while this browser can actually run the model (aiAvailable()); otherwise one sentence says why the side is
 *     the person's to choose.
 *
 * Contract (T9b wires it; every callback is optional and may throw: the module never lets a callback break the form)
 *   createMomentUpload({
 *     getRoomId,        () => the open room's id ('' when none)
 *     eventDate,        '2026.09.26' (or '' / a function returning it): times on that day print as 21:47
 *     uploadsToServer,  true in the Node product (the photo is sent to the room service on save), false on the static site
 *     samples,          [{ id, label, note, thumbUrl }] bundled example photos ([] = no sample list, the Node product)
 *     loadSample,       async id => File (a JPEG that carries its own, fictional, EXIF time)
 *     demoTime,         null | { ms, label, note }: a labelled, reversible "set the time to the example night" button for the person's own photo
 *     onDraft,          ({ roomId, dataUrl, facts, visibility }) the photo is ready: store it as the draft (visibility is 'members' for an
 *                       example, 'private' for the person's own file) and draw the form again from markup()
 *     onChange,         () the form changed on its own (an answer, a press, a typed time): re-sync the page's copy of the panel markup. The module has
 *                       already patched the container it was bound to; calling patch(container) again is harmless. restore() and reset() are
 *                       the page's own calls and do not call it
 *     onBusy,           (boolean) a model download / inference is running for the current photo (the page may calm its animation)
 *     onError,          (Error) the photo could not be used (never called for a model that did not answer)
 *   }) -> { markup, bind, patch, facts, restore, reset, pick, pickSample, warmUp, requiresViewpoint, nudge }
 *
 * What the page does with it:
 *   markup({ draft, roomId, esc, heading = true })   the whole panel: eyebrow, h2 and the form (heading: false = the form alone)
 *   bind(body) once                                  delegated click / change / input / keydown listeners; returns the function that removes them
 *   restore(facts) then markup()                     when the panel opens from a draft that came back (a reload, a retry)
 *   facts()                                          at save: { takenAt, takenSource, viewpoint, viewpointSource }, only keys that have a value
 *   requiresViewpoint() / nudge(body)                a saved example without a side gets no 「同一刻的另一面」: block the save and say so
 *   reset()                                          after the save succeeded (forgets the photo and drops any model answer still on its way)
 *   warmUp()                                         after the visitor has joined, before an example is loaded
 *
 * markup() is a pure function of the module's state plus its arguments, and patch(container) leaves the dynamic parts of the DOM (AI line,
 * chips, time rows, hints, example marks) exactly as markup() would render them, in place and without moving focus. The photo, the submit
 * button and the visibility select follow the draft, which the page draws again when it changes.
 */

const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_FILE_BYTES = 20 * 1024 * 1024;
const MAX_URL_LENGTH = 390000;                 // the room service takes a JPEG of about 300 KB; a data: URL is a third longer
const DRAFT_URL_LIMIT = 410 * 1024;

/** A draft photo that may be shown and saved: a JPEG data: URL of bounded size and nothing else (a corrupt stored draft cannot inject markup). */
export const validDraftImage = value => typeof value === 'string' && value.length < DRAFT_URL_LIMIT && /^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(value);

function checkPhotoFile(file) {
  if (!file || typeof file.size !== 'number') throw new Error('请选择 JPG、PNG 或 WebP 照片');
  if (file.size > MAX_FILE_BYTES) throw new Error('请选择 20 MB 以内的照片');
  if (!PHOTO_TYPES.includes(file.type)) throw new Error('请选择 JPG、PNG 或 WebP 照片');
}

/**
 * Redraw a photo as a JPEG data: URL of at most 1600 px (the browser drops EXIF and location on the way), and make it fit the room service:
 * the quality falls from .82 and the picture shrinks by a fifth per try, six tries at most. Reads nothing from the page except
 * document.createElement('canvas'), so it runs under a fake document too.
 */
export async function preparePhoto(file) {
  checkPhotoFile(file);
  const image = await createImageBitmap(file);
  try {
    let scale = Math.min(1, 1600 / Math.max(image.width, image.height));
    let url = '';
    for (let n = 0; n < 6; n++) {
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(image.width * scale));
      canvas.height = Math.max(1, Math.round(image.height * scale));
      canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
      url = canvas.toDataURL('image/jpeg', .82 - n * .055);
      if (url.length < MAX_URL_LENGTH) break;
      scale *= .8;
    }
    if (url.length >= MAX_URL_LENGTH) throw new Error('这张照片太复杂，请裁剪后再试');
    if (!validDraftImage(url)) throw new Error('这张照片没能处理，请换一张再试');
    return url;
  } finally { image.close?.(); }
}

// ---- words ------------------------------------------------------------------------------------------------------------------
const EYEBROW = '留一个现场瞬间';
const TITLE = '这一张，由你决定给谁看。';
const SAMPLES_TITLE = '没有现场照片？用示例照片试试';
const SAMPLE_NOTE_FALLBACK = '时间为虚构';
const WORKING = Object.freeze({ photo: '正在处理照片…', sample: '正在载入示例照片…' });
const DEMO_NOTE = '你填写的时间 · 演示用';
const DEMO_LABEL = '演示用：把拍摄时间设成示例现场的时间';
const NUDGE_WITH_AI = '先选一个视角（AI 还在判断时也可以自己选）。没有视角，就找不到同一刻的另一面。';
const NUDGE_PLAIN = '先选一个视角。没有视角，就找不到同一刻的另一面。';
const FINE_STATIC = '照片会缩小并去除位置信息，只保存在这个浏览器里；选择分享后，示例现场里的成员（自动回复的示例角色）可以看到。';
const FINE_SERVER = '保存时照片会上传至受权限保护的房间服务。会缩小并去除位置信息；选择分享后，本场已加入成员可以浏览。';
const VISIBILITY = Object.freeze([['private', '仅自己保存'], ['members', '分享给本场成员']]);
const VISIBILITY_VALUES = VISIBILITY.map(([value]) => value);

/** Everything the module knows about the photo on screen. One of these per photo; a new photo, a reset or a room change starts a new one. */
function freshState() {
  return {
    kind: '',                                      // '' nothing yet | 'own' | 'sample' | 'restored' (a saved draft that came back)
    roomId: '',
    sampleId: '',
    base: { at: null, source: null, zone: '' },    // what the photo itself said: source 'exif' (trusted), 'file' (a guess) or null
    typed: null,                                   // what the person typed in the time field (null = nothing typed; '' = cleared)
    demo: false,                                   // the demo-only time is laid over the photo's own
    edit: false,                                   // the time field is open
    view: { value: '', from: '' },                 // the chosen side, and who chose it: '' | 'ai' (pre-selected, untouched) | 'user'
    answer: { phase: 'idle' },                     // the model's last word about this photo (see identifyViewpoint)
    visibility: '',                                // set once the person touches the select ('' = still the default)
    nudged: false,
  };
}

const cls = (...names) => names.filter(Boolean).join(' ');
// photo-insight.js words the room's promise for the 0.16 live page, where what is saved is a 「现场卡」; here it is a photo. The shared sentence stays
// the one source (so a change there reaches this form); only the noun is swapped, and a sentence without it passes through unchanged.
const forPhoto = sentence => sentence.replace('保存现场卡时', '保存照片时');
const stringOr = (value, fallback = '') => (typeof value === 'string' && value ? value : fallback);

export function createMomentUpload(options = {}) {
  const { getRoomId, eventDate = '', uploadsToServer = false, loadSample = null, onDraft, onChange, onBusy, onError } = options;
  const sampleList = (Array.isArray(options.samples) ? options.samples : []).filter(item => item && typeof item.id === 'string' && item.id);
  const demo = options.demoTime && validTakenAt(options.demoTime.ms) ? options.demoTime : null;
  // The picker's own bounds, fixed when the form is made so that markup() does not change from one minute to the next.
  const inputMin = toInputValue(TAKEN_MIN);
  const inputMax = toInputValue(takenMax());

  let state = freshState();
  let working = '';                                // '' | 'photo' | 'sample': a pick that is still being read or loaded
  let pickGeneration = 0;                          // bumped by every pick and reset: a pick that is no longer the latest is dropped
  let identifyToken = 0;                           // bumped when a new model call starts or the form is reset: an older answer is dropped
  let identify = null;                             // the running model call's handle
  let busy = false;
  let bound = null;
  let unbinders = [];

  const roomOf = () => { try { return String(getRoomId?.() ?? ''); } catch { return ''; } };
  const dateOf = () => { try { return String((typeof eventDate === 'function' ? eventDate() : eventDate) ?? ''); } catch { return ''; } };
  const owns = room => state.kind !== '' && state.roomId === String(room ?? '');
  const fail = error => { try { onError?.(error instanceof Error ? error : new Error(String(error))); } catch { /* the page's handler is its own business */ } };
  const setBusy = next => { if (busy !== next) { busy = next; try { onBusy?.(next); } catch { /* same */ } } };
  const sampleById = id => sampleList.find(item => item.id === id) || null;

  // ---- what the person's time and side currently are ----------------------------------------------------------------------
  /** The time in force: the demo-only time over the typed one over what the photo said. `source` is what facts() may send. */
  function timeOf(s) {
    if (s.demo && demo) return { at: Math.round(demo.ms), source: 'manual', zone: '', demo: true };
    if (s.typed !== null) { const at = fromInputValue(s.typed); return { at, source: at === null ? null : 'manual', zone: '', demo: false }; }
    return { at: s.base.at, source: s.base.source, zone: s.base.zone, demo: false };
  }

  /** The two likeliest sides when the model is unsure: dashed, never selected for the person. */
  function suggestedOf(s) {
    if (!aiAvailable() || s.answer.phase !== 'done') return [];
    const answer = answerView(s.answer.result);
    return answer && !answer.sure && !s.view.value && s.view.from !== 'user' ? answer.suggested : [];
  }

  /** The line under the chips and the key that says what it shows (so a status region is not repainted with the words it already has). */
  function aiLineOf(s, esc) {
    if (!aiAvailable()) { const text = AI_OFF_LINES[aiState()] || ''; return text ? { key: `off:${aiState()}`, html: `<span class="moment-ai-off">${esc(text)}</span>` } : { key: '', html: '' }; }
    const { answer, view } = s;
    if (answer.phase === 'loading') return { key: 'loading', html: loadingMarkup('moment-ai-line', answer) };
    if (answer.phase === 'thinking') return { key: 'thinking', html: `<span>${esc(AI_THINKING)}</span>` };
    const result = answer.phase === 'done' ? answerView(answer.result) : null;
    if (result && view.from !== 'user') {
      if (result.sure && view.from === 'ai') {
        return { key: `sure:${result.label}`, html: `<span class="moment-ai-tag" title="${esc(uploadsToServer ? forPhoto(AI_NOTE_ROOM) : AI_NOTE)}">${esc(result.tag)}</span>` };
      }
      // The dashed chips are for the eyes; the hidden words name the two sides for everyone else (the chips point to a description too).
      if (!result.sure && !view.value) {
        return { key: `unsure:${result.suggested.join(',')}`, html: `<span class="moment-ai-tag moment-ai-tag--unsure">${esc(result.tag)}</span><span class="sr-only">${esc(result.spoken)}</span>` };
      }
    }
    return { key: '', html: '' };
  }

  // ---- the model: one call per photo, never blocking anything ------------------------------------------------------------
  function cancelIdentify() {
    identify?.cancel();
    identify = null;
    setBusy(false);
  }

  function onModel(token, answer) {
    if (token !== identifyToken || state.kind === '') return;     // an answer for a photo that is gone, or after a reset/save
    state.answer = answer;
    setBusy(answer.phase === 'thinking' || answer.phase === 'loading');
    // It may fill an empty side when it is sure; a side the person has chosen (or cleared) is never touched.
    if (answer.phase === 'done' && answer.result?.sure && !state.view.from && !state.view.value && VIEWPOINTS.some(item => item.id === answer.result.label)) {
      state.view = { value: answer.result.label, from: 'ai' };
    }
    notify();
  }

  function startIdentify(picture) {
    const token = identifyToken;
    identify = identifyViewpoint(picture, answer => onModel(token, answer));
  }

  // ---- facts --------------------------------------------------------------------------------------------------------------
  /** What may be saved with the photo: only keys that have a value. A guessed time and an unusable typed time are not facts. */
  function facts() {
    if (!owns(roomOf())) return {};
    const out = {};
    const time = timeOf(state);
    const sent = takenFields({ takenAt: time.at, takenSource: time.source });
    if (sent.takenAt !== null) { out.takenAt = sent.takenAt; out.takenSource = sent.takenSource; }
    if (VIEWPOINTS.some(item => item.id === state.view.value)) {
      out.viewpoint = state.view.value;
      out.viewpointSource = state.view.from === 'ai' ? 'ai' : 'manual';   // 'ai' = saved with the AI's pre-selection untouched
    }
    return out;
  }

  /** A saved draft came back (a reload, a retry): put its facts back. A photo that is live in this page is more accurate and stays. */
  function restore(saved) {
    if (owns(roomOf()) || !saved || typeof saved !== 'object') return false;
    const next = freshState();
    if (validTakenAt(saved.takenAt) && (saved.takenSource === 'exif' || saved.takenSource === 'manual')) {
      next.base = { at: Math.round(saved.takenAt), source: saved.takenSource, zone: '' };
    }
    if (VIEWPOINTS.some(item => item.id === saved.viewpoint)) next.view = { value: saved.viewpoint, from: saved.viewpointSource === 'ai' ? 'ai' : 'user' };
    if (next.base.at === null && !next.view.value) return false;
    next.kind = 'restored';
    next.roomId = roomOf();
    state = next;
    notify({ page: false });
    return true;
  }

  /** The photo was saved, or given up on: forget it and everything the model may still say about it. */
  function reset() {
    pickGeneration += 1;
    identifyToken += 1;
    cancelIdentify();
    working = '';
    state = freshState();
    notify({ page: false });
  }

  // ---- picking ------------------------------------------------------------------------------------------------------------
  function adopt() {
    const room = roomOf();
    if (!owns(room)) state = Object.assign(freshState(), { kind: 'own', roomId: room });
  }

  /** The photo is ready: a new photo is a new question, so its time is what the file said, its side is empty, and the model may answer. */
  function install({ found, dataUrl, sample, room }) {
    identifyToken += 1;
    cancelIdentify();
    state = freshState();
    state.kind = sample ? 'sample' : 'own';
    state.roomId = room;
    state.sampleId = sample ? sample.id : '';
    state.base = found.time ? { at: found.time.takenAt, source: 'exif', zone: found.zone || '' }
      : found.guess ? { at: found.guess.takenAt, source: 'file', zone: '' } : state.base;
    working = '';
    // The page stores the draft and draws the form again from markup(), which already says everything (no more "working", the new photo's
    // time, empty chips); the model's first word follows through onModel(). Telling the page "changed" here, before it has drawn the new
    // photo, would let it file the new markup as drawn while the old form is still on screen.
    try { onDraft?.({ roomId: room, dataUrl, facts: facts(), visibility: sample ? 'members' : 'private' }); } catch (error) { fail(error); }
    startIdentify(dataUrl);
    revealView();
  }

  /** On a short screen the chips and the model's line lie below the photo: bring them into view (a no-op when they already are). */
  function revealView() {
    try { bound?.querySelector?.('.moment-view')?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' }); } catch { /* no layout to scroll */ }
  }

  async function run(file, generation, sample) {
    const room = roomOf();
    const current = () => generation === pickGeneration;
    const settle = () => { if (current() && working) { working = ''; notify(); } };
    if (current()) { working = sample ? 'sample' : 'photo'; notify(); }
    try {
      checkPhotoFile(file);
      // The capture time is read from the ORIGINAL file: re-encoding it (below) drops every EXIF tag.
      const found = await readPhotoTime(file);
      if (!current()) return false;
      const dataUrl = await preparePhoto(file);
      if (!current() || room !== roomOf()) { settle(); return false; }
      install({ found, dataUrl, sample, room });
      return true;
    } catch (error) {
      if (current()) { settle(); fail(error); }
      return false;
    }
  }

  /** Use one of the person's own files. Resolves true when the photo is ready, false when it was dropped or could not be used. */
  function pick(file) {
    if (!file) return Promise.resolve(false);
    pickGeneration += 1;
    return run(file, pickGeneration, null);
  }

  /** Use a bundled example photo: its file carries a fictional capture time like any other photo's EXIF. */
  async function pickSample(id) {
    const sample = sampleById(id);
    if (!sample || typeof loadSample !== 'function') { fail(new Error('找不到这张示例照片')); return false; }
    pickGeneration += 1;
    const generation = pickGeneration;
    working = 'sample';
    notify();
    try {
      let file = await loadSample(sample.id);
      if (generation !== pickGeneration) return false;
      // The examples are our own JPEGs: a file that arrives without a type (a blob from a host that sent none) is still one.
      if (file && !file.type && typeof File === 'function') file = new File([file], stringOr(file.name, `${sample.id}.jpg`), { type: 'image/jpeg', lastModified: file.lastModified });
      return await run(file, generation, sample);
    } catch (error) {
      if (generation === pickGeneration) { working = ''; notify(); fail(error); }
      return false;
    }
  }

  function warmUp() {
    warmUpViewpointAI(() => notify());
  }

  // ---- what the person does -----------------------------------------------------------------------------------------------
  function choose(id) {
    if (!VIEWPOINTS.some(item => item.id === id)) return;
    adopt();
    state.view = { value: id, from: 'user' };      // any chip press is the person's own choice, even the one the model had pre-selected
    state.nudged = false;
    notify();
  }

  function typeTime(value) {
    adopt();
    state.typed = String(value ?? '');             // whatever the person types replaces a read or guessed time; empty or impossible = no time
    state.demo = false;
    state.edit = true;
    notify();
  }

  function openTimeField() {
    adopt();
    state.edit = true;
    notify();
    try { bound?.querySelector?.('input[name="takenAt"]')?.focus?.(); } catch { /* nothing to focus */ }
  }

  function toggleDemo() {
    if (!demo) return;
    adopt();
    state.demo = !state.demo;
    notify();
  }

  function requiresViewpoint() {
    return state.kind === 'sample' && state.roomId === roomOf() && !state.view.value;
  }

  /** A sample without a side would get no 「同一刻的另一面」: say so where the chips are, and bring the person there. */
  function nudge(container) {
    if (!owns(roomOf())) return false;
    state.nudged = true;
    const root = container || bound;
    patch(root);
    try { onChange?.(); } catch { /* same */ }
    try { root?.querySelector?.('[data-moment-viewpoint]')?.focus?.({ preventScroll: true }); } catch { /* no DOM */ }
    try { const message = root?.querySelector?.('[data-viewpoint-nudge]'); if (message) revealMessage(message); } catch { /* no DOM */ }
    return true;
  }

  /**
   * The state changed: bring the form in the bound container up to date and tell the page (it re-syncs its copy of the panel markup).
   * restore() and reset() pass { page: false }: the page calls them itself and draws the form right after, and a "changed" sent while
   * it is still working out what to draw could make it file markup as drawn that is not on screen yet.
   */
  function notify({ page = true } = {}) {
    try { if (bound) patch(bound); } catch { /* the form is only a view */ }
    if (page) { try { onChange?.(); } catch { /* same */ } }
  }

  // ---- the view: one description of the dynamic parts, drawn by markup() and applied by patch() ------------------------------
  function model(room, live, esc) {
    const s = live && owns(room) ? state : freshState();
    const time = timeOf(s);
    const view = timeView({ takenAt: time.at, takenSource: time.source }, dateOf(), { zone: time.zone });
    const known = view.mode === 'known';
    const open = !known || s.edit;
    // Something typed that cannot be used (before 2000, after tomorrow) is said next to the field, not dropped in silence.
    const problem = s.typed !== null && !s.demo ? timeProblem(s.typed) : '';
    const date = dateOf();
    const off = Boolean(demo && date && known && time.at !== null && !time.demo && !onEventDay(time.at, date));
    const hints = suggestedOf(s);
    const nudged = s.nudged && !s.view.value;
    const line = aiLineOf(s, esc);
    return {
      s,
      status: WORKING[working] || '',
      taken: {
        line: problem ? '暂无可用的拍摄时间' : view.line,
        note: known ? `· ${time.demo ? stringOr(demo?.note, DEMO_NOTE) : view.note}` : '',
        editHidden: !(known && view.editable && !s.edit),
        open,
        label: view.mode === 'guess' ? '大约的时间 · 北京时间' : known ? '修改拍摄时间 · 北京时间' : '拍摄时间 · 北京时间',
        hint: known ? '改过的时间以你填的为准。' : view.note,
        value: time.demo ? toInputValue(time.at) : s.typed !== null ? s.typed : time.at === null ? '' : toInputValue(time.at),
        problem,
        offNight: off ? `这个时间不在示例现场那一晚（${date}），按规则不算同一刻。` : '',
        demoShown: Boolean(demo) && s.kind !== 'sample',
        demoOn: time.demo,
        demoText: time.demo ? `已把拍摄时间设成 ${formatTaken(time.at, date)}（演示用）· 再按一次撤销` : stringOr(demo?.label, DEMO_LABEL),
      },
      chips: VIEWPOINTS.map(item => {
        const pressed = s.view.value === item.id;
        return { id: item.id, name: item.name, detail: item.detail, pressed, ai: pressed && s.view.from === 'ai', suggested: !pressed && hints.includes(item.id), nudged };
      }),
      likely: hints.length > 0,
      aiKey: line.key,
      aiHtml: line.html,
      aiLoading: s.answer,
      hint: forPhoto(viewpointHint({ upload: uploadsToServer })),
      nudge: nudged ? (aiAvailable() ? NUDGE_WITH_AI : NUDGE_PLAIN) : '',
      sampleId: s.kind === 'sample' ? s.sampleId : '',
    };
  }

  const chipMarkup = (chip, esc) => `<button type="button" class="${cls('moment-chip', chip.pressed && 'is-selected', chip.ai && 'is-ai', chip.suggested && 'is-suggested', chip.nudged && 'is-nudged')}" data-moment-viewpoint="${chip.id}" aria-pressed="${chip.pressed}"${chip.suggested ? ' aria-describedby="moment-viewpoint-likely"' : ''}><b>${esc(chip.name)}</b><small>${esc(chip.detail)}</small></button>`;
  const likelyMarkup = esc => `<span class="sr-only" id="moment-viewpoint-likely">${esc(SUGGESTED_DESCRIPTION)}</span>`;

  function sampleMarkup(sample, current, esc) {
    const thumb = stringOr(sample.thumbUrl);
    const note = stringOr(sample.note);
    return `<button type="button" class="${cls('moment-sample', current && 'is-current')}" data-sample-photo="${esc(sample.id)}" aria-pressed="${current}"><span class="moment-sample__thumb">${thumb ? `<img src="${esc(thumb)}" alt="" width="72" height="54" loading="lazy" decoding="async">` : ''}</span><span class="moment-sample__text"><b>${esc(stringOr(sample.label, sample.id))}</b>${note ? `<small>${esc(note)}</small>` : ''}</span></button>`;
  }

  /**
   * The photo and when it was taken, one card: the picture, its time (and the way to change it), what it is if it is an example, the time field.
   * It is always in the page and shut (hidden) until there is a photo to talk about; the picture itself exists only for a valid draft.
   */
  function takenMarkup(taken, esc, { photo, flag }) {
    return `<div class="moment-taken" data-taken${photo ? '' : ' hidden'}>`
      + (photo ? `<img class="photo-review" src="${esc(photo.dataUrl)}" alt="${uploadsToServer ? '本次待上传的照片' : '待保存的照片'}">` : '')
      + `<div class="moment-taken__row"><p class="moment-taken__line" role="status" aria-live="polite"><span data-taken-line>${esc(taken.line)}</span> <small data-taken-note>${esc(taken.note)}</small></p>`
      + `<button type="button" class="moment-taken__edit" data-taken-edit aria-controls="moment-taken-field" aria-expanded="${taken.open}"${taken.editHidden ? ' hidden' : ''}>修改时间</button></div>`
      + flag
      + `<div class="moment-taken__field" id="moment-taken-field" data-taken-field${taken.open ? '' : ' hidden'}>`
      + `<label><span data-taken-label>${esc(taken.label)}</span><input type="datetime-local" name="takenAt" min="${inputMin}" max="${inputMax}" step="60" value="${esc(taken.value)}"${taken.problem ? ' aria-invalid="true" aria-describedby="moment-taken-error"' : ''}></label>`
      + `<p class="fine" data-taken-hint>${esc(taken.hint)}</p>`
      + `<p class="fine moment-taken__error" id="moment-taken-error" role="alert" data-taken-error${taken.problem ? '' : ' hidden'}>${esc(taken.problem)}</p></div>`
      + `<p class="fine moment-taken__off" data-taken-off>${esc(taken.offNight)}</p>`
      + (taken.demoShown ? `<button type="button" class="moment-demo" data-demo-time aria-pressed="${taken.demoOn}">${esc(taken.demoText)}</button>` : '')
      + '</div>';
  }

  function viewMarkup(m, esc, shut) {
    return `<fieldset class="moment-view"${shut ? ' hidden' : ''}><legend>我拍的这一面</legend>`
      + `<div class="moment-chips">${m.chips.map(chip => chipMarkup(chip, esc)).join('')}</div>${m.likely ? likelyMarkup(esc) : ''}`
      + `<p class="moment-nudge" role="alert" data-viewpoint-nudge>${esc(m.nudge)}</p>`
      + `<div class="moment-ai-line" data-ai-line data-ai-key="${esc(m.aiKey)}" role="status" aria-live="polite">${m.aiHtml}</div>`
      + `<p class="fine" data-viewpoint-hint>${esc(m.hint)}</p></fieldset>`;
  }

  function markup({ draft = null, roomId = '', esc: escapeWith = defaultEscape, heading = true } = {}) {
    const esc = typeof escapeWith === 'function' ? escapeWith : defaultEscape;
    const room = String(roomId ?? '');
    const photo = draft && String(draft.roomId ?? '') === room && validDraftImage(draft.dataUrl) ? draft : null;
    const m = model(room, Boolean(photo), esc);
    const sample = m.s.kind === 'sample' ? sampleById(m.s.sampleId) : null;
    const visibility = m.s.visibility || (sample ? 'members' : VISIBILITY_VALUES.includes(photo?.visibility) ? photo.visibility : 'private');
    const select = `<select name="visibility">${VISIBILITY.map(([value, label]) => `<option value="${value}" ${value === visibility ? 'selected' : ''}>${esc(label)}</option>`).join('')}</select>`;
    const samples = sampleList.length
      ? `<div class="moment-samples" role="group" aria-labelledby="moment-samples-title"><p class="moment-samples__title" id="moment-samples-title">${esc(SAMPLES_TITLE)}</p><div class="moment-samples__list">${sampleList.map(item => sampleMarkup(item, m.sampleId === item.id, esc)).join('')}</div></div>`
      : '';
    const flag = sample ? `<p class="moment-sample-flag" data-sample-flag>示例照片 · ${esc(stringOr(sample.note, SAMPLE_NOTE_FALLBACK))}</p>` : '';
    return `${heading ? `<small class="eyebrow">${EYEBROW}</small><h2>${TITLE}</h2>` : ''}`
      + `<form class="${photo ? 'moment-upload has-photo' : 'moment-upload'}" data-form="upload" data-room="${esc(room)}" novalidate>`
      + `<label class="file-choice"><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M4 5h16v15H4zM4 16l5-5 4 4 3-3 4 4M8 8h.1"/></svg>选照片<input type="file" name="photo" accept="image/jpeg,image/png,image/webp"></label>${samples}`
      + `<p class="moment-status" data-pick-status role="status" aria-live="polite">${esc(m.status)}</p>${takenMarkup(m.taken, esc, { photo, flag })}${viewMarkup(m, esc, !photo)}`
      + `<label>可见范围${select}</label><p class="fine" data-moment-fine>${uploadsToServer ? FINE_SERVER : FINE_STATIC}</p>`
      + `<button class="primary" type="submit" ${photo ? '' : 'disabled'}>保存这张照片</button></form>`;
  }

  // ---- patch: the same description, applied to the page in place ----------------------------------------------------------
  const findForm = container => (container?.matches?.('form[data-form="upload"]') ? container : container?.querySelector?.('form[data-form="upload"]')) || null;
  const setText = (node, text) => { if (node && node.textContent !== text) node.textContent = text; };
  const setAttribute = (node, name, value) => {
    if (!node) return;
    if (value === null || value === undefined || value === false) { if (node.getAttribute(name) !== null) node.removeAttribute(name); }
    else if (node.getAttribute(name) !== String(value)) node.setAttribute(name, String(value));
  };

  function patch(container) {
    const form = findForm(container);
    if (!form) return false;
    const live = Boolean(form.querySelector('.photo-review'));
    const room = form.getAttribute('data-room') ?? '';
    const m = model(room, live, defaultEscape);
    const find = selector => form.querySelector(selector);

    setText(find('[data-pick-status]'), m.status);
    form.querySelectorAll('[data-sample-photo]').forEach(button => {
      const current = button.getAttribute('data-sample-photo') === m.sampleId;
      button.classList.toggle('is-current', current);
      setAttribute(button, 'aria-pressed', String(current));
    });
    if (!live) return true;

    const { taken } = m;
    setText(find('[data-taken-line]'), taken.line);
    setText(find('[data-taken-note]'), taken.note);
    const edit = find('[data-taken-edit]');
    if (edit) { edit.hidden = taken.editHidden; setAttribute(edit, 'aria-expanded', String(taken.open)); }
    const field = find('[data-taken-field]');
    if (field) field.hidden = !taken.open;
    setText(find('[data-taken-label]'), taken.label);
    setText(find('[data-taken-hint]'), taken.hint);
    const input = find('input[name="takenAt"]');
    if (input) {
      if (input.value !== taken.value) input.value = taken.value;
      setAttribute(input, 'aria-invalid', taken.problem ? 'true' : null);
      setAttribute(input, 'aria-describedby', taken.problem ? 'moment-taken-error' : null);
    }
    const complaint = find('[data-taken-error]');
    if (complaint) {
      setText(complaint, taken.problem);
      complaint.hidden = !taken.problem;
      if (taken.problem) { try { revealMessage(complaint); } catch { /* no layout to scroll */ } }
    }
    setText(find('[data-taken-off]'), taken.offNight);
    const demoButton = find('[data-demo-time]');
    if (demoButton) { setAttribute(demoButton, 'aria-pressed', String(taken.demoOn)); setText(demoButton, taken.demoText); }

    form.querySelectorAll('[data-moment-viewpoint]').forEach(button => {
      const chip = m.chips.find(item => item.id === button.getAttribute('data-moment-viewpoint'));
      if (!chip) return;
      setAttribute(button, 'aria-pressed', String(chip.pressed));
      button.classList.toggle('is-selected', chip.pressed);
      button.classList.toggle('is-ai', chip.ai);
      button.classList.toggle('is-suggested', chip.suggested);
      button.classList.toggle('is-nudged', chip.nudged);
      // The dashed outline is only for the eyes: a screen reader gets the same message as a description of the choice.
      setAttribute(button, 'aria-describedby', chip.suggested ? 'moment-viewpoint-likely' : null);
    });
    const likely = find('#moment-viewpoint-likely');
    if (!m.likely) likely?.remove();
    else if (!likely) find('.moment-chips')?.insertAdjacentHTML?.('afterend', likelyMarkup(defaultEscape));
    setText(find('[data-viewpoint-nudge]'), m.nudge);

    // A download reports progress many times a second and the line is a status region: once it shows the loading words only its
    // aria-hidden percent and bar move, so a screen reader hears the download once, not every percent.
    const line = find('[data-ai-line]');
    if (line) {
      if (m.aiKey === 'loading' && line.getAttribute('data-ai-key') === 'loading') { if (!moveLoading(line, m.aiLoading)) paintAiLine(line, m.aiHtml); }
      else if (line.getAttribute('data-ai-key') !== m.aiKey) { paintAiLine(line, m.aiHtml); line.setAttribute('data-ai-key', m.aiKey); }
    }
    setText(find('[data-viewpoint-hint]'), m.hint);
    return true;
  }

  // ---- events ------------------------------------------------------------------------------------------------------------
  const datum = (node, key) => node?.dataset?.[key] ?? '';

  function handleClick(event) {
    const target = event?.target;
    if (target?.name === 'photo' && target?.type === 'file') { warmUp(); return; }    // the picker is about to open: start fetching the model
    const closest = selector => target?.closest?.(selector) || null;
    const chip = closest('[data-moment-viewpoint]');
    if (chip) { choose(datum(chip, 'momentViewpoint')); return; }
    const sample = closest('[data-sample-photo]');
    if (sample) { void pickSample(datum(sample, 'samplePhoto')); return; }
    if (closest('[data-taken-edit]')) { openTimeField(); return; }
    if (closest('[data-demo-time]')) toggleDemo();
  }

  function handleChange(event) {
    const input = event?.target;
    if (input?.name === 'photo') {
      const file = input.files?.[0];
      if (!file) return;
      void pick(file);
      try { input.value = ''; } catch { /* a file input that cannot be cleared is only offered the same file again */ }
    } else if (input?.name === 'takenAt') typeTime(input.value);
  }

  function handleInput(event) {
    const input = event?.target;
    if (input?.name === 'takenAt') typeTime(input.value);
    else if (input?.name === 'visibility' && owns(roomOf()) && VISIBILITY_VALUES.includes(input.value)) state.visibility = input.value;
  }

  // Enter in the time field would submit the form, and so save the photo, before the person has looked at the side: here it only ends the typing.
  function handleKeydown(event) {
    if (event?.key === 'Enter' && event.target?.name === 'takenAt') event.preventDefault?.();
  }

  function unbind() {
    for (const off of unbinders) { try { off(); } catch { /* the container is gone */ } }
    unbinders = [];
    bound = null;
  }

  /** Delegated listeners on the panel body: they survive every re-render of the form. Returns the function that removes them. */
  function bind(container) {
    unbind();
    if (!container || typeof container.addEventListener !== 'function') return unbind;
    bound = container;
    for (const [type, handler] of [['click', handleClick], ['change', handleChange], ['input', handleInput], ['keydown', handleKeydown]]) {
      container.addEventListener(type, handler);
      unbinders.push(() => container.removeEventListener?.(type, handler));
    }
    return unbind;
  }

  return { markup, bind, patch, facts, restore, reset, pick, pickSample, warmUp, requiresViewpoint, nudge };
}
