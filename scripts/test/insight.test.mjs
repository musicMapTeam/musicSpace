// What the editors say about a picked photo (web/js/photo-insight.js) and why the on-device model may be absent (web/js/ai/space-ai.js).
// No browser and no model: a stand-in page and engine let the module believe it can run, and the words it chooses are checked.
// Plain node:assert: `npm test` or `node scripts/test/insight.test.mjs`.
import assert from 'node:assert/strict';

// ---- why the model cannot run: the page, or the browser -------------------------------------------------------------------
// Each import gets its own classifier (the query string makes a new module instance), and each asks its questions once.
const freshAi = async (tag, page) => {
  globalThis.document = { baseURI: 'https://example.test/space/' };
  globalThis.location = { protocol: page };
  return (await import(`../../web/js/ai/space-ai.js?${tag}`)).getViewpointAI();
};
const opened = await freshAi('file', 'file:');
assert.equal(opened.supported(), false);
assert.equal(opened.whyUnsupported(), 'page'); // the same browser would run it from a URL: the words must not blame the browser
assert.equal(opened.status(), 'unsupported');

globalThis.createImageBitmap = undefined;
const noEngine = await freshAi('engine', 'https:');
assert.equal(noEngine.supported(), false);
assert.equal(noEngine.whyUnsupported(), 'browser');

globalThis.createImageBitmap = () => {};
const served = await freshAi('https', 'https:');
assert.equal(served.supported(), true);
assert.equal(served.whyUnsupported(), null);

// ---- the words ------------------------------------------------------------------------------------------------------------
const P = await import('../../web/js/photo-insight.js'); // imports the shared classifier, which sees an https page and an engine
assert.equal(P.aiState(), 'on');

// The demo keeps the photo on the device; a room uploads it when the card is saved, so only the judging may be called private there.
assert.equal(P.viewpointHint(), '配对时，用它来找互补的那一面。AI 在本机判断，照片不上传，没把握就不替你选，选了也随时可改。');
const roomHint = P.viewpointHint({ upload: true });
assert.equal(roomHint, '配对时，用它来找互补的那一面。AI 在本机判断，判断时照片不上传；保存现场卡时才上传照片。没把握就不替你选，选了也随时可改。');
assert.ok(!roomHint.includes('，照片不上传'), 'a room must not promise that the photo is never uploaded');
assert.equal(P.AI_NOTE_ROOM, 'AI 在本机判断，判断时照片不上传；保存现场卡时才上传照片');

// Every reason the model can be missing has its own true sentence.
assert.match(P.AI_OFF_LINES.page, /^从本地文件打开的页面用不了本机 AI/);
assert.ok(!P.AI_OFF_LINES.page.includes('浏览器'));
assert.match(P.AI_OFF_LINES.unsupported, /^这个浏览器用不了本机 AI/);
assert.match(P.AI_OFF_LINES.failed, /没能载入/);

// An answer: sure pre-selects one side; unsure names the two likeliest for a screen reader too (the dashed chips are for the eyes).
const sure = P.answerView({ ok: true, sure: true, label: 'crowd', top2: ['crowd', 'stage'] });
assert.deepEqual([sure.sure, sure.tag, sure.suggested, sure.spoken], [true, 'AI 判断：人海', ['crowd'], '']);
const unsure = P.answerView({ ok: true, sure: false, label: 'friends', top2: ['friends', 'stage'] });
assert.deepEqual([unsure.sure, unsure.tag, unsure.suggested], [false, '不确定，请选择', ['friends', 'stage']]);
assert.equal(unsure.spoken, '，AI 认为更可能是身边或舞台');
assert.equal(P.answerView({ ok: false }), null);
assert.equal(P.SUGGESTED_DESCRIPTION, 'AI 认为这一面更可能');

// The capture-time note: the plain source, or the sentence about a clock that is not Beijing time.
const card = { takenAt: Date.parse('2026-04-08T11:18:38+08:00'), takenSource: 'exif' };
assert.equal(P.timeView(card, '2026.09.26').note, '来自照片自带的信息');
const shifted = '已换算成北京时间，照片自带的是 4月7日 20:18（UTC−07:00）';
assert.deepEqual([P.timeView(card, '2026.09.26', { zone: shifted }).line, P.timeView(card, '2026.09.26', { zone: shifted }).note], ['拍摄于 4月8日 11:18', shifted]);
assert.equal(P.timeView({ ...card, takenSource: 'manual' }, '2026.09.26', { zone: shifted }).note, '你填写的时间'); // a time the person typed has no photo clock
assert.equal(P.timeView({ ...card, takenSource: 'file' }, '2026.09.26', { zone: shifted }).mode, 'guess');

