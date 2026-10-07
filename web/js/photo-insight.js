import { readCaptureTime, fallbackTime } from './ai/exif-time.js';
import { getViewpointAI } from './ai/space-ai.js';
import { formatTaken, fromInputValue, takenFromExif, takenFromFile, viewpointName, zoneNote } from './moment.js';

/**
 * What the editors learn from a photo the person has just picked, all of it on this device:
 *   - when it was taken (the picture's own EXIF time, read from the ORIGINAL file before it is shrunk and stripped), and
 *   - which side of the night it shows (a small on-device model; see ai/space-ai.js).
 * Nothing here draws anything or uploads anything, and nothing here can fail loudly: a photo without a time, or a browser
 * without the model, simply gives the person the plain form.
 */

/** The one sentence that must stay true wherever the model runs, and it is said as it stands only where the photo never leaves the device (the local demo). */
export const AI_NOTE = 'AI 在本机判断，照片不上传';
/** The same promise in a room, where saving sends the photo to the room server: only the judging is private, so it never says the photo is not uploaded. */
export const AI_NOTE_ROOM = 'AI 在本机判断，判断时不上传照片';
/**
 * The line shown while the model is being fetched (the first time only). It names no size that depends on the host's compression: a server
 * that gzips sends about 10 MB, one that does not sends about 23 MB, and the person on a phone plan should be told both.
 */
const AI_LOADING_LEAD = 'AI 在本机判断视角 · 首次需下载模型';
const AI_LOADING_SIZE = '（约 10–23 MB）'; // kept on one line when the sentence wraps (see loadingMarkup): "10–23 / MB" reads as two facts
export const AI_LOADING = AI_LOADING_LEAD + AI_LOADING_SIZE;
/** Shown from the moment a picture is handed to the model until its answer (or its silence) arrives: the line is never empty while the person waits. */
export const AI_THINKING = 'AI 在本机判断视角…';
export const NO_TIME = '没读到拍摄时间';
/** A time the person typed that the page cannot use (before 2000 or later than tomorrow): said next to the field instead of being dropped silently. */
export const TIME_OUT_OF_RANGE = '时间需在 2000\u00a0年至明天之间。'; // no break inside "2000 年"

/** '' when a typed time is usable or the field is empty; TIME_OUT_OF_RANGE when something was typed that fromInputValue() refuses. */
export const timeProblem = value => (value && fromInputValue(value) === null ? TIME_OUT_OF_RANGE : '');
/** How long a load may take before the person is told about it: a model already kept on this device is ready sooner than that. */
const LOADING_LINE_DELAY_MS = 350;

let viewpointAI = null;
const ai = () => (viewpointAI ||= getViewpointAI());

/** Whether this browser can run the on-device model at all (secure page, WebAssembly SIMD, createImageBitmap). */
export function aiSupported() {
  try { return ai().supported(); } catch { return false; }
}

/**
 * Where the on-device model stands, for the sentences that talk about it:
 *   'on'           this browser can run it and it has not failed (still to be fetched, loading or ready)
 *   'unsupported'  this browser cannot run it at all (no WebAssembly SIMD ...)
 *   'page'         this page cannot fetch it: it was opened from a local file (file://), not a URL. The same browser could run it from one
 *   'failed'       it should run here but did not load (a blocked or damaged file, a dropped connection)
 * Words about the AI are said only for 'on'. Whatever the person sees, it never promises an answer that is not coming, and the reason
 * given for its absence is the true one: a person on file:// is not told that their browser is at fault.
 */
export function aiState() {
  try {
    const model = ai();
    if (!model.supported()) return model.whyUnsupported?.() === 'page' ? 'page' : 'unsupported';
    return model.status() === 'failed' ? 'failed' : 'on';
  } catch { return 'unsupported'; }
}

/** Whether words about the model may be shown right now (see aiState). Ask again whenever the words are drawn: a load can fail later. */
export const aiAvailable = () => aiState() === 'on';

/** What to say instead of the AI sentence: why the viewpoint is the person's own to choose. */
export const AI_OFF_LINES = Object.freeze({
  unsupported: '这个浏览器用不了本机 AI，视角请自己选。',
  page: '从本地文件打开的页面用不了本机 AI，视角请自己选；改用网址打开可以试试。',
  failed: '本机 AI 这次没能载入，视角请自己选。',
});

/**
 * The line under the viewpoint chips: one short hint, what the viewpoint is for and, while the model can run, that the choice is the
 * person's. Where the model judges (and whether the photo is uploaded) is the AI tag's own note (AI_NOTE / AI_NOTE_ROOM), so the hint
 * says the same in the demo and in a room; `upload` is accepted for the callers that pass it.
 */
export function viewpointHint() {
  return aiAvailable() ? '配对时用它找另一面，你说了算。' : '配对时用它找另一面。';
}

