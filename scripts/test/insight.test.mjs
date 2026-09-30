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
assert.ok(loading.startsWith(`<span>${P.AI_LOADING}<span data-ai-percent aria-hidden="true"> · 25%</span></span>`));
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

console.log('insight: all assertions passed');
