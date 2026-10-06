// The event room's photo upload module (web/event-room/moment-upload.js): EXIF capture time, the on-device viewpoint suggestion and the
// person's final choice, honest chips, example photos, the demo-only time. No browser and no model here: a stand-in model, a fake
// document / canvas / createImageBitmap and plain objects for the DOM. What the real DOM and the real model do is checked in a browser
// (patch() against markup(), the shipped sample photos) and recorded with the task, not here.
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { createMomentUpload, preparePhoto, validDraftImage } from '../web/event-room/moment-upload.js';
import { getViewpointAI } from '../web/js/ai/space-ai.js';
import { AI_NOTE, AI_NOTE_ROOM, AI_OFF_LINES, SUGGESTED_DESCRIPTION, TIME_OUT_OF_RANGE, viewpointHint } from '../web/js/photo-insight.js';
import { readCaptureTime } from '../web/js/ai/exif-time.js';
import { toInputValue, venueTime } from '../web/js/moment.js';

const ROOM = 'room-1';
const EVENT_DATE = '2026.09.26';
const NIGHT = (hour, minute, second = 0) => venueTime(2026, 9, 26, hour, minute, second);
const DATA_URL = `data:image/jpeg;base64,${'A'.repeat(96)}`;
const NUDGE = '先选一个视角（AI 还在判断时也可以自己选）。没有视角，就找不到同一刻的另一面。';
const nextTick = () => new Promise(resolve => setImmediate(resolve));
async function until(check, label = 'condition', limit = 2000) {
  const started = Date.now();
  while (!check()) {
    if (Date.now() - started > limit) throw new Error(`timed out waiting for ${label}`);
    await nextTick();
  }
}

// ---- a JPEG that carries a capture time (big-endian TIFF inside an APP1 segment) ------------------------------------------
function exifJpeg({ original, offset, dateTime } = {}) {
  const stamp = text => Buffer.from(`${text.replace(/-/g, ':').replace('T', ' ')}\0`, 'latin1');
  const ifd0 = [];
  const exif = [];
  if (dateTime) ifd0.push({ tag: 0x0132, bytes: stamp(dateTime) });
  if (original || offset) ifd0.push({ tag: 0x8769, pointer: true });
  if (original) exif.push({ tag: 0x9003, bytes: stamp(original) });
  if (offset) exif.push({ tag: 0x9011, bytes: Buffer.from(`${offset}\0`, 'latin1') });
  const exifAt = 8 + 2 + ifd0.length * 12 + 4;
  let dataAt = exifAt + (exif.length ? 2 + exif.length * 12 + 4 : 0);
  const data = [];
  const encode = entries => {
    const out = Buffer.alloc(2 + entries.length * 12 + 4);
    out.writeUInt16BE(entries.length, 0);
    entries.forEach((entry, index) => {
      const at = 2 + index * 12;
      out.writeUInt16BE(entry.tag, at);
      if (entry.pointer) { out.writeUInt16BE(4, at + 2); out.writeUInt32BE(1, at + 4); out.writeUInt32BE(exifAt, at + 8); return; }
      out.writeUInt16BE(2, at + 2);
      out.writeUInt32BE(entry.bytes.length, at + 4);
      out.writeUInt32BE(dataAt, at + 8);
      data.push(entry.bytes);
      dataAt += entry.bytes.length;
    });
    return out;
  };
  const header = Buffer.alloc(8);
  header.write('MM', 0);
  header.writeUInt16BE(42, 2);
  header.writeUInt32BE(8, 4);
  const tiff = Buffer.concat([header, encode(ifd0), exif.length ? encode(exif) : Buffer.alloc(0), ...data]);
  const body = Buffer.concat([Buffer.from('Exif\0\0', 'latin1'), tiff]);
  const segment = Buffer.from([0xff, 0xe1, 0, 0]);
  segment.writeUInt16BE(body.length + 2, 2);
  return Buffer.concat([Buffer.from([0xff, 0xd8]), segment, body, Buffer.from([0xff, 0xd9])]);
}
const PLAIN_JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xd9]);
const MTIME = Date.UTC(2026, 6, 10, 2, 53);                                   // 2026-07-10 10:53 in Beijing: a file's own modification time
const sized = (file, size) => Object.defineProperty(file, 'size', { value: size });
const photo = ({ bytes = exifJpeg({ original: '2026-09-26T21:47:50', offset: '+08:00' }), type = 'image/jpeg', name = 'a.jpg', lastModified = MTIME } = {}) => new File([bytes], name, { type, lastModified });

// ---- stand-ins -----------------------------------------------------------------------------------------------------------
/** A page that can draw: document.createElement('canvas') and createImageBitmap, recording what was asked of them. */
function installImaging({ width = 4000, height = 3000, length = () => 1000 } = {}) {
  const seen = { order: [], bitmaps: 0, closed: 0, canvases: [] };
  globalThis.createImageBitmap = async () => { seen.bitmaps += 1; seen.order.push('compress'); return { width, height, close() { seen.closed += 1; } }; };
  globalThis.document = {
    baseURI: 'https://example.test/event-room/',
    createElement(tag) {
      assert.equal(tag, 'canvas');
      const canvas = {
        width: 0, height: 0,
        getContext: () => ({ drawImage() {} }),
        toDataURL(type, quality) {
          seen.canvases.push({ width: canvas.width, height: canvas.height, type, quality });
          return `data:image/jpeg;base64,${'A'.repeat(length(seen.canvases.length))}`;
        },
      };
      return canvas;
    },
  };
  return seen;
}

/** The shared on-device model, replaced by one the test can steer (the way scripts/test/insight.test.mjs does). */
function installModel() {
  const model = getViewpointAI();
  const control = {
    supported: true, why: null, status: 'idle', progress: { loaded: 0, total: 0 }, hold: false, holdAnswer: false,
    result: { ok: true, sure: true, label: 'crowd', top2: ['crowd', 'stage'] },
    loads: 0, classified: [], report: () => {}, finish: () => {}, release: () => {},
  };
  Object.assign(model, {
    supported: () => control.supported,
    whyUnsupported: () => control.why,
    status: () => (control.supported ? control.status : 'unsupported'),
    progress: () => ({ ...control.progress }),
    load(onProgress) {
      control.loads += 1;
      if (control.status === 'ready') return Promise.resolve();
      control.status = 'loading';
      return new Promise(resolve => {
        control.report = state => { control.progress = state; onProgress?.(state); };
        control.finish = ({ fail = false } = {}) => { control.status = fail ? 'failed' : 'ready'; resolve(); };
        if (!control.hold) control.finish();
      });
    },
    async classify(picture) {
      control.classified.push(picture);
      if (control.holdAnswer) await new Promise(resolve => { control.release = resolve; });
      return control.result;
    },
  });
  return control;
}

const SAMPLES = Object.freeze([
  { id: 'sample-crowd', label: '人海 · 示例照片', note: '虚构的拍摄时间 21:48，写在文件里', thumbUrl: '/demo/sample-crowd.jpg' },
  { id: 'sample-stage', label: '舞台 · 示例照片', note: '虚构的拍摄时间 21:47，写在文件里', thumbUrl: '/demo/sample-stage.jpg' },
]);
const DEMO_TIME = Object.freeze({ ms: NIGHT(21, 47), label: '演示用：把拍摄时间设成示例现场的 21:47', note: '你填写的时间 · 演示用' });
const SAMPLE_FILES = { 'sample-crowd': () => photo({ bytes: exifJpeg({ original: '2026-09-26T21:48:10', offset: '+08:00' }), name: 'sample-crowd.jpg' }), 'sample-stage': () => photo({ bytes: exifJpeg({ original: '2026-09-26T21:47:50', offset: '+08:00' }), name: 'sample-stage.jpg' }) };

/** A form with every callback recorded; html() renders what the page would show for the latest draft. */
function harness(overrides = {}) {
  const rec = { drafts: [], changes: 0, busy: [], errors: [] };
  const where = { room: ROOM };
  const upload = createMomentUpload({
    getRoomId: () => where.room,
    eventDate: EVENT_DATE,
    uploadsToServer: false,
    samples: SAMPLES,
    loadSample: async id => SAMPLE_FILES[id](),
    demoTime: DEMO_TIME,
    onDraft: draft => rec.drafts.push(draft),
    onChange: () => { rec.changes += 1; },
    onBusy: busy => rec.busy.push(busy),
    onError: error => rec.errors.push(error),
    ...overrides,
  });
  const html = (extra = {}) => {
    const latest = rec.drafts.at(-1);
    return upload.markup({ draft: latest ? { roomId: latest.roomId, dataUrl: latest.dataUrl, visibility: latest.visibility } : null, roomId: where.room, ...extra });
  };
  const idle = () => rec.busy.at(-1) !== true;
  return { upload, rec, where, html, idle };
}