/**
 * The person is about to pick a photo: start fetching the model now, so it is likely there when the picture is chosen.
 * Called from the click that opens the file picker; nothing is downloaded for someone who only uses the example photos,
 * and nothing on a connection that asked to save data. `onSettled` runs once the fetch has ended, well or not, so a page that
 * already printed AI wording can take it back when the model did not load.
 */
export function warmUpViewpointAI(onSettled) {
  try {
    if (!aiSupported() || navigator.connection?.saveData) return;
    const loading = ai().load();
    if (typeof onSettled === 'function') loading.then(() => { try { onSettled(); } catch { /* the page went away */ } });
  } catch { /* the model is an extra, never a requirement */ }
}

/**
 * The capture time of an original photo File. `time` is a real EXIF capture time { takenAt, zoneAssumed }; `guess` is only ever
 * offered to the person for confirmation (the file's modification time, or an EXIF time that is really an editor's/screenshot's);
 * `zone` is the sentence about the clock behind `time` when it is not simply Beijing time ('' otherwise; see zoneNote).
 */
export async function readPhotoTime(file) {
  let raw = null;
  let found = null;
  try { raw = await readCaptureTime(file); found = takenFromExif(raw); } catch { raw = null; found = null; }
  if (found?.trusted) return { time: found, guess: null, zone: zoneNote(raw) };
  let fallback = null;
  try { fallback = takenFromFile(fallbackTime(file)); } catch { fallback = null; }
  return { time: null, guess: found || fallback, zone: '' };
}

/**
 * Identify the viewpoint of a picture (a data: / blob: URL or a Blob). `onState` is called with
 *   { phase: 'thinking' }                 the model is being fetched or started, or is looking at this photo: said at once and kept until the answer
 *   { phase: 'loading', loaded, total }   the model is being downloaded (first visit); said only once a download has lasted a moment, and
 *                                         replaced by 'thinking' again when every byte is here
 *   { phase: 'done', result }             an answer; result.sure says whether it is confident enough to pre-select
 *   { phase: 'silent' }                   no answer (unsupported, failed, timed out): show nothing extra
 * The returned handle's cancel() drops every later call, so a photo that was replaced in the meantime is never labelled.
 */
export function identifyViewpoint(picture, onState) {
  let live = true;
  let announced = false;                 // the 「首次下载」 line is on screen
  let progress = { loaded: 0, total: 0 };
  let timer = 0;
  const say = state => { if (live) { try { onState(state); } catch { /* the page went away */ } } };
  const haveAllBytes = () => progress.total > 0 && progress.loaded >= progress.total;
  (async () => {
    const model = ai();
    if (!model.supported()) { say({ phase: 'silent' }); return; }
    // A load that began earlier (the file picker's warm-up) may already have every byte; its progress is not sent again to a late listener.
    try { progress = model.progress?.() ?? progress; } catch { /* the words below still hold */ }
    if (model.status() !== 'ready') {
      // From here until the answer something is going on (a download, then the model starting up), so the line says so at once: it is
      // never empty while the person waits. The download words replace it only for a download that is really still going after a
      // moment; a model kept from an earlier visit is ready in a blink and never shows them.
      say({ phase: 'thinking' });
      timer = setTimeout(() => {
        if (!live) return;
        try { progress = model.progress?.() ?? progress; } catch { /* keep what the listener has seen */ }
        if (model.status() === 'loading' && !haveAllBytes()) { announced = true; say({ phase: 'loading', ...progress }); }
      }, LOADING_LINE_DELAY_MS);
    }
    await model.load(({ loaded, total }) => {
      progress = { loaded, total };
      if (!live || model.status() !== 'loading') return;
      if (haveAllBytes()) {
        // Every byte is here; what is left is starting the model, which is not a download.
        if (announced) { announced = false; say({ phase: 'thinking' }); }
      } else if (announced) say({ phase: 'loading', loaded, total });
    });
    clearTimeout(timer);
    if (!live) return;
    if (model.status() !== 'ready') { say({ phase: 'silent' }); return; }
    say({ phase: 'thinking' });
    const result = await model.classify(picture);
    if (!live) return;
    say(result.ok ? { phase: 'done', result } : { phase: 'silent', error: result.error });
  })().catch(() => say({ phase: 'silent' }));
  return { cancel() { live = false; clearTimeout(timer); } };
}

/**
 * A message next to a field must be seen where the person is typing: on a phone it can land under the sticky save bar or below the fold
 * of the sheet's own scroller. Scrolls it to the middle of its scroller when it is not fully above the bar (about 96 px at the sheet's foot).
 */
