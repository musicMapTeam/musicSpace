/**
 * The words the static (GitHub Pages) build puts into the event room, where the Node room server would say something else.
 *
 * `copy` is read by web/event-room/app.js through t(key, existingLiteral): a key missing here leaves the server wording in place.
 * It has exactly these keys (a test fails when one is added or dropped without the other):
 *
 *   statusReady            header pill once the in-page room is ready
 *   statusPreparing        header pill while the fictional room is being built
 *   reconnectLabel         the reconnect button
 *   reconnectToast         its toast
 *   presenceTitleLobby     landing card, not yet in the room
 *   presenceCopyLobby      landing card text: a GETTER, the AI sentence is included only while aiAvailable() is true at render time
 *   presenceTitleAlone     in the room, nobody else yet
 *   presenceCopyAlone
 *   presenceTitleRoom      in the room with others
 *   presenceCopyRoom
 *   joinLabelLobby         the #join button before entering
 *   joinLabelRoom          the #join button inside the room (it opens the room panel, which explains the example)
 *   trackNote
 *   evidenceButton         the footer button that opens the About panel
 *   nonHttpToast           opened from a file: page
 *   keepRoomInUrl          true: the address keeps exactly ?room=CODE so a reload comes back to the room
 *   pollMs                 how often the page re-reads the room (the in-page cast answers within seconds)
 *   exchangePollMs         the same for the exchange panel
 *
 * Honesty (design 7.4): the cast is fictional and answers automatically, nothing is uploaded, AI only suggests a viewpoint and is
 * mentioned only while the browser can run it, pairing and reasons are rules. The server wording this build must never show is listed
 * in the test (tests/static-demo-ui.test.js), which scans these files and what they render.
 *
 * No fetch, no storage and no DOM at import time; nothing here imports from runtime-preview.
 */
import { aiAvailable as modelCanRun } from '../../js/photo-insight.js';

export const COPY_KEYS = Object.freeze([
  'statusReady', 'statusPreparing', 'reconnectLabel', 'reconnectToast',
  'presenceTitleLobby', 'presenceCopyLobby', 'presenceTitleAlone', 'presenceCopyAlone', 'presenceTitleRoom', 'presenceCopyRoom',
  'joinLabelLobby', 'joinLabelRoom', 'trackNote', 'evidenceButton', 'nonHttpToast', 'keepRoomInUrl', 'pollMs', 'exchangePollMs',
]);

const LEAD = '同一晚，你拍了舞台，TA 拍了人海。';
const AI_SENTENCE = 'AI 在本机给你一个视角建议，';
const RULES_SENTENCE = '规则帮你找到同一刻的另一面，双方同意才交换。';

/** `aiAvailable` is injectable so a test can drive both states; the default asks the real classifier each time the text is read. */
export function createCopy({ aiAvailable = modelCanRun } = {}) {
  return {
    statusReady: '示例现场 · 在本页运行',
    statusPreparing: '正在布置示例现场…',
    reconnectLabel: '重新连接示例现场',
    reconnectToast: '示例现场已就绪',
    presenceTitleLobby: '同一刻，另一面。',
    get presenceCopyLobby() { return LEAD + (aiAvailable() ? AI_SENTENCE : '') + RULES_SENTENCE; },
    presenceTitleAlone: '先留下你的这一晚。',
    presenceCopyAlone: '放一张照片，看看你拍到的是哪一面。',
    presenceTitleRoom: '同一晚，各自的视角。',
    presenceCopyRoom: '先放一张你的照片，看看你拍到的是哪一面。',
    joinLabelLobby: '进入示例现场',
    joinLabelRoom: '本场与示例说明',
    trackNote: '原创示例声景 · 不代表真实演出',
    evidenceButton: '示例站 · 数据只存在这个浏览器 · 关于这个示例',
    nonHttpToast: '请通过网址打开；离线 HTML 无法运行示例现场',
    keepRoomInUrl: true,
    pollMs: 2000,
    exchangePollMs: 2000,
  };
}

export const copy = createCopy();

// ---- shared strings the other demo modules use (not part of `copy`, which app.js reads by key) -------------------------------

/** Under a cast member's name in the people list. The names already end with 「·示例」; this says why they answer. */
export const CAST_LABEL = '示例角色 · 自动回复';

/** The question asked before 「重置示例」 wipes this browser's example data. */
export const RESET_CONFIRM = '重置会清除这个浏览器里的示例数据：你的昵称、小人、照片和交换，然后重新布置示例现场。确定要重置吗？';

/** The two banners the boot code shows (kept here so About repeats the same words). */
export const MEMORY_ONLY_NOTE = '示例数据只保存在本页，刷新会重置';
export const READ_ONLY_NOTE = '示例已在另一个标签页打开，这里不能操作';

/** The demo-only capture-time button of the upload form: the label and the note the person sees on the time row (design 7.1). */
export const DEMO_TIME_COPY = Object.freeze({
  label: '演示用：把拍摄时间设成示例现场的 21:47',
  note: '你填写的时间 · 演示用',
});

/** The two bundled sample photos the tour offers when it is not told otherwise. The crowd photo comes first: the model is sure about it. */
export const TOUR_SAMPLES = Object.freeze([
  Object.freeze({ id: 'sample-crowd', label: '人海 · 示例照片' }),
  Object.freeze({ id: 'sample-stage', label: '舞台 · 示例照片' }),
]);

/** What the finished tour points at (all of them exist in this build). */
export const TOUR_MORE = Object.freeze(['我的空间', '音乐社群', '专辑世界杯', '一起玩', '音乐探索']);
