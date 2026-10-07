/**
 * The words the static (GitHub Pages) build puts into the event room, where the Node room server would say something else.
 *
 * `copy` is read by web/event-room/app.js through t(key, existingLiteral): a key missing here leaves the server wording in place.
 * It has exactly these keys (a test fails when one is added or dropped without the other):
 *
 *   statusReady            header pill once the in-page room is ready
 *   statusPreparing        header pill while the room is being laid out
 *   reconnectLabel         the reconnect button
 *   reconnectToast         its toast
 *   presenceTitleLobby     landing card, not yet in the room
 *   presenceCopyLobby      landing card text: a GETTER, the AI sentence is included only while aiAvailable() is true at render time
 *   presenceTitleAlone     in the room, nobody else yet
 *   presenceCopyAlone
 *   presenceTitleRoom      in the room with others
 *   presenceCopyRoom
 *   joinLabelLobby         the #join button before entering
 *   joinLabelRoom          the #join button inside the room (it opens the room panel)
 *   trackNote
 *   evidenceButton         the footer button that opens the About panel
 *   nonHttpToast           opened from a file: page
 *   keepRoomInUrl          true: the address keeps exactly ?room=CODE so a reload comes back to the room
 *   pollMs                 how often the page re-reads the room (the in-page cast answers within seconds)
 *   exchangePollMs         the same for the exchange panel
 *
 * Copy rules (user decision 2026-10-07): the product speaks as a finished app. The one sentence that says what the online edition is
 * made of lives in the About panel (about-panel.js) and nowhere else; no label here says sample, fiction or demo. AI only suggests a
 * viewpoint and is mentioned only while the browser can run it; the wall's pairing is never called AI. The server wording this build
 * must never show, and the demo words, are listed in the test (tests/static-demo-ui.test.js), which scans these files and what they render.
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
const WALL_SENTENCE = '照片墙帮你找到同一刻的另一面，双方同意就交换。';

/** `aiAvailable` is injectable so a test can drive both states; the default asks the real classifier each time the text is read. */
export function createCopy({ aiAvailable = modelCanRun } = {}) {
  return {
    statusReady: '现场进行中',
    statusPreparing: '正在布置现场…',
    reconnectLabel: '重新连接',
    reconnectToast: '已重新连接',
    presenceTitleLobby: '同一刻，另一面。',
    get presenceCopyLobby() { return LEAD + (aiAvailable() ? AI_SENTENCE : '') + WALL_SENTENCE; },
    presenceTitleAlone: '先留下你的这一晚。',
    presenceCopyAlone: '放一张照片，看看你拍到的是哪一面。',
    presenceTitleRoom: '同一晚，各自的视角。',
    presenceCopyRoom: '先放一张你的照片，看看你拍到的是哪一面。',
    joinLabelLobby: '进入现场',
    joinLabelRoom: '本场信息',
    trackNote: '本场原创声景',
    evidenceButton: '关于 Music Space',
    nonHttpToast: '请用网址打开 Music Space',
    keepRoomInUrl: true,
    pollMs: 2000,
    exchangePollMs: 2000,
  };
}

export const copy = createCopy();

// ---- shared strings the other demo modules use (not part of `copy`, which app.js reads by key) -------------------------------

/** The question asked before 「重新开始」 wipes this browser's data of the site. */
export const RESET_CONFIRM = '重新开始会清除你的昵称、小人、照片和交换，确定吗？';

/** The two banners the boot code shows (kept here so About repeats the same words). */
export const MEMORY_ONLY_NOTE = '这个浏览器不能保存，刷新后会重新开始';
export const READ_ONLY_NOTE = '已在另一个标签页打开，这里只能看';

/** The upload form's one-tap capture-time button (static build only): its label, and the note the time row shows once it is pressed. */
export const DEMO_TIME_COPY = Object.freeze({
  label: '把拍摄时间设成 21:47',
  note: '你填写的时间',
});

/** The two bundled photos the tour offers when it is not told otherwise. The crowd photo comes first: the model is sure about it. */
export const TOUR_SAMPLES = Object.freeze([
  Object.freeze({ id: 'sample-crowd', label: '人海那张' }),
  Object.freeze({ id: 'sample-stage', label: '舞台那张' }),
]);

/** What the finished tour points at (all of them exist in this build). */
export const TOUR_MORE = Object.freeze(['我的空间', '乐迷社群', '专辑世界杯', '一起玩', '音乐探索']);