export function revealMessage(element) {
  const sheet = element.closest('dialog') || document.documentElement;
  const box = element.getBoundingClientRect();
  const floor = (sheet === document.documentElement ? window.innerHeight : sheet.getBoundingClientRect().bottom) - 96;
  if (box.height > 0 && (box.bottom > floor || box.top < 0)) element.scrollIntoView({ block: 'center', inline: 'nearest' });
}

const percentOf = ({ loaded = 0, total = 0 } = {}) => (total > 0 ? Math.min(99, Math.floor((loaded / total) * 100)) : 0);
// Non-breaking spaces (and .nowrap on the span): the percent never wraps alone onto the next line, it stays with the size text.
const percentText = percent => (percent > 0 ? `\u00a0·\u00a0${percent}%` : '');

/**
 * The line shown while the model is being fetched, "AI 在本机判断视角 · 首次需下载模型（约 10–23 MB） · 43%", and a small bar. It lives in a status region,
 * and a region announces every change to what it holds while a download reports progress many times a second: only the fixed words are
 * announced (once). The percent and the bar are decoration (aria-hidden) and are moved in place afterwards (see moveLoading).
 * `prefix` is the page's own class stem ('sp-ai-line' or 'live-ai-line').
 */
export function loadingMarkup(prefix, progress) {
  const percent = percentOf(progress);
  return `<span>${AI_LOADING_LEAD}<span class="nowrap">${AI_LOADING_SIZE}</span><span class="nowrap" data-ai-percent aria-hidden="true">${percentText(percent)}</span></span><span class="${prefix}__bar" aria-hidden="true"><i data-ai-fill style="width:${percent}%"></i></span>`;
}

const painted = new WeakMap();
/**
 * Put `html` into a status line unless it is what the line already shows: the same words drawn again are announced again, and the
 * model reports "starting up" twice on its way to an answer.
 */
export function paintAiLine(line, html) {
  if (painted.get(line) === html) return;
  painted.set(line, html);
  line.innerHTML = html;
}

/** Move the percent and the bar of a line that already shows loadingMarkup, without touching what is announced. False when the line shows something else. */
export function moveLoading(line, progress) {
  const label = line.querySelector('[data-ai-percent]');
  const fill = line.querySelector('[data-ai-fill]');
  if (!label || !fill) return false;
  const percent = percentOf(progress);
  label.textContent = percentText(percent);
  fill.style.width = `${percent}%`;
  return true;
}

/** What the chips say to a screen reader instead of "dashed": the description a suggested chip points to (aria-describedby). */
export const SUGGESTED_DESCRIPTION = 'AI 认为这一面更可能';

/**
 * What to show for an answer, without deciding anything for the person:
 *   sure   → the tag 「AI 判断：人海」 and the chip to pre-select
 *   unsure → the words 「不确定，请选择」 and the two likeliest chips to highlight (nothing is selected)
 * `spoken` is the unsure sentence for a screen reader, which cannot see which chips are dashed: it names them.
 */
export function answerView(result) {
  if (!result?.ok) return null;
  if (result.sure) return { sure: true, label: result.label, tag: `AI 判断：${viewpointName(result.label)}`, suggested: [result.label], spoken: '' };
  const suggested = (result.top2 || []).slice(0, 2);
  return {
    sure: false, label: '', tag: '不确定，请选择', suggested,
    spoken: suggested.length ? `，AI 认为更可能是${suggested.map(viewpointName).join('或')}` : '',
  };
}

/**
 * The capture-time line for a card and how the time field should behave.
 *   known   'exif' | 'manual' | 'sample'  → 拍摄于 21:47, the field is offered behind a 修改 button ('sample' only on the 0.16 page, which
 *                                          passes its own sampleNote; the event room never sees that source)
 *   guess   'file'                         → 没读到拍摄时间…, the field is open and prefilled, marked approximate
 *   none                                   → 没读到拍摄时间…, the field is open and empty
 * `zone` (from readPhotoTime) is the sentence about the photo's own clock when it is not Beijing time, so the person who sees 4月8日 11:18
 * for a photo shot at 20:18 in another zone is told the time was converted and not misread. It replaces the plain source note.
 */
export function timeView(card, eventDate = '', { zone = '', sampleNote = '照片自带的时间' } = {}) {
  const at = card?.takenAt;
  const source = card?.takenSource;
  if (Number.isFinite(at) && ['exif', 'manual', 'sample'].includes(source)) {
    const note = { exif: zone || '来自照片自带的信息', manual: '你填写的时间', sample: sampleNote }[source];
    return { mode: 'known', line: `拍摄于 ${formatTaken(at, eventDate)}`, note, editable: source !== 'sample' };
  }
  if (Number.isFinite(at) && source === 'file') return { mode: 'guess', line: NO_TIME, note: '文件里的时间，只是大概；改一下才算数。', editable: true };
  return { mode: 'none', line: NO_TIME, note: '选填；填了才能找「同一刻」。', editable: true };
}