// ---- the status line: announced once per phase, not once per percent ------------------------------------------------------
const loading = P.loadingMarkup('sp-ai-line', { loaded: 250, total: 1000 });
assert.ok(loading.startsWith('<span>AI 在本机判断视角 · 首次需下载模型<span class="nowrap">（约 10–23 MB）</span><span data-ai-percent aria-hidden="true"> · 25%</span></span>'));
assert.equal(loading.replace(/<[^>]*>/g, ''), `${P.AI_LOADING} · 25%`); // the words a screen reader hears are AI_LOADING (the percent is decoration)
assert.match(loading, /<span class="sp-ai-line__bar" aria-hidden="true"><i data-ai-fill style="width:25%"><\/i><\/span>$/);
assert.ok(P.loadingMarkup('sp-ai-line').includes('<span data-ai-percent aria-hidden="true"></span>')); // no bytes counted yet: no percent
const nodes = { '[data-ai-percent]': { textContent: '' }, '[data-ai-fill]': { style: {} } };
const line = { querySelector: selector => nodes[selector] || null };
assert.equal(P.moveLoading(line, { loaded: 500, total: 1000 }), true); // only the decoration moves
assert.equal(nodes['[data-ai-percent]'].textContent, ' · 50%');
assert.equal(nodes['[data-ai-fill]'].style.width, '50%');
assert.equal(P.moveLoading({ querySelector: () => null }, { loaded: 1, total: 2 }), false); // a line that shows something else is redrawn instead
let writes = 0;
const region = { set innerHTML(value) { writes += 1; this.html = value; } };
P.paintAiLine(region, '<span>a</span>');
P.paintAiLine(region, '<span>a</span>'); // the same words again would be announced again
assert.equal(writes, 1);
P.paintAiLine(region, '');
assert.equal(writes, 2);

// The download line names no size that depends on the host's compression (about 10 MB gzipped, about 23 MB as it is).
assert.equal(P.AI_LOADING, 'AI 在本机判断视角 · 首次需下载模型（约 10–23 MB）');
assert.ok(!P.AI_LOADING.includes('首次下载约 10 MB'));

// A typed time the page cannot use is named, not dropped in silence; an empty field and a usable time say nothing.
assert.equal(P.timeProblem(''), '');
assert.equal(P.timeProblem('2026-09-26T21:47'), '');
assert.equal(P.timeProblem('1999-12-31T23:59'), P.TIME_OUT_OF_RANGE);
assert.equal(P.timeProblem('2999-01-01T00:00'), P.TIME_OUT_OF_RANGE);
assert.equal(P.timeProblem('2026-02-30T21:47'), P.TIME_OUT_OF_RANGE);
assert.match(P.TIME_OUT_OF_RANGE, /2000\s年至明天/); // the space is a no-break space: a line never ends after "2000"

// ---- the status while the model is fetched: never empty from the moment a picture is handed over until the answer -----------
// The shared classifier is a plain object; a stand-in load lets the phases be watched without a browser or a model.
const model = (await import('../../web/js/ai/space-ai.js')).getViewpointAI();
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const watch = () => {
  const seen = [];
  const handle = P.identifyViewpoint('data:image/png;base64,AA==', state => seen.push(state.phase === 'loading' ? `loading ${state.loaded}/${state.total}` : state.phase));
  return { seen, handle };
};
let modelState = 'idle';
let progressNow = { loaded: 0, total: 0 };
let finish = () => {};
Object.assign(model, {
  status: () => modelState,
  progress: () => ({ ...progressNow }),
  load: onProgress => new Promise(resolve => {
    modelState = 'loading';
    finish = () => { modelState = 'ready'; resolve(); };
    model.report = state => { progressNow = state; onProgress(state); };
  }),
  classify: async () => ({ ok: true, sure: false, label: 'stage', top2: ['stage', 'crowd'] }),
});

// cold start, every byte already here (the picker's warm-up finished the download): "thinking" at once and no download words at all
progressNow = { loaded: 100, total: 100 };
let run = watch();
await pause(0);
assert.deepEqual(run.seen, ['thinking']);
await pause(450);
assert.deepEqual(run.seen, ['thinking']); // the delay passed and the download is not going on: the words stay
finish(); await pause(0);
assert.deepEqual(run.seen, ['thinking', 'thinking', 'done']);

// cold start with a download that lasts: "thinking" at once, the download words after a moment, "thinking" again when every byte is here
modelState = 'idle'; progressNow = { loaded: 0, total: 0 };
run = watch();
await pause(0);
assert.deepEqual(run.seen, ['thinking']);
model.report({ loaded: 20, total: 100 });
await pause(450);
assert.deepEqual(run.seen, ['thinking', 'loading 20/100']);
model.report({ loaded: 60, total: 100 });
assert.deepEqual(run.seen.at(-1), 'loading 60/100');
model.report({ loaded: 100, total: 100 });
assert.deepEqual(run.seen.at(-1), 'thinking'); // the rest is starting the model, not a download
finish(); await pause(0);
assert.deepEqual(run.seen.at(-2), 'thinking');
assert.equal(run.seen.at(-1), 'done');

// a model that is already there: no download words, and a cancelled request says nothing more
modelState = 'ready';
run = watch();
run.handle.cancel();
await pause(20);
assert.ok(!run.seen.some(phase => phase.startsWith('loading')));
assert.ok(!run.seen.includes('done'));

console.log('insight: all assertions passed');