// ---- reading the markup without a DOM --------------------------------------------------------------------------------------
const tag = (html, attribute, value) => (html.match(new RegExp(`<[a-z]+ [^>]*${attribute}="${value}"[^>]*>`)) || [''])[0];
/** The opening tag of the element that carries a (possibly valueless) attribute. */
const el = (html, attribute) => (html.match(new RegExp(`<[a-z]+ [^>]*[ ]${attribute}(?:[ >=])[^>]*>`)) || [''])[0];
const chip = (html, id) => tag(html, 'data-moment-viewpoint', id);
const classes = html => ((html.match(/class="([^"]*)"/) || [])[1] || '').split(' ');
const pressedChips = html => ['stage', 'crowd', 'friends', 'detail'].filter(id => chip(html, id).includes('aria-pressed="true"'));
const suggestedChips = html => ['stage', 'crowd', 'friends', 'detail'].filter(id => classes(chip(html, id)).includes('is-suggested'));
const plain = html => html.replace(/<[^>]*>/g, '').replace(/\u00a0/g, ' ').replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
const region = (html, attribute) => { const open = html.match(new RegExp(`<([a-z]+) [^>]*${attribute}[^>]*>`)); if (!open) return null; const from = open.index + open[0].length; return html.slice(from, html.indexOf(`</${open[1]}>`, from)); };
const aiLine = html => plain(region(html, 'data-ai-line') ?? '');
const takenLine = html => plain(region(html, 'data-taken-line') ?? '');
const takenNote = html => plain(region(html, 'data-taken-note') ?? '');
const timeField = html => tag(html, 'name', 'takenAt');

// ---- fake containers: listeners, and a form that records what patch() writes ----------------------------------------------
function fakeContainer({ removable = true } = {}) {
  const listeners = new Map();
  return {
    listeners,
    addEventListener(type, handler) { (listeners.get(type) || listeners.set(type, []).get(type)).push(handler); },
    ...(removable ? { removeEventListener(type, handler) { const list = listeners.get(type) || []; const at = list.indexOf(handler); if (at >= 0) list.splice(at, 1); } } : {}),
    emit(type, target, extra = {}) { for (const handler of [...(listeners.get(type) || [])]) handler({ type, target, ...extra }); },
    count: () => [...listeners.values()].reduce((sum, list) => sum + list.length, 0),
    querySelector: () => null,
    querySelectorAll: () => [],
  };
}
const camel = name => name.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
/** A clicked element: closest('[data-x]') finds it when it carries data-x. */
function control(dataset = {}, extra = {}) {
  const node = { dataset, ...extra, closest(selector) { const key = /^\[data-([a-z-]+)\]$/.exec(selector)?.[1]; return key && camel(key) in dataset ? node : null; } };
  return node;
}

function fakeNode(attributes = {}, text = '') {
  const set = new Set((attributes.class || '').split(' ').filter(Boolean));
  const node = {
    attributes: new Map(Object.entries(attributes)), textContent: text, value: attributes.value ?? '', hidden: false, removed: false, inserted: [], html: '',
    classList: { toggle(name, on) { if (on) set.add(name); else set.delete(name); }, contains: name => set.has(name) },
    getAttribute(name) { return node.attributes.has(name) ? node.attributes.get(name) : null; },
    setAttribute(name, value) { node.attributes.set(name, String(value)); },
    removeAttribute(name) { node.attributes.delete(name); },
    insertAdjacentHTML(where, html) { node.inserted.push([where, html]); },
    remove() { node.removed = true; },
    set innerHTML(value) { node.html = value; },
    get innerHTML() { return node.html; },
  };
  return node;
}
/** The pieces of the form that patch() looks for. A selector patch() has not been told about throws, so a new one cannot slip in unseen. */
function fakeForm(room = ROOM) {
  const nodes = {
    '.photo-review': fakeNode(),
    '[data-pick-status]': fakeNode(),
    '[data-taken-line]': fakeNode({ 'data-taken-none': '' }, '没读到拍摄时间（截图或转发的图常会丢失）'),
    '[data-taken-sep]': Object.assign(fakeNode(), { hidden: true }),     // shut, as markup() draws it before there is a note
    '[data-taken-note]': fakeNode(),
    '[data-taken-edit]': fakeNode({ 'aria-expanded': 'true' }),
    '[data-taken-field]': fakeNode(),
    '[data-taken-label]': fakeNode(),
    '[data-taken-hint]': fakeNode(),
    'input[name="takenAt"]': fakeNode({ value: '' }),
    '[data-taken-error]': fakeNode(),
    '[data-taken-off]': fakeNode(),
    '[data-demo-time]': fakeNode({ 'aria-pressed': 'false' }, DEMO_TIME.label),
    '#moment-viewpoint-likely': null,
    '.moment-chips': fakeNode(),
    '[data-viewpoint-nudge]': fakeNode(),
    '[data-ai-line]': fakeNode({ 'data-ai-key': 'off:unsupported' }),
    '[data-viewpoint-hint]': fakeNode(),
  };
  const chips = ['stage', 'crowd', 'friends', 'detail'].map(id => fakeNode({ 'data-moment-viewpoint': id, 'aria-pressed': 'false', class: 'moment-chip' }));
  const samples = SAMPLES.map(sample => fakeNode({ 'data-sample-photo': sample.id, 'aria-pressed': 'false', class: 'moment-sample' }));
  const form = {
    nodes, chips, samples,
    getAttribute: name => (name === 'data-room' ? room : null),
    matches: selector => selector === 'form[data-form="upload"]',
    querySelector(selector) { if (!(selector in nodes)) throw new Error(`patch() asked for an unexpected selector: ${selector}`); return nodes[selector]; },
    querySelectorAll(selector) {
      if (selector === '[data-moment-viewpoint]') return chips;
      if (selector === '[data-sample-photo]') return samples;
      throw new Error(`patch() asked for an unexpected selector list: ${selector}`);
    },
  };
  return { ...form, form };
}

// ============================================================================================================================
// preparePhoto: compress exactly like app.js did, and refuse what the room cannot take
// ============================================================================================================================
test('preparePhoto redraws to 1600 px at .82 and closes the bitmap', async () => {
  const seen = installImaging({ width: 4000, height: 3000 });
  const url = await preparePhoto(photo());
  assert.match(url, /^data:image\/jpeg;base64,/);
  assert.deepEqual(seen.canvases, [{ width: 1600, height: 1200, type: 'image/jpeg', quality: .82 }]);
  assert.equal(seen.closed, 1);
});

test('preparePhoto keeps a small picture at its own size', async () => {
  const seen = installImaging({ width: 800, height: 600 });
  await preparePhoto(photo());
  assert.deepEqual([seen.canvases[0].width, seen.canvases[0].height], [800, 600]);
});

test('preparePhoto lowers the quality by .055 and the size by a fifth until it fits under 390000, six tries at most', async () => {
  const seen = installImaging({ width: 2000, height: 1000, length: attempt => (attempt < 3 ? 400000 : 1000) });
  await preparePhoto(photo());
  assert.equal(seen.canvases.length, 3);
  assert.deepEqual(seen.canvases.map(entry => entry.quality), [.82, .82 - .055, .82 - 2 * .055]);
  assert.deepEqual(seen.canvases.map(entry => entry.width), [1600, 1280, 1024]);

  const stuck = installImaging({ length: () => 390000 });
  await assert.rejects(preparePhoto(photo()), { message: '这张照片太复杂，请裁剪后再试' });
  assert.equal(stuck.canvases.length, 6);
  assert.equal(stuck.closed, 1, 'the bitmap is closed on the way out');
});

test('preparePhoto: 20 MB and jpeg / png / webp only, checked before anything is decoded', async () => {
  const seen = installImaging();
  await assert.rejects(preparePhoto(sized(photo(), 20 * 1024 * 1024 + 1)), { message: '请选择 20 MB 以内的照片' });
  await assert.rejects(preparePhoto(photo({ type: 'image/heic' })), { message: '请选择 JPG、PNG 或 WebP 照片' });
  await assert.rejects(preparePhoto(photo({ type: '' })), { message: '请选择 JPG、PNG 或 WebP 照片' });
  assert.equal(seen.bitmaps, 0);
  for (const type of ['image/jpeg', 'image/png', 'image/webp']) await preparePhoto(photo({ type }));
  await preparePhoto(sized(photo(), 20 * 1024 * 1024));
  assert.equal(seen.bitmaps, 4, 'the three types and the file of exactly 20 MB');
});

test('preparePhoto never returns something that is not a JPEG data: URL, and never draws a zero-sized canvas', async () => {
  const seen = installImaging({ width: 10000, height: 1 });
  await preparePhoto(photo());
  assert.deepEqual([seen.canvases[0].width, seen.canvases[0].height], [1600, 1], 'a very wide picture keeps a one-pixel height');
  globalThis.document.createElement = () => ({ getContext: () => ({ drawImage() {} }), toDataURL: () => 'data:,' });
  await assert.rejects(preparePhoto(photo()), { message: '这张照片没能处理，请换一张再试' });
});

test('validDraftImage accepts a bounded JPEG data: URL and nothing a corrupt draft could smuggle in', () => {
  assert.equal(validDraftImage(DATA_URL), true);
  assert.equal(validDraftImage(`${DATA_URL}==`), true);
  assert.equal(validDraftImage('" onerror="alert(1)'), false);
  assert.equal(validDraftImage('data:image/png;base64,AAAA'), false);
  assert.equal(validDraftImage('data:image/jpeg;base64,AA" onerror="x'), false);
  assert.equal(validDraftImage(`data:image/jpeg;base64,${'A'.repeat(410 * 1024)}`), false);
  assert.equal(validDraftImage(null), false);
});

// ============================================================================================================================
// markup: the whole form, as the page will draw it
// ============================================================================================================================
test('markup: the empty form has the file input, the heading, a disabled submit written as app.js wrote it, and no photo', () => {
  installModel();
  const { upload } = harness({ samples: [], demoTime: null });
  const html = upload.markup({ draft: null, roomId: ROOM });
  assert.match(html, /^<small class="eyebrow">留一个现场瞬间<\/small><h2>这一张，由你决定给谁看。<\/h2><form /);
  assert.match(html, /<form [^>]*data-form="upload"[^>]*data-room="room-1"/);
  assert.match(html, /<input type="file" name="photo" accept="image\/jpeg,image\/png,image\/webp">/);
  assert.match(html, /<button class="primary" type="submit" disabled>保存这张照片<\/button>/, 'the binding test matches type then disabled');
  assert.doesNotMatch(html, /photo-review/, 'no picture before there is one');
  assert.match(html, /<div class="moment-taken" data-taken hidden>/, 'the time card is in the page and shut');
  assert.match(html, /<fieldset class="moment-view" hidden>/, 'so is the viewpoint block');
  for (const id of ['stage', 'crowd', 'friends', 'detail']) assert.match(chip(html, id), /^<button type="button" class="moment-chip" data-moment-viewpoint="\w+" aria-pressed="false">$/);
  assert.match(html, /data-ai-line/);
  assert.match(html, /<select name="visibility"><option value="private" selected>仅自己保存<\/option><option value="members" >分享给本场成员<\/option><\/select>/);
  assert.equal(upload.markup({ draft: null, roomId: ROOM, heading: false }).startsWith('<form '), true);
});

test('markup: a draft shows the picture only when it is a valid JPEG data: URL of this room', () => {
  installModel();
  const { upload } = harness();
  const draft = { roomId: ROOM, dataUrl: DATA_URL, visibility: 'private' };
  const html = upload.markup({ draft, roomId: ROOM });
  assert.match(html, /<img class="photo-review" src="data:image\/jpeg;base64,A+" alt="待保存的照片">/);
  assert.match(html, /<button class="primary" type="submit" >保存这张照片<\/button>/, 'enabled once a draft exists');
  for (const unsafe of ['" onerror="alert(1)', 'data:image/png;base64,AAAA', 'javascript:alert(1)']) {
    const bad = upload.markup({ draft: { ...draft, dataUrl: unsafe }, roomId: ROOM });
    assert.doesNotMatch(bad, /photo-review|onerror|alert\(1\)/);
    assert.match(bad, /type="submit" disabled/);
  }
  const elsewhere = upload.markup({ draft: { ...draft, roomId: 'other' }, roomId: ROOM });
  assert.doesNotMatch(elsewhere, /photo-review/, 'a draft of another room is not shown');
  assert.match(elsewhere, /type="submit" disabled/);
});

test('markup: the server copy keeps the upload sentence and the picture is called a photo to upload', () => {
  installModel();
  const { upload } = harness({ uploadsToServer: true, samples: [], demoTime: null });
  const html = upload.markup({ draft: { roomId: ROOM, dataUrl: DATA_URL }, roomId: ROOM });
  assert.ok(html.includes('保存时照片会上传至受权限保护的房间服务。会缩小并去除位置信息；选择分享后，本场已加入成员可以浏览。'));
  assert.doesNotMatch(html, /只保存在这个浏览器里/);
  assert.match(html, /alt="本次待上传的照片"/);
  assert.doesNotMatch(html, /data-sample-photo|没有现场照片|data-demo-time/);
});

test('markup: the static copy says the photo stays in this browser and that the cast are automatic example characters', () => {
  installModel();
  const { upload } = harness();
  const html = upload.markup({ draft: null, roomId: ROOM });
  assert.ok(html.includes('照片会缩小并去除位置信息，只保存在这个浏览器里；选择分享后，示例现场里的成员（自动回复的示例角色）可以看到。'));
  assert.doesNotMatch(plain(html), /上传至|房间服务/);
});

test('markup: example photos are listed with thumbnails and the invitation, and only when there are some', () => {
  installModel();
  const html = harness().upload.markup({ draft: null, roomId: ROOM });
  assert.ok(html.includes('没有现场照片？用示例照片试试'));
  for (const sample of SAMPLES) {
    const button = tag(html, 'data-sample-photo', sample.id);
    assert.match(button, /^<button type="button"/);
    assert.match(html, new RegExp(`data-sample-photo="${sample.id}"[^>]*>.*?<img src="${sample.thumbUrl.replace(/\//g, '\\/')}" alt=""`));
    assert.ok(html.includes(sample.label) && html.includes(sample.note));
  }
  for (const empty of [[], undefined, null, 'x', [{ label: 'no id' }]]) {
    const none = harness({ samples: empty }).upload.markup({ draft: null, roomId: ROOM });
    assert.doesNotMatch(none, /data-sample-photo|没有现场照片|moment-samples/);
  }
});

test('markup: every dynamic word is escaped, hostile sample labels included', () => {
  installModel();
  const hostile = { id: 'x"><script>alert(1)</script>', label: '<img src=x onerror=alert(1)>', note: '"><b>bold</b>', thumbUrl: 'a" onerror="alert(1)' };
  const { upload } = harness({ samples: [hostile], eventDate: '2026.09.26"><i>', demoTime: { ms: NIGHT(21, 47), label: '<u>演示</u>', note: '<s>note</s>' } });
  const draft = { roomId: ROOM, dataUrl: DATA_URL, visibility: 'private' };
  for (const html of [upload.markup({ draft: null, roomId: ROOM }), upload.markup({ draft, roomId: `${ROOM}"><x>` }), upload.markup({ draft, roomId: ROOM })]) {
    assert.doesNotMatch(html, /<script|<img src=x|<b>bold|<u>|<s>|<i>|<x>/);
    assert.doesNotMatch(html, /" onerror="alert/);
  }
  assert.ok(upload.markup({ draft: null, roomId: ROOM }).includes('data-sample-photo="x&quot;&gt;&lt;script&gt;alert(1)&lt;/script&gt;"'));
  // and the caller's own escape function is the one used
  const custom = upload.markup({ draft: null, roomId: ROOM, esc: text => `«${String(text)}»` });
  assert.ok(custom.includes('data-room="«room-1»"'));
});

test('markup is a pure function of the module and its arguments: the same state draws the same string, whatever the clock says', () => {
  installModel();
  const { upload } = harness();
  const draft = { roomId: ROOM, dataUrl: DATA_URL, visibility: 'private' };
  const first = upload.markup({ draft, roomId: ROOM });
  const realNow = Date.now;
  try {
    Date.now = () => realNow() + 3 * 86_400_000;
    assert.equal(upload.markup({ draft, roomId: ROOM }), first, 'the picker bounds do not drift with the clock');
  } finally { Date.now = realNow; }
  assert.equal(upload.markup({ draft, roomId: ROOM }), first);
  assert.match(first, /name="takenAt" min="2000-01-01T08:00" max="[\d-]+T[\d:]+" step="60"/);
  assert.match(first, /<form class="moment-upload has-photo" [^>]*novalidate>/, 'an out-of-range time is explained by the page, not blocked by the browser');
});

test('markup: the visibility select is private by default, members right after an example is picked, and the person\'s own choice wins', async () => {
  installModel();
  installImaging();
  const h = harness();
  const draft = { roomId: ROOM, dataUrl: DATA_URL, visibility: 'private' };
  const selected = html => /<option value="(\w+)" selected>/.exec(html)?.[1];
  assert.equal(selected(h.upload.markup({ draft: null, roomId: ROOM })), 'private');
  assert.equal(selected(h.upload.markup({ draft: { ...draft, visibility: 'members' }, roomId: ROOM })), 'members', 'a saved draft keeps its choice');
  await h.upload.pick(photo());
  assert.equal(h.rec.drafts.at(-1).visibility, 'private');
  assert.equal(selected(h.html()), 'private');
  await h.upload.pickSample('sample-crowd');
  assert.equal(h.rec.drafts.at(-1).visibility, 'members', 'the draft is told');
  assert.equal(selected(h.upload.markup({ draft: { ...draft, visibility: 'private' }, roomId: ROOM })), 'members', 'and the form shows it even if the page kept the old default');
  const container = fakeContainer();
  h.upload.bind(container);
  container.emit('input', { name: 'visibility', value: 'private' });
  assert.equal(selected(h.upload.markup({ draft: { ...draft, visibility: 'members' }, roomId: ROOM })), 'private', 'the person choosing private after that is respected');
  await h.upload.pickSample('sample-stage');
  assert.equal(selected(h.html()), 'members', 'a new example starts from the default again');
});

// ============================================================================================================================
// pick: the capture time is read from the original, the picture is redrawn, the viewpoint starts empty
// ============================================================================================================================
test('pick reads the capture time from the ORIGINAL file before it is redrawn, then hands over the draft', async () => {
  installModel();
  const log = [];
  const seen = installImaging();
  const realBitmap = globalThis.createImageBitmap;
  globalThis.createImageBitmap = async file => { log.push('redraw'); return realBitmap(file); };
  class Spy extends File { slice(...args) { log.push('read time'); return super.slice(...args); } }
  const h = harness();
  assert.equal(await h.upload.pick(new Spy([exifJpeg({ original: '2026-09-26T21:47:50', offset: '+08:00' })], 'a.jpg', { type: 'image/jpeg', lastModified: MTIME })), true);
  assert.deepEqual(log.slice(0, 2), ['read time', 'redraw']);
  assert.equal(seen.bitmaps, 1);
  assert.equal(h.rec.drafts.length, 1);
  assert.deepEqual(h.rec.drafts[0], { roomId: ROOM, dataUrl: h.rec.drafts[0].dataUrl, facts: { takenAt: NIGHT(21, 47, 50), takenSource: 'exif' }, visibility: 'private' });
  assert.equal(validDraftImage(h.rec.drafts[0].dataUrl), true);
  assert.deepEqual(h.rec.errors, []);
});

test('pick: the viewpoint starts empty even when the previous photo had one, and the previous model call is cancelled', async () => {
  const model = installModel();
  installImaging();
  model.holdAnswer = true;
  const h = harness();
  await h.upload.pick(photo());
  await until(() => model.classified.length === 1, 'the first model call');
  const firstRelease = model.release;
  const container = fakeContainer();
  h.upload.bind(container);
  container.emit('click', control({ momentViewpoint: 'stage' }));
  assert.equal(h.upload.facts().viewpoint, 'stage');
  await h.upload.pick(photo());
  assert.equal(h.upload.facts().viewpoint, undefined, 'a new photo is a new question');
  assert.equal(h.upload.facts().viewpointSource, undefined);
  assert.deepEqual(pressedChips(h.html()), []);
  firstRelease();                                       // the first photo's model answers late: nobody is listening
  await nextTick();
  await until(() => model.classified.length === 2, 'the second model call');
  assert.deepEqual(pressedChips(h.html()), []);
  model.release();
  await until(() => h.upload.facts().viewpoint === 'crowd', 'the second answer');
});

test('a stale pick is dropped: only the latest file becomes the draft', async () => {
  installModel();
  installImaging();
  const h = harness();
  let letFirstGo;
  const slow = photo({ name: 'slow.jpg' });
  const realSlice = slow.slice.bind(slow);
  slow.slice = (...args) => { const sliced = realSlice(...args); return { arrayBuffer: async () => { await new Promise(resolve => { letFirstGo = resolve; }); return sliced.arrayBuffer(); }, size: sliced.size }; };
  const first = h.upload.pick(slow);
  await until(() => typeof letFirstGo === 'function', 'the first read to start');
  const second = h.upload.pick(photo({ bytes: exifJpeg({ original: '2026-09-26T22:21:10', offset: '+08:00' }) }));
  assert.equal(await second, true);
  letFirstGo();
  assert.equal(await first, false);
  assert.equal(h.rec.drafts.length, 1);
  assert.equal(h.rec.drafts[0].facts.takenAt, NIGHT(22, 21, 10));
  assert.deepEqual(h.rec.errors, []);
});

test('a pick is dropped quietly when the room changed while it was being read', async () => {
  installModel();
  installImaging();
  const h = harness();
  const pending = h.upload.pick(photo());
  h.where.room = 'room-2';
  assert.equal(await pending, false);
  assert.equal(h.rec.drafts.length, 0);
  assert.deepEqual(h.rec.errors, []);
});

test('an unusable file is an error for the page to show and leaves the form as it was', async () => {
  installModel();
  installImaging();
  const h = harness();
  await h.upload.pick(photo());
  await until(() => h.upload.facts().viewpoint, 'the first photo\'s answer');
  const before = h.upload.facts();
  assert.equal(await h.upload.pick(photo({ type: 'image/heic' })), false);
  assert.equal(await h.upload.pick(sized(photo(), 21 * 1024 * 1024)), false);
  assert.deepEqual(h.rec.errors.map(error => error.message), ['请选择 JPG、PNG 或 WebP 照片', '请选择 20 MB 以内的照片']);
  assert.equal(h.rec.drafts.length, 1, 'the earlier draft is still the only one');
  assert.deepEqual(h.upload.facts(), before);
  assert.equal(await h.upload.pick(null), false);
  assert.match(h.html(), /type="submit" >/, 'the earlier photo is still there to save');
  assert.doesNotMatch(plain(h.html()), /正在处理照片/, 'the working note is gone once the pick failed');
});

test('picking says so while it works, and stops saying so', async () => {
  installModel();
  installImaging();
  const h = harness();
  const pending = h.upload.pick(photo());
  assert.match(h.html(), /data-pick-status[^>]*>正在处理照片…</);
  await pending;
  assert.match(h.html(), /data-pick-status[^>]*><\/p>/);
  const slow = new Promise(resolve => setImmediate(resolve));
  const sampling = createMomentUpload({ getRoomId: () => ROOM, samples: SAMPLES, loadSample: async () => { await slow; return SAMPLE_FILES['sample-crowd'](); }, onDraft() {} });
  const loading = sampling.pickSample('sample-crowd');
  assert.match(sampling.markup({ draft: null, roomId: ROOM }), /data-pick-status[^>]*>正在载入示例照片…</);
  await loading;
  assert.match(sampling.markup({ draft: null, roomId: ROOM }), /data-pick-status[^>]*><\/p>/);
});

test('pickSample = loadSample then pick; an unknown example or a failing load is an error, not a crash', async () => {
  installModel();
  installImaging();
  const loaded = [];
  const h = harness({ loadSample: async id => { loaded.push(id); return SAMPLE_FILES[id](); } });
  assert.equal(await h.upload.pickSample('sample-crowd'), true);
  assert.deepEqual(loaded, ['sample-crowd']);
  assert.equal(h.rec.drafts[0].facts.takenAt, NIGHT(21, 48, 10), 'the example carries its own EXIF time, read like any photo\'s');
  assert.equal(h.rec.drafts[0].facts.takenSource, 'exif');
  assert.equal(await h.upload.pickSample('nope'), false);
  assert.match(h.rec.errors.at(-1).message, /找不到这张示例照片/);
  const failing = harness({ loadSample: async () => { throw new Error('网络断了'); } });
  assert.equal(await failing.upload.pickSample('sample-crowd'), false);
  assert.equal(failing.rec.errors[0].message, '网络断了');
  assert.equal(failing.rec.drafts.length, 0);
  const none = harness({ samples: [], loadSample: null });
  assert.equal(await none.upload.pickSample('sample-crowd'), false);
});

test('an example that arrives without a type is still the JPEG it is; an own file without one is refused', async () => {
  installModel();
  installImaging();
  const h = harness({ loadSample: async () => { const file = SAMPLE_FILES['sample-crowd'](); return new Blob([await file.arrayBuffer()]); } });
  assert.equal(await h.upload.pickSample('sample-crowd'), true);
  assert.equal(h.rec.drafts[0].facts.takenAt, NIGHT(21, 48, 10));
  assert.equal(await h.upload.pick(new Blob([PLAIN_JPEG])), false);
  assert.equal(h.rec.errors.at(-1).message, '请选择 JPG、PNG 或 WebP 照片');
});

test('a second example picked while the first is still loading wins; the first is dropped', async () => {
  installModel();
  installImaging();
  const gates = {};
  const h = harness({ loadSample: id => new Promise(resolve => { gates[id] = () => resolve(SAMPLE_FILES[id]()); }) });
  const first = h.upload.pickSample('sample-crowd');
  const second = h.upload.pickSample('sample-stage');
  await until(() => gates['sample-crowd'] && gates['sample-stage'], 'both loads to start');
  gates['sample-stage']();
  assert.equal(await second, true);
  gates['sample-crowd']();
  assert.equal(await first, false);
  assert.equal(h.rec.drafts.length, 1);
  assert.equal(h.rec.drafts[0].facts.takenAt, NIGHT(21, 47, 50));
  assert.match(plain(h.html()), /示例照片 · 虚构的拍摄时间 21:47，写在文件里/);
  assert.equal(tag(h.html(), 'data-sample-photo', 'sample-stage').includes('aria-pressed="true"'), true);
  assert.equal(tag(h.html(), 'data-sample-photo', 'sample-crowd').includes('aria-pressed="false"'), true);
});

// ============================================================================================================================
// time: what the photo says, what the person types, what is sent
// ============================================================================================================================
test('time: a trusted EXIF time is shown as such, sent as exif, and may be edited', async () => {
  installModel();
  installImaging();
  const h = harness();
  await h.upload.pick(photo());
  const html = h.html();
  assert.equal(takenLine(html), '拍摄于 21:47');
  assert.equal(takenNote(html), '来自照片自带的信息');
  assert.match(html, /<span data-taken-line>拍摄于 21:47<\/span>/, 'a time is set as the clock');
  // the status line still reads as one sentence; its 「 · 」 is a span of its own, so the note can sit under the clock without a leading dot
  assert.match(html, /<span data-taken-line>拍摄于 21:47<\/span><span class="moment-taken__sep" data-taken-sep> · <\/span><small data-taken-note>来自照片自带的信息<\/small>/);
  assert.deepEqual(h.upload.facts(), { takenAt: NIGHT(21, 47, 50), takenSource: 'exif' });
  assert.match(el(html, 'data-taken-edit'), /^<button type="button"/);
  assert.doesNotMatch(el(html, 'data-taken-edit'), / hidden/, 'the edit button is offered');
  assert.match(html, /data-taken-field hidden/, 'and the field stays shut until asked');
  assert.match(timeField(html), /value="2026-09-26T21:47"/);
});

test('time: a photo whose camera wrote another zone is converted, and says so', async () => {
  installModel();
  installImaging();
  const h = harness();
  await h.upload.pick(photo({ bytes: exifJpeg({ original: '2026-09-26T06:47:50', offset: '-07:00' }) }));
  assert.equal(h.rec.drafts[0].facts.takenAt, Date.parse('2026-09-26T06:47:50-07:00'));
  assert.match(takenNote(h.html()), /已换算成北京时间，照片自带的是 9月26日 06:47（UTC−07:00）/);
});

test('time: a photo without a zone is read as Beijing time and says so', async () => {
  installModel();
  installImaging();
  const h = harness();
  await h.upload.pick(photo({ bytes: exifJpeg({ original: '2026-09-26T21:47:50' }) }));
  assert.equal(h.rec.drafts[0].facts.takenAt, NIGHT(21, 47, 50));
  assert.match(takenNote(h.html()), /照片没写时区，按北京时间算/);
});

test('time: a weak EXIF time (an editor\'s DateTime) is a guess: shown, not sent', async () => {
  installModel();
  installImaging();
  const h = harness();
  await h.upload.pick(photo({ bytes: exifJpeg({ dateTime: '2026-09-26T21:47:50' }) }));
  const html = h.html();
  assert.equal(takenLine(html), '没读到拍摄时间（截图或转发的图常会丢失）');
  assert.match(html, /<span class="moment-taken__sep" data-taken-sep hidden> · <\/span><small data-taken-note><\/small>/, 'no note, so no 「 · 」 either');
  assert.match(html, /<span data-taken-line data-taken-none>没读到拍摄时间/, 'no usable time: the line is a sentence, and says so to the Doodle layer');
  assert.match(plain(html), /取自文件信息，只是大概，不一定是拍摄时间；不修改就不用来判断「同一刻」。/);
  assert.match(plain(html), /大约的时间 · 北京时间/);
  assert.match(timeField(html), /value="2026-09-26T21:47"/, 'prefilled, as a suggestion the person can confirm');
  assert.doesNotMatch(html, /data-taken-field hidden/, 'the field is open');
  assert.deepEqual(h.rec.drafts[0].facts, {});
  assert.deepEqual(h.upload.facts(), {});
});

test('time: a file with no EXIF falls back to its modification time as a guess, and with nothing at all the field is open and empty', async () => {
  installModel();
  installImaging();
  const h = harness();
  await h.upload.pick(photo({ bytes: PLAIN_JPEG }));
  assert.equal(takenLine(h.html()), '没读到拍摄时间（截图或转发的图常会丢失）');
  assert.match(timeField(h.html()), new RegExp(`value="${toInputValue(MTIME)}"`));
  assert.deepEqual(h.upload.facts(), {}, 'a file time is never sent');
  assert.match(plain(h.html()), /取自文件信息/);
  await h.upload.pick(photo({ bytes: PLAIN_JPEG, lastModified: 0 }));
  assert.match(timeField(h.html()), /value=""/);
  assert.match(plain(h.html()), /选填，不填也能保存；填了才能按时间配对「同一刻」。/);
  assert.deepEqual(h.upload.facts(), {});
});

test('time: typing a time makes it the person\'s own (manual) and replaces a read or guessed one', async () => {
  installModel();
  installImaging();
  const h = harness();
  const container = fakeContainer();
  h.upload.bind(container);
  const type = value => container.emit('input', { name: 'takenAt', value });
  await h.upload.pick(photo({ bytes: exifJpeg({ dateTime: '2026-07-10T10:53:00' }) }));       // a guess
  type('2026-09-26T21:47');
  assert.deepEqual(h.upload.facts(), { takenAt: NIGHT(21, 47), takenSource: 'manual' });
  assert.equal(takenLine(h.html()), '拍摄于 21:47');
  assert.equal(takenNote(h.html()), '你填写的时间');
  await h.upload.pick(photo());                                                                  // a trusted time
  type('2026-09-26T21:50');
  assert.deepEqual(h.upload.facts(), { takenAt: NIGHT(21, 50), takenSource: 'manual' });
  type('2026-09-26T21:50:30');
  assert.equal(h.upload.facts().takenAt, NIGHT(21, 50, 30));
  assert.ok(h.rec.changes > 0);
});

test('time: a typed value out of range is explained, not sent and not silently dropped', async () => {
  installModel();
  installImaging();
  const h = harness();
  const container = fakeContainer();
  h.upload.bind(container);
  await h.upload.pick(photo());
  for (const bad of ['1999-12-31T23:59', '2999-01-01T00:00', '2026-02-30T21:47']) {
    container.emit('input', { name: 'takenAt', value: bad });
    const html = h.html();
    assert.deepEqual(h.upload.facts(), {}, `${bad} is not sent`);
    assert.equal(takenLine(html), '暂无可用的拍摄时间');
    assert.equal(plain(region(html, 'data-taken-error')), TIME_OUT_OF_RANGE.replace(/\u00a0/g, ' '));
    assert.doesNotMatch(el(html, 'data-taken-error'), / hidden/);
    assert.match(timeField(html), /aria-invalid="true" aria-describedby="moment-taken-error"/);
    assert.match(timeField(html), new RegExp(`value="${bad}"`), 'what was typed stays in the field');
  }
  container.emit('input', { name: 'takenAt', value: '2026-09-26T21:47' });
  assert.equal(plain(region(h.html(), 'data-taken-error')), '');
  assert.match(el(h.html(), 'data-taken-error'), / hidden/);
  assert.doesNotMatch(timeField(h.html()), /aria-invalid/);
});

test('time: clearing the field means no time at all (neither key is sent), even over a trusted EXIF time', async () => {
  installModel();
  installImaging();
  const h = harness();
  const container = fakeContainer();
  h.upload.bind(container);
  await h.upload.pick(photo());
  assert.equal(h.upload.facts().takenAt, NIGHT(21, 47, 50));
  container.emit('input', { name: 'takenAt', value: '' });
  const facts = h.upload.facts();
  assert.equal('takenAt' in facts, false);
  assert.equal('takenSource' in facts, false);
  assert.equal(takenLine(h.html()), '没读到拍摄时间（截图或转发的图常会丢失）');
  assert.match(timeField(h.html()), /value=""/, 'cleared stays cleared');
});

test('time: 修改时间 opens the field with the current time in it', async () => {
  installModel();
  installImaging();
  const h = harness();
  const container = fakeContainer();
  h.upload.bind(container);
  await h.upload.pick(photo());
  assert.match(h.html(), /data-taken-field hidden/);
  container.emit('click', control({ takenEdit: '' }));
  const html = h.html();
  assert.doesNotMatch(html, /data-taken-field hidden/);
  assert.match(el(html, 'data-taken-edit'), / hidden/, 'the button steps aside');
  assert.match(plain(html), /修改拍摄时间 · 北京时间/);
  assert.match(plain(html), /改过的时间以你填的为准。/);
});

test('demo-only time: one press sets the example night\'s time as manual, labelled so; a second press undoes it', async () => {
  installModel();
  installImaging();
  const h = harness();
  const container = fakeContainer();
  h.upload.bind(container);
  await h.upload.pick(photo({ bytes: exifJpeg({ original: '2025-07-10T10:53:00', offset: '+08:00' }) }));
  assert.equal(takenLine(h.html()), '拍摄于 2025年7月10日 10:53');
  assert.match(plain(h.html()), /这个时间不在示例现场那一晚（2026\.09\.26），按规则不算同一刻。/, 'the form says it is not the same moment');
  assert.equal(plain(region(h.html(), 'data-demo-time')), DEMO_TIME.label);
  assert.match(el(h.html(), 'data-demo-time'), /aria-pressed="false"/);
  assert.deepEqual(h.upload.facts(), { takenAt: Date.parse('2025-07-10T10:53:00+08:00'), takenSource: 'exif' });

  container.emit('click', control({ demoTime: '' }));
  assert.deepEqual(h.upload.facts(), { takenAt: DEMO_TIME.ms, takenSource: 'manual' });
  assert.equal(takenLine(h.html()), '拍摄于 21:47');
  assert.equal(takenNote(h.html()), '你填写的时间 · 演示用');
  assert.match(el(h.html(), 'data-demo-time'), /aria-pressed="true"/);
  assert.match(plain(region(h.html(), 'data-demo-time')), /已把拍摄时间设成 21:47（演示用）· 再按一次撤销/);
  assert.doesNotMatch(plain(h.html()), /不算同一刻/, 'and now it is');

  container.emit('click', control({ demoTime: '' }));
  assert.deepEqual(h.upload.facts(), { takenAt: Date.parse('2025-07-10T10:53:00+08:00'), takenSource: 'exif' }, 'undone: the photo\'s own time is back');
  assert.equal(takenLine(h.html()), '拍摄于 2025年7月10日 10:53');
});

test('demo-only time: typing replaces it, it undoes to what was typed before, and it also works over "no time"', async () => {
  installModel();
  installImaging();
  const h = harness();
  const container = fakeContainer();
  h.upload.bind(container);
  await h.upload.pick(photo({ bytes: PLAIN_JPEG, lastModified: 0 }));
  container.emit('click', control({ demoTime: '' }));
  assert.deepEqual(h.upload.facts(), { takenAt: DEMO_TIME.ms, takenSource: 'manual' });
  container.emit('input', { name: 'takenAt', value: '2026-09-26T22:00' });
  assert.deepEqual(h.upload.facts(), { takenAt: NIGHT(22, 0), takenSource: 'manual' });
  assert.equal(takenNote(h.html()), '你填写的时间', 'typing took the demo label away');
  assert.match(el(h.html(), 'data-demo-time'), /aria-pressed="false"/);
  container.emit('click', control({ demoTime: '' }));
  container.emit('click', control({ demoTime: '' }));
  assert.deepEqual(h.upload.facts(), { takenAt: NIGHT(22, 0), takenSource: 'manual' }, 'off again: back to what was typed');
});

test('demo-only time: absent without a demoTime, and not offered on an example photo that already carries its time', async () => {
  installModel();
  installImaging();
  const none = harness({ demoTime: null });
  await none.upload.pick(photo());
  assert.doesNotMatch(none.html(), /data-demo-time/);
  none.upload.bind(fakeContainer());
  const h = harness();
  await h.upload.pickSample('sample-crowd');
  assert.doesNotMatch(h.html(), /data-demo-time/);
  await h.upload.pick(photo());
  assert.match(h.html(), /data-demo-time/);
  const invalid = harness({ demoTime: { ms: 5, label: 'x', note: 'y' } });
  await invalid.upload.pick(photo());
  assert.doesNotMatch(invalid.html(), /data-demo-time/, 'a demo time that is not a usable time is ignored');
});

test('the "not the same moment" sentence belongs to the demo only', async () => {
  installModel();
  installImaging();
  const room = harness({ demoTime: null, samples: [] });
  await room.upload.pick(photo({ bytes: exifJpeg({ original: '2025-07-10T10:53:00', offset: '+08:00' }) }));
  assert.doesNotMatch(plain(room.html()), /不算同一刻/);
});

// ============================================================================================================================
// the viewpoint: chips, the model's suggestion, and who decided
// ============================================================================================================================
test('sure: the chip is pre-selected, tagged 「AI 判断：人海」 and saved as ai when left alone', async () => {
  const model = installModel();
  installImaging();
  const h = harness();
  await h.upload.pick(photo());
  await until(() => h.upload.facts().viewpoint, 'the model\'s answer');
  const html = h.html();
  assert.deepEqual(pressedChips(html), ['crowd']);
  assert.deepEqual(suggestedChips(html), []);
  assert.equal(aiLine(html), 'AI 判断：人海');
  assert.ok(html.includes(`title="${AI_NOTE}"`), 'the tag carries the promise that the photo is judged on this device');
  assert.deepEqual(h.upload.facts(), { takenAt: NIGHT(21, 47, 50), takenSource: 'exif', viewpoint: 'crowd', viewpointSource: 'ai' });
  assert.equal(model.classified.length, 1);
  assert.match(model.classified[0], /^data:image\/jpeg;base64,/, 'the model sees the redrawn picture that will be saved');
  assert.deepEqual(h.rec.busy, [true, false]);
  assert.equal(h.upload.requiresViewpoint(), false);
});

test('sure, in the Node product, says what is uploaded and when', async () => {
  installModel();
  installImaging();
  const h = harness({ uploadsToServer: true, samples: [], demoTime: null });
  await h.upload.pick(photo());
  await until(() => h.upload.facts().viewpoint, 'the model\'s answer');
  const photoWords = text => text.replace('保存现场卡时', '保存照片时');
  assert.ok(AI_NOTE_ROOM.includes('保存现场卡时才上传照片'), 'the shared sentence is still the source');
  assert.ok(h.html().includes(`title="${photoWords(AI_NOTE_ROOM)}"`), 'in this form what is saved is a photo, not a 现场卡');
  assert.ok(plain(h.html()).includes(photoWords(viewpointHint({ upload: true }))));
  assert.ok(plain(h.html()).includes('判断时照片不上传；保存照片时才上传照片。没把握就不替你选，选了也随时可改。'));
  assert.doesNotMatch(plain(h.html()), /现场卡/);
});

test('sure, then ANY chip press makes it the person\'s own choice: manual, even for the very chip the model picked', async () => {
  installModel();
  installImaging();
  const h = harness();
  const container = fakeContainer();
  h.upload.bind(container);
  await h.upload.pick(photo());
  await until(() => h.upload.facts().viewpoint, 'the model\'s answer');
  container.emit('click', control({ momentViewpoint: 'crowd' }));                                // the same one: confirmed by hand
  assert.deepEqual([h.upload.facts().viewpoint, h.upload.facts().viewpointSource], ['crowd', 'manual']);
  assert.equal(aiLine(h.html()), '', 'the AI tag is gone: it is no longer the model\'s pick');
  assert.deepEqual(pressedChips(h.html()), ['crowd']);
  container.emit('click', control({ momentViewpoint: 'stage' }));
  assert.deepEqual([h.upload.facts().viewpoint, h.upload.facts().viewpointSource], ['stage', 'manual']);
  assert.deepEqual(pressedChips(h.html()), ['stage']);
  container.emit('click', control({ momentViewpoint: 'not-a-side' }));
  assert.equal(h.upload.facts().viewpoint, 'stage', 'an unknown side is ignored');
});

test('unsure: nothing is selected, two dashed suggestions point to a spoken description, and nothing is saved until the person chooses', async () => {
  const model = installModel();
  installImaging();
  model.result = { ok: true, sure: false, label: 'friends', top2: ['friends', 'stage'] };
  const h = harness();
  await h.upload.pick(photo());
  await until(() => h.idle() && aiLine(h.html()) !== 'AI 在本机判断视角…', 'the model\'s answer');
  const html = h.html();
  assert.deepEqual(pressedChips(html), []);
  assert.deepEqual(suggestedChips(html), ['stage', 'friends'], 'the two the model named, in the order the chips are drawn');
  for (const id of ['friends', 'stage']) assert.match(chip(html, id), /aria-describedby="moment-viewpoint-likely"/);
  for (const id of ['crowd', 'detail']) assert.doesNotMatch(chip(html, id), /aria-describedby/);
  assert.match(html, new RegExp(`<span class="sr-only" id="moment-viewpoint-likely">${SUGGESTED_DESCRIPTION}</span>`));
  assert.equal(aiLine(html), '不确定，请选择，AI 认为更可能是身边或舞台');
  assert.match(html, /moment-ai-tag moment-ai-tag--unsure">不确定，请选择</);
  assert.deepEqual(h.upload.facts(), { takenAt: NIGHT(21, 47, 50), takenSource: 'exif' }, 'no viewpoint, no source');
  assert.equal(h.upload.requiresViewpoint(), false, 'an own photo may be saved without one');
  const container = fakeContainer();
  h.upload.bind(container);
  container.emit('click', control({ momentViewpoint: 'stage' }));
  assert.deepEqual(suggestedChips(h.html()), [], 'the suggestions go once the person has chosen');
  assert.doesNotMatch(h.html(), /moment-viewpoint-likely/);
  assert.deepEqual([h.upload.facts().viewpoint, h.upload.facts().viewpointSource], ['stage', 'manual']);
});

test('silent: a model that gives no answer leaves the chips empty and says nothing about AI, and nothing is shown as an error', async () => {
  const model = installModel();
  installImaging();
  model.result = { ok: false, error: 'infer', top2: [], sure: false };
  const h = harness();
  await h.upload.pick(photo());
  await until(() => h.rec.busy.length === 2, 'the model to be done');
  const html = h.html();
  assert.deepEqual(pressedChips(html), []);
  assert.deepEqual(suggestedChips(html), []);
  assert.equal(aiLine(html), '');
  assert.deepEqual(h.rec.errors, [], 'a model that does not answer is never an error toast');
  assert.deepEqual(h.upload.facts(), { takenAt: NIGHT(21, 47, 50), takenSource: 'exif' });
  assert.deepEqual(h.rec.busy, [true, false]);
});

test('a model that fails to load is the manual state, not an error', async () => {
  const model = installModel();
  installImaging();
  model.hold = true;
  const h = harness();
  await h.upload.pick(photo());
  await until(() => model.status === 'loading', 'the model to start loading');
  assert.equal(aiLine(h.html()), 'AI 在本机判断视角…');
  assert.deepEqual(h.rec.busy, [true]);
  model.finish({ fail: true });
  await until(() => h.rec.busy.length === 2, 'the load to end');
  assert.equal(aiLine(h.html()), AI_OFF_LINES.failed, 'one honest line, in place of every AI sentence');
  assert.doesNotMatch(plain(h.html()), /AI 在本机判断，/);
  assert.deepEqual(h.rec.errors, []);
  assert.deepEqual(pressedChips(h.html()), []);
});

test('the download is said once, its percent moves, and the line is never empty while the person waits', async () => {
  const model = installModel();
  installImaging();
  model.hold = true;
  const h = harness();
  await h.upload.pick(photo());
  await until(() => model.status === 'loading', 'the model to start loading');
  assert.equal(aiLine(h.html()), 'AI 在本机判断视角…');
  model.report({ loaded: 200, total: 1000 });
  await until(() => /首次需下载模型/.test(aiLine(h.html())), 'the download words');
  assert.match(aiLine(h.html()), /^AI 在本机判断视角 · 首次需下载模型（约 10–23 MB） · 20%$/);
  model.report({ loaded: 640, total: 1000 });
  assert.match(aiLine(h.html()), / · 64%$/);
  assert.match(h.html(), /data-ai-key="loading"/);
  model.report({ loaded: 1000, total: 1000 });
  assert.equal(aiLine(h.html()), 'AI 在本机判断视角…', 'every byte is here; what is left is starting the model');
  model.finish();
  await until(() => h.upload.facts().viewpoint === 'crowd', 'the answer');
});

test('a late answer never overwrites the person\'s choice, and one that arrives after a reset is dropped', async () => {
  const model = installModel();
  installImaging();
  model.holdAnswer = true;
  const h = harness();
  const container = fakeContainer();
  h.upload.bind(container);
  await h.upload.pick(photo());
  await until(() => model.classified.length === 1, 'the model call');
  container.emit('click', control({ momentViewpoint: 'detail' }));
  model.release();
  await until(() => h.rec.busy.at(-1) === false, 'the late answer');
  assert.deepEqual(pressedChips(h.html()), ['detail']);
  assert.deepEqual([h.upload.facts().viewpoint, h.upload.facts().viewpointSource], ['detail', 'manual']);
  assert.equal(aiLine(h.html()), '', 'and it says nothing about itself either');

  // saving never waits for the model: the facts are taken now, with no viewpoint; the answer after the save is ignored
  await h.upload.pick(photo());
  await until(() => model.classified.length === 2, 'the second call');
  const saved = h.upload.facts();
  assert.equal('viewpoint' in saved, false);
  h.upload.reset();
  const calls = h.rec.changes;
  model.release();
  await nextTick(); await nextTick();
  assert.deepEqual(h.upload.facts(), {});
  assert.equal(pressedChips(h.html({ draft: { roomId: ROOM, dataUrl: DATA_URL } })).length, 0);
  assert.equal(h.rec.changes, calls, 'a cancelled call makes no further noise');
  assert.equal(h.rec.busy.at(-1), false);
});

test('a chip pressed before the answer keeps the model from filling anything, even when it is sure', async () => {
  const model = installModel();
  installImaging();
  model.holdAnswer = true;
  model.result = { ok: true, sure: true, label: 'stage', top2: ['stage', 'crowd'] };
  const h = harness();
  const container = fakeContainer();
  h.upload.bind(container);
  await h.upload.pick(photo());
  await until(() => model.classified.length === 1, 'the model call');
  container.emit('click', control({ momentViewpoint: 'friends' }));
  model.release();
  await until(() => h.rec.busy.at(-1) === false, 'the answer');
  assert.deepEqual(pressedChips(h.html()), ['friends']);
  assert.deepEqual(h.upload.facts().viewpointSource, 'manual');
});

test('onBusy is true while a model download or inference runs for the current photo, and false when it ends or is cancelled', async () => {
  const model = installModel();
  installImaging();
  model.holdAnswer = true;
  const h = harness();
  await h.upload.pick(photo());
  await until(() => model.classified.length === 1, 'the model call');
  assert.deepEqual(h.rec.busy, [true]);
  await h.upload.pick(photo());                                          // a new photo cancels the old call: busy ends, then begins again
  await until(() => model.classified.length === 2, 'the second call');
  assert.deepEqual(h.rec.busy, [true, false, true]);
  h.upload.reset();
  assert.deepEqual(h.rec.busy, [true, false, true, false]);
  model.release();
});

test('a browser that cannot run the model gets one honest sentence instead of every AI sentence, and chips to choose by hand', async () => {
  const model = installModel();
  installImaging();
  for (const [why, line] of [['browser', AI_OFF_LINES.unsupported], ['page', AI_OFF_LINES.page]]) {
    model.supported = false;
    model.why = why;
    const h = harness();
    await h.upload.pick(photo());
    const page = h.html();
    assert.equal(aiLine(page), line);
    assert.equal(plain(region(page, 'data-viewpoint-hint')), '配对时，用它来找互补的那一面。', 'the hint loses its AI part');
    assert.doesNotMatch(plain(page), /AI 在本机判断|AI 判断|AI 认为|不确定，请选择|首次需下载/);
    assert.doesNotMatch(page, /moment-viewpoint-likely/);
    assert.equal(model.classified.length, 0);
    assert.deepEqual(h.rec.errors, []);
    assert.equal(page.match(/AI/g)?.length, line.match(/AI/g).length, 'the only AI wording is the one sentence');
  }
});

test('with the model available the hint carries the AI promise, in the demo and in the room', () => {
  installModel();
  const demo = harness().upload.markup({ draft: { roomId: ROOM, dataUrl: DATA_URL }, roomId: ROOM });
  assert.equal(plain(region(demo, 'data-viewpoint-hint')), '配对时，用它来找互补的那一面。AI 在本机判断，照片不上传，没把握就不替你选，选了也随时可改。');
  const room = harness({ uploadsToServer: true }).upload.markup({ draft: { roomId: ROOM, dataUrl: DATA_URL }, roomId: ROOM });
  assert.equal(plain(region(room, 'data-viewpoint-hint')), '配对时，用它来找互补的那一面。AI 在本机判断，判断时照片不上传；保存照片时才上传照片。没把握就不替你选，选了也随时可改。');
});

// ============================================================================================================================
// facts, the lifecycle, and the guard on an example without a side
// ============================================================================================================================
test('facts() returns only keys that have a value, in a fixed shape', async () => {
  const model = installModel();
  installImaging();
  model.result = { ok: false, error: 'infer', top2: [], sure: false };
  const h = harness();
  assert.deepEqual(h.upload.facts(), {});
  await h.upload.pick(photo({ bytes: PLAIN_JPEG, lastModified: 0 }));
  assert.deepEqual(h.upload.facts(), {});
  const container = fakeContainer();
  h.upload.bind(container);
  container.emit('click', control({ momentViewpoint: 'detail' }));
  assert.deepEqual(Object.keys(h.upload.facts()), ['viewpoint', 'viewpointSource']);
  container.emit('input', { name: 'takenAt', value: '2026-09-26T21:47' });
  assert.deepEqual(Object.keys(h.upload.facts()), ['takenAt', 'takenSource', 'viewpoint', 'viewpointSource']);
  for (const value of Object.values(h.upload.facts())) assert.ok(value !== null && value !== undefined && value !== '');
  assert.equal(h.upload.facts().takenAt, NIGHT(21, 47));
  assert.equal(Number.isInteger(h.upload.facts().takenAt), true);
});

test('the facts belong to this room: another room sees none', async () => {
  installModel();
  installImaging();
  const h = harness();
  await h.upload.pick(photo());
  assert.ok(h.upload.facts().takenAt);
  h.where.room = 'room-2';
  assert.deepEqual(h.upload.facts(), {});
  assert.equal(h.upload.requiresViewpoint(), false);
  const html = h.upload.markup({ draft: { roomId: 'room-2', dataUrl: DATA_URL }, roomId: 'room-2' });
  assert.deepEqual(pressedChips(html), []);
  assert.equal(takenLine(html), '没读到拍摄时间（截图或转发的图常会丢失）', 'the other room\'s photo is not described with this one\'s time');
});

test('requiresViewpoint(): an example is the current draft and no side is chosen; own photos may be saved without one', async () => {
  const model = installModel();
  installImaging();
  model.result = { ok: true, sure: false, label: 'stage', top2: ['stage', 'crowd'] };
  const h = harness();
  const container = fakeContainer();
  h.upload.bind(container);
  assert.equal(h.upload.requiresViewpoint(), false, 'nothing picked');
  await h.upload.pick(photo());
  assert.equal(h.upload.requiresViewpoint(), false, 'an own photo');
  await h.upload.pickSample('sample-stage');
  assert.equal(h.upload.requiresViewpoint(), true, 'an example, unsure, nothing chosen');
  container.emit('click', control({ momentViewpoint: 'stage' }));
  assert.equal(h.upload.requiresViewpoint(), false);
  model.result = { ok: true, sure: true, label: 'crowd', top2: ['crowd', 'stage'] };
  model.holdAnswer = true;
  const asked = model.classified.length;
  await h.upload.pickSample('sample-crowd');
  await until(() => model.classified.length === asked + 1, 'the model call');
  assert.equal(h.upload.requiresViewpoint(), true, 'while the model has not answered yet');
  model.release();
  await until(() => h.upload.facts().viewpoint === 'crowd', 'the model\'s answer');
  assert.equal(h.upload.requiresViewpoint(), false, 'a sure answer pre-selected a side');
  h.upload.reset();
  assert.equal(h.upload.requiresViewpoint(), false);
});

test('nudge() highlights the chips and says what is missing, with and without the AI sentence; choosing clears it', async () => {
  const model = installModel();
  installImaging();
  model.result = { ok: true, sure: false, label: 'stage', top2: ['stage', 'crowd'] };
  const h = harness();
  const container = fakeContainer();
  h.upload.bind(container);
  assert.equal(h.upload.nudge(container), false, 'nothing to nudge about before a photo');
  await h.upload.pickSample('sample-stage');
  const changes = h.rec.changes;
  assert.equal(h.upload.nudge(container), true);
  assert.ok(h.rec.changes > changes, 'the page is told');
  let html = h.html();
  assert.equal(plain(region(html, 'data-viewpoint-nudge')), NUDGE);
  for (const id of ['stage', 'crowd', 'friends', 'detail']) assert.ok(classes(chip(html, id)).includes('is-nudged'));
  container.emit('click', control({ momentViewpoint: 'crowd' }));
  html = h.html();
  assert.equal(plain(region(html, 'data-viewpoint-nudge')), '');
  assert.equal(classes(chip(html, 'stage')).includes('is-nudged'), false);

  model.supported = false; model.why = 'browser';
  await h.upload.pickSample('sample-stage');
  h.upload.nudge(container);
  assert.equal(plain(region(h.html(), 'data-viewpoint-nudge')), '先选一个视角。没有视角，就找不到同一刻的另一面。', 'no AI words when there is no AI');
  await h.upload.pick(photo());
  assert.equal(plain(region(h.html(), 'data-viewpoint-nudge')), '', 'a new photo starts without the nudge');
});

test('nudge() moves focus to the chips and scrolls the message into view when there is a page', async () => {
  installModel();
  installImaging();
  const h = harness();
  const container = fakeContainer();
  h.upload.bind(container);
  await h.upload.pickSample('sample-stage');
  const focused = [];
  const message = { getBoundingClientRect: () => ({ height: 20, bottom: 900, top: 880 }), closest: () => null, scrollIntoView: options => focused.push(['scroll', options.block]) };
  Object.assign(globalThis, { window: { innerHeight: 800 } });
  globalThis.document.documentElement = {};
  const dom = { matches: () => false, querySelector: selector => (selector === '[data-moment-viewpoint]' ? { focus: options => focused.push(['focus', options.preventScroll]) } : selector === '[data-viewpoint-nudge]' ? message : null) };
  h.upload.nudge(dom);
  assert.deepEqual(focused, [['focus', true], ['scroll', 'center']]);
  delete globalThis.window;
});

test('restore(facts) brings a saved draft\'s time and side back; a photo that is live in this page is more accurate and stays', async () => {
  installModel();
  installImaging();
  const h = harness();
  assert.equal(h.upload.restore({}), false);
  assert.equal(h.upload.restore(null), false);
  assert.equal(h.upload.restore({ takenAt: 5, takenSource: 'exif', viewpoint: 'nope' }), false, 'nothing usable');
  assert.equal(h.upload.restore({ takenAt: NIGHT(21, 47), takenSource: 'manual', viewpoint: 'stage', viewpointSource: 'manual' }), true);
  assert.deepEqual(h.upload.facts(), { takenAt: NIGHT(21, 47), takenSource: 'manual', viewpoint: 'stage', viewpointSource: 'manual' });
  const html = h.upload.markup({ draft: { roomId: ROOM, dataUrl: DATA_URL }, roomId: ROOM });
  assert.deepEqual(pressedChips(html), ['stage']);
  assert.equal(takenNote(html), '你填写的时间');
  assert.equal(h.upload.restore({ viewpoint: 'detail', viewpointSource: 'manual' }), false, 'live state wins');
  assert.equal(h.upload.facts().viewpoint, 'stage');
  h.upload.reset();
  assert.equal(h.upload.restore({ takenAt: NIGHT(22, 0), takenSource: 'exif', viewpoint: 'crowd', viewpointSource: 'ai' }), true);
  assert.deepEqual(h.upload.facts(), { takenAt: NIGHT(22, 0), takenSource: 'exif', viewpoint: 'crowd', viewpointSource: 'ai' }, 'an AI pre-selection left untouched comes back as one');
  assert.equal(h.upload.restore({ takenAt: Date.parse('1999-01-01'), takenSource: 'exif' }), false);
});

test('reset() forgets the photo and cancels the model call; it and restore() are the page\'s own calls, so they do not call onChange', async () => {
  const model = installModel();
  installImaging();
  model.holdAnswer = true;
  const h = harness();
  await h.upload.pick(photo());
  await until(() => model.classified.length === 1, 'the model call');
  const changes = h.rec.changes;
  h.upload.reset();
  assert.equal(h.rec.changes, changes, 'the page is not told: it called reset() and draws the form itself');
  h.upload.restore({ viewpoint: 'stage', viewpointSource: 'manual' });
  assert.equal(h.rec.changes, changes);
  h.upload.reset();
  assert.deepEqual(h.upload.facts(), {});
  assert.equal(h.rec.busy.at(-1), false);
  assert.doesNotMatch(plain(h.html({ draft: null })), /拍摄于/);
  model.release();
});

test('eventDate may be a function: times on that day print as a clock, others with their date', async () => {
  installModel();
  installImaging();
  let date = '2026.09.26';
  const h = harness({ eventDate: () => date });
  await h.upload.pick(photo());
  assert.equal(takenLine(h.html()), '拍摄于 21:47');
  date = '2026.09.27';
  assert.equal(takenLine(h.html()), '拍摄于 9月26日 21:47');
  date = '';
  assert.equal(takenLine(h.html()), '拍摄于 9月26日 21:47');
  const broken = harness({ eventDate: () => { throw new Error('no room yet'); } });
  assert.doesNotThrow(() => broken.upload.markup({ draft: null, roomId: ROOM }));
});

test('a callback that throws never breaks the form, and a draft the page could not take is an error to show', async () => {
  installModel();
  installImaging();
  const rec = { errors: [] };
  const h = harness({ onChange: () => { throw new Error('page bug'); }, onBusy: () => { throw new Error('page bug'); }, onError: error => rec.errors.push(error.message) });
  const container = fakeContainer();
  h.upload.bind(container);
  assert.equal(await h.upload.pick(photo()), true);
  await until(() => h.upload.facts().viewpoint, 'the answer');
  assert.doesNotThrow(() => container.emit('click', control({ momentViewpoint: 'stage' })));
  assert.doesNotThrow(() => h.upload.reset());
  const refusing = harness({ onDraft: () => { throw new Error('草稿没能保存'); } });
  assert.equal(await refusing.upload.pick(photo()), true, 'the photo is read; the page\'s failure to keep it is reported');
  assert.equal(refusing.rec.errors[0].message, '草稿没能保存');
  const noisy = createMomentUpload({ getRoomId: () => { throw new Error('boom'); }, onError: () => { throw new Error('boom'); } });
  assert.deepEqual(noisy.facts(), {});
  assert.equal(await noisy.pickSample('x'), false, 'and an error handler that throws is survived too');
});

// ============================================================================================================================
// bind / patch
// ============================================================================================================================
test('bind(container) listens to click, change, input and keydown once, and its unbind removes them all', async () => {
  installModel();
  installImaging();
  const h = harness();
  const container = fakeContainer();
  const unbind = h.upload.bind(container);
  assert.deepEqual([...container.listeners.keys()].sort(), ['change', 'click', 'input', 'keydown']);
  assert.equal(container.count(), 4);
  h.upload.bind(container);                                              // binding again replaces, it does not stack
  assert.equal(container.count(), 4);
  unbind();
  assert.equal(container.count(), 0);
  unbind();
  const bare = fakeContainer({ removable: false });
  const again = h.upload.bind(bare);                                     // a container without removeEventListener (the binding harness's) still works
  assert.doesNotThrow(() => again());
  assert.equal(typeof h.upload.bind(null), 'function');
});

test('Enter in the time field does not save the photo: it only ends the typing', () => {
  installModel();
  const h = harness();
  const container = fakeContainer();
  h.upload.bind(container);
  const prevented = [];
  const press = (key, name) => container.emit('keydown', { name }, { key, preventDefault: () => prevented.push(`${key}:${name}`) });
  press('Enter', 'takenAt');
  press('Enter', 'visibility');
  press('a', 'takenAt');
  assert.deepEqual(prevented, ['Enter:takenAt']);
  assert.doesNotThrow(() => container.emit('keydown', { name: 'takenAt' }, { key: 'Enter' }), 'an event without preventDefault is survived');
});

test('a chosen file goes to pick() and the input is cleared so the same file can be chosen again', async () => {
  installModel();
  installImaging();
  const h = harness();
  const container = fakeContainer();
  h.upload.bind(container);
  const input = { name: 'photo', files: [photo()], value: 'C:\\fakepath\\a.jpg' };
  container.emit('change', input);
  await until(() => h.rec.drafts.length === 1, 'the draft');
  assert.equal(input.value, '');
  container.emit('change', { name: 'photo', files: [], value: '' });
  container.emit('change', { name: 'other', files: [photo()] });
  await nextTick();
  assert.equal(h.rec.drafts.length, 1);
});

test('clicking an example photo picks it; clicking the file input warms the model up', async () => {
  const model = installModel();
  installImaging();
  const h = harness();
  const container = fakeContainer();
  h.upload.bind(container);
  container.emit('click', control({ samplePhoto: 'sample-crowd' }));
  await until(() => h.rec.drafts.length === 1, 'the example');
  assert.equal(h.rec.drafts[0].visibility, 'members');
  const loads = model.loads;
  container.emit('click', { name: 'photo', type: 'file', closest: () => null });
  assert.equal(model.loads, loads + 1, 'the picker is about to open: the model is asked for now');
  container.emit('click', control({ takenEdit: '' }));
  assert.equal(model.loads, loads + 1, 'no other click does that');
});

test('warmUp() fetches the model, except on a connection that asked to save data, and tells the page when the fetch ends', async () => {
  const model = installModel();
  const h = harness();
  const changes = h.rec.changes;
  h.upload.warmUp();
  await until(() => h.rec.changes > changes, 'the page to be told');
  assert.equal(model.loads, 1);

  const saver = installModel();
  Object.defineProperty(globalThis.navigator, 'connection', { value: { saveData: true }, configurable: true });
  try {
    harness().upload.warmUp();
    assert.equal(saver.loads, 0, 'nothing is fetched on a data saver');
  } finally { delete globalThis.navigator.connection; }

  const unsupported = installModel();
  unsupported.supported = false; unsupported.why = 'browser';
  harness().upload.warmUp();
  assert.equal(unsupported.loads, 0);
});

test('patch() updates the AI line, chips and time rows in place and touches nothing else', async () => {
  const model = installModel();
  installImaging();
  model.result = { ok: true, sure: false, label: 'friends', top2: ['friends', 'stage'] };
  const dom = fakeForm();
  const h = harness();
  const container = fakeContainer();
  container.querySelector = selector => (selector === 'form[data-form="upload"]' ? dom.form : null);
  h.upload.bind(container);
  await h.upload.pick(photo({ bytes: exifJpeg({ original: '2025-07-10T10:53:00', offset: '+08:00' }) }));
  await until(() => h.rec.busy.length === 2, 'the answer');
  const { nodes, chips } = dom;
  const chipOf = id => chips.find(node => node.getAttribute('data-moment-viewpoint') === id);

  // the time rows
  assert.equal(nodes['[data-taken-line]'].textContent, '拍摄于 2025年7月10日 10:53');
  assert.equal(nodes['[data-taken-line]'].getAttribute('data-taken-none'), null, 'a time came: the line is the clock again');
  assert.equal(nodes['[data-taken-note]'].textContent, '来自照片自带的信息');
  assert.equal(nodes['[data-taken-sep]'].hidden, false, 'the 「 · 」 between clock and note is there while there is a note');
  assert.equal(nodes['[data-taken-edit]'].hidden, false);
  assert.equal(nodes['[data-taken-edit]'].getAttribute('aria-expanded'), 'false');
  assert.equal(nodes['[data-taken-field]'].hidden, true);
  assert.equal(nodes['input[name="takenAt"]'].value, '2025-07-10T10:53');
  assert.equal(nodes['[data-taken-off]'].textContent, '这个时间不在示例现场那一晚（2026.09.26），按规则不算同一刻。');
  assert.equal(nodes['[data-taken-error]'].hidden, true);
  assert.equal(nodes['[data-demo-time]'].getAttribute('aria-pressed'), 'false');
  // the chips: two dashed, nothing pressed, a description inserted once
  assert.deepEqual(chips.map(node => node.getAttribute('aria-pressed')), ['false', 'false', 'false', 'false']);
  assert.equal(chipOf('friends').classList.contains('is-suggested'), true);
  assert.equal(chipOf('stage').classList.contains('is-suggested'), true);
  assert.equal(chipOf('friends').getAttribute('aria-describedby'), 'moment-viewpoint-likely');
  assert.equal(chipOf('crowd').getAttribute('aria-describedby'), null);
  assert.deepEqual(nodes['.moment-chips'].inserted.map(([where]) => where), ['afterend']);
  assert.ok(nodes['.moment-chips'].inserted[0][1].includes(SUGGESTED_DESCRIPTION));
  // the line and the hint
  assert.equal(nodes['[data-ai-line]'].getAttribute('data-ai-key'), 'unsure:friends,stage');
  assert.match(nodes['[data-ai-line]'].html, /不确定，请选择/);
  assert.match(nodes['[data-viewpoint-hint]'].textContent, /^配对时，用它来找互补的那一面。AI 在本机判断/);
  assert.equal(nodes['[data-pick-status]'].textContent, '');

  // the nudge, then a press: the chip, the line, the description, and the nudge goes
  h.upload.nudge(container);
  assert.equal(nodes['[data-viewpoint-nudge]'].textContent, NUDGE);
  assert.equal(chipOf('detail').classList.contains('is-nudged'), true);
  const key = nodes['[data-ai-line]'].getAttribute('data-ai-key');
  container.emit('click', control({ momentViewpoint: 'detail' }));
  assert.equal(chipOf('detail').getAttribute('aria-pressed'), 'true');
  assert.equal(chipOf('detail').classList.contains('is-selected'), true);
  assert.equal(chipOf('friends').classList.contains('is-suggested'), false);
  assert.equal(chipOf('friends').getAttribute('aria-describedby'), null);
  assert.equal(nodes['[data-viewpoint-nudge]'].textContent, '');
  assert.notEqual(nodes['[data-ai-line]'].getAttribute('data-ai-key'), key);
  assert.equal(nodes['[data-ai-line]'].html, '');
  // the description is taken away again once nobody needs it
  nodes['#moment-viewpoint-likely'] = fakeNode();
  h.upload.patch(container);
  assert.equal(nodes['#moment-viewpoint-likely'].removed, true);
  // the example marks follow the example that was picked
  await h.upload.pickSample('sample-stage');
  assert.deepEqual(dom.samples.map(node => node.getAttribute('aria-pressed')), ['false', 'true']);
  assert.equal(dom.samples[1].classList.contains('is-current'), true);
  assert.equal(dom.samples[0].classList.contains('is-current'), false);
  // a status line while something is being read
  const pending = h.upload.pick(photo());
  assert.equal(nodes['[data-pick-status]'].textContent, '正在处理照片…');
  await pending;
  assert.equal(nodes['[data-pick-status]'].textContent, '');
  assert.deepEqual(dom.samples.map(node => node.getAttribute('aria-pressed')), ['false', 'false']);
});

test('patch() writes a typed time into the field only when it differs, so the cursor is never disturbed', async () => {
  installModel();
  installImaging();
  const dom = fakeForm();
  const h = harness();
  const events = fakeContainer();
  events.querySelector = selector => (selector === 'form[data-form="upload"]' ? dom.form : null);
  h.upload.bind(events);
  await h.upload.pick(photo());
  const input = dom.nodes['input[name="takenAt"]'];
  let writes = 0;
  let current = input.value;
  Object.defineProperty(input, 'value', { get: () => current, set: value => { writes += 1; current = value; }, configurable: true });
  current = '2026-09-26T21:5';                                                                 // the browser has the text in the field already...
  events.emit('input', { name: 'takenAt', value: current });                                   // ...when it says so
  h.upload.patch(events);
  assert.equal(writes, 0, 'the field already shows what the person typed');
  events.emit('click', control({ demoTime: '' }));
  h.upload.patch(events);
  assert.equal(current, '2026-09-26T21:47', 'the demo time is written when it changes');
  assert.equal(writes, 1);
  assert.equal(dom.nodes['[data-demo-time]'].textContent, '已把拍摄时间设成 21:47（演示用）· 再按一次撤销');
});

test('patch() does nothing, and breaks nothing, on a page that has no upload form (or no DOM at all)', async () => {
  installModel();
  installImaging();
  const h = harness();
  const bare = fakeContainer();
  assert.equal(h.upload.patch(bare), false);                              // the binding harness's body: querySelector() finds nothing
  assert.equal(h.upload.patch(null), false);
  assert.equal(h.upload.patch(undefined), false);
  h.upload.bind(bare);
  await h.upload.pick(photo());
  assert.equal(h.upload.nudge(bare), true, 'nudge needs no DOM either');
  assert.doesNotThrow(() => h.upload.reset());
});

// ============================================================================================================================
// space-ai.js: where ai/ lives
// ============================================================================================================================
async function modelUrls(page) {
  const seen = [];
  const realFetch = globalThis.fetch;
  const realWarn = console.warn;
  globalThis.fetch = async url => { seen.push(String(url)); throw new Error('stop here: the first asset URL is all this test needs'); };
  console.warn = () => {};
  try {
    globalThis.document = page.document;
    globalThis.location = { protocol: 'https:' };
    globalThis.createImageBitmap = () => {};
    const fresh = (await import(`../web/js/ai/space-ai.js?asset-dir-${page.tag}`)).getViewpointAI();
    assert.equal(fresh.supported(), true);
    await fresh.load();
    assert.equal(fresh.status(), 'failed');
  } finally { globalThis.fetch = realFetch; console.warn = realWarn; }
  return seen;
}

test('space-ai.js reads where ai/ lives from <meta name="space-ai-base">, lazily, relative to the page', async () => {
  const meta = content => ({ baseURI: 'https://example.test/event-room/?room=ABC#x', querySelector: selector => (selector === 'meta[name="space-ai-base"]' ? { content } : null) });
  assert.deepEqual(await modelUrls({ tag: 'up', document: meta('../ai/') }), ['https://example.test/ai/tc8/labels.json']);
  assert.deepEqual(await modelUrls({ tag: 'abs', document: meta('/musicSpace/ai/') }), ['https://example.test/musicSpace/ai/tc8/labels.json']);
  assert.deepEqual(await modelUrls({ tag: 'slash', document: meta('../ai') }), ['https://example.test/ai/tc8/labels.json'], 'a missing trailing slash is added');
});

test('space-ai.js keeps its default ./ai/ for a bare document, a page without the tag and an empty tag', async () => {
  assert.deepEqual(await modelUrls({ tag: 'bare', document: { baseURI: 'https://example.test/space/' } }), ['https://example.test/space/ai/tc8/labels.json']);
  assert.deepEqual(await modelUrls({ tag: 'none', document: { baseURI: 'https://example.test/space/', querySelector: () => null } }), ['https://example.test/space/ai/tc8/labels.json']);
  assert.deepEqual(await modelUrls({ tag: 'empty', document: { baseURI: 'https://example.test/space/', querySelector: () => ({ content: '  ' }) } }), ['https://example.test/space/ai/tc8/labels.json']);
  assert.deepEqual(await modelUrls({ tag: 'throws', document: { baseURI: 'https://example.test/space/', querySelector: () => { throw new Error('no'); } } }), ['https://example.test/space/ai/tc8/labels.json']);
});

test('the stamped test JPEG really carries the time the tests say it does', async () => {
  const found = await readCaptureTime(photo({ bytes: exifJpeg({ original: '2026-09-26T21:47:50', offset: '+08:00' }) }));
  assert.equal(found.local, '2026-09-26T21:47:50');
  assert.equal(found.offset, '+08:00');
  assert.equal(found.epochMs, NIGHT(21, 47, 50));
  assert.equal((await readCaptureTime(photo({ bytes: exifJpeg({ dateTime: '2026-09-26T21:47:50' }) }))).source, 'DateTime');
  assert.equal(await readCaptureTime(photo({ bytes: PLAIN_JPEG })), null);
});

test('the module imports only the shared pieces it is allowed to, and loads without a page', () => {
  const source = readFileSync(new URL('../web/event-room/moment-upload.js', import.meta.url), 'utf8');
  const imports = [...source.matchAll(/^import [^;]*? from '([^']+)';$/gms)].map(match => match[1]);
  assert.deepEqual(imports.sort(), ['../avatar/model.js', '../js/moment.js', '../js/photo-insight.js']);
  assert.doesNotMatch(source, /\bwindow\b|localStorage|sessionStorage|indexedDB|XMLHttpRequest|navigator\./, 'nothing in it reaches for the page, storage or the network');
  assert.doesNotMatch(source, /\bfetch\(/);
  // the pairing words are not here: the module only reads times and records sides
  assert.doesNotMatch(source, /readPair|orderWall|SAME_MOMENT_MS|同一刻 ·/);
  const css = readFileSync(new URL('../web/event-room/moment-upload.css', import.meta.url), 'utf8');
  const selectors = css.replace(/\/\*[\s\S]*?\*\//g, '').split('{').slice(0, -1).map(part => part.split('}').pop().trim()).filter(selector => selector && !selector.startsWith('@'));
  for (const selector of selectors) assert.ok(selector.split(',').every(part => part.trim().startsWith('form.moment-upload')), `every rule is scoped to the form: ${selector}`);
  assert.doesNotMatch(css, /font-size:\s*(?:[0-9]|1[01])(?:\.\d+)?px/, 'no text under 12 px');
});
