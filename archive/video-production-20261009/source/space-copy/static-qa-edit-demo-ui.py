import sys
p='/Users/alakazan/workplace/tme/musicSpace/tests/static-demo-ui.test.js'
s=open(p,encoding='utf-8').read()
def rep(a,b,count=1):
    global s
    n=s.count(a)
    assert n==count, (n, a[:90])
    s=s.replace(a,b)

# header + imports
rep("""// What the static (GitHub Pages) build shows that the server product does not: copy, entry panel, About, the example route and the
// profile.demo assembly (web/static-runtime/showcase/{copy,entry-panel,about-panel,tour,demo-hooks}.js and demo.css).""",
"""// What the static (GitHub Pages) build shows that the server product does not: copy, entry panel, About, the 「第一次来」 card and the
// profile.demo assembly (web/static-runtime/showcase/{copy,entry-panel,about-panel,tour,demo-hooks}.js and demo.css), plus the audit of
// every word they (and the seeded people) can say: no server wording, and no demo wording outside the one About sentence.""")
rep("""import { copy, createCopy, COPY_KEYS, CAST_LABEL, RESET_CONFIRM, MEMORY_ONLY_NOTE, READ_ONLY_NOTE, DEMO_TIME_COPY, TOUR_SAMPLES, TOUR_MORE } from '../web/static-runtime/showcase/copy.js';""",
"""import * as copyModule from '../web/static-runtime/showcase/copy.js';
import { copy, createCopy, COPY_KEYS, RESET_CONFIRM, MEMORY_ONLY_NOTE, READ_ONLY_NOTE, DEMO_TIME_COPY, TOUR_SAMPLES, TOUR_MORE } from '../web/static-runtime/showcase/copy.js';""")
rep("""import { createDemoProfile, randomAvatar, randomName } from '../web/static-runtime/showcase/demo-hooks.js';""",
"""import { createDemoProfile, randomAvatar, randomName } from '../web/static-runtime/showcase/demo-hooks.js';
import { ROOM as SEEDED_ROOM, NPCS, SAMPLE_PHOTOS } from '../web/static-runtime/showcase/roster.js';
import * as npcLines from '../web/static-runtime/showcase/npc-lines.js';
import { TEXT as BOOT_TEXT } from '../web/static-runtime/boot.js';
import { READ_ONLY_MESSAGE } from '../web/static-runtime/runtime.js';
import { rescueScript } from '../scripts/build/static-html-plugin.mjs';""")

rep("""const WITH_AI = '同一晚，你拍了舞台，TA 拍了人海。AI 在本机给你一个视角建议，规则帮你找到同一刻的另一面，双方同意才交换。';
const WITHOUT_AI = '同一晚，你拍了舞台，TA 拍了人海。规则帮你找到同一刻的另一面，双方同意才交换。';

// Phrases the static build must never show: server wording that is false here (the design's list and the five the build transform
// rewrites elsewhere), plus claims about real users or a launch. A character disclaimer such as 「不是真人」 is not on the list.
const BANNED = ['房间服务已连接', '上传至', '服务器已确认', '服务已收到', '邀请同场朋友', '真实房间',
  '服务已确认', '结果按服务器当前票数决定', '停止等待不会撤销服务器操作', 'AI 认出', '已上线', '正式上线', '真实用户', '真实观众'];
""",
"""const WITH_AI = '同一晚，你拍了舞台，TA 拍了人海。AI 在本机给你一个视角建议，照片墙帮你找到同一刻的另一面，双方同意就交换。';
const WITHOUT_AI = '同一晚，你拍了舞台，TA 拍了人海。照片墙帮你找到同一刻的另一面，双方同意就交换。';

// Phrases the static build must never show: server wording that is false here (the design's list, the three confirmations the build
// transform rewrites elsewhere and two sentences the panels dropped), plus claims about real users or a launch.
const BANNED = ['房间服务已连接', '上传至', '服务器已确认', '服务已收到', '邀请同场朋友', '真实房间',
  '服务已确认', '结果按服务器当前票数决定', '停止等待不会撤销服务器操作', 'AI 认出', '已上线', '正式上线', '真实用户', '真实观众'];

// The product says what the online edition is made of exactly once, in this sentence of the About panel, and nowhere else (owner decision
// 2026-10-07). DEMO_WORDS are the words that sentence may use and nothing else may.
const DISCLOSURE = '在线版里的场地、观众和照片是演示内容，观众会自动回复。';
const DEMO_WORDS = /示例|虚构|模拟|演示|自动回复|不是真人|在本页运行|没有服务器|只存在这个浏览器/;
const PEOPLE = ['阿遥', '小满', '北屿', '林间'];
""")

rep("""const WORLD = { people: {
  yao: { id: 'u-yao', token: 'SECRET-TOKEN-yao', npc: { key: 'yao', name: '阿遥·示例' } },
  man: { id: 'u-man', token: 'SECRET-TOKEN-man', npc: { key: 'man', name: '小满·示例' } },
  bei: { id: 'u-bei', token: 'SECRET-TOKEN-bei', npc: { key: 'bei', name: '北屿·示例' } },
  lin: { id: 'u-lin', token: 'SECRET-TOKEN-lin', npc: { key: 'lin', name: '林间·示例' } },
}, room: { id: 'room-1', code: 'ABCDEFGHIJKL' } };
const SAMPLES = [{ id: 'sample-crowd', label: '人海 · 示例照片', note: 'n1', thumbUrl: './demo/sample-crowd.jpg' }, { id: 'sample-stage', label: '舞台 · 示例照片', note: 'n2', thumbUrl: './demo/sample-stage.jpg' }];""",
"""const WORLD = { people: {
  yao: { id: 'u-yao', token: 'SECRET-TOKEN-yao', npc: { key: 'yao', name: '阿遥' } },
  man: { id: 'u-man', token: 'SECRET-TOKEN-man', npc: { key: 'man', name: '小满' } },
  bei: { id: 'u-bei', token: 'SECRET-TOKEN-bei', npc: { key: 'bei', name: '北屿' } },
  lin: { id: 'u-lin', token: 'SECRET-TOKEN-lin', npc: { key: 'lin', name: '林间' } },
}, room: { id: 'room-1', code: 'ABCDEFGHIJKL' } };
const SAMPLES = [{ id: 'sample-crowd', label: '人海那张', thumbUrl: './demo/sample-crowd.jpg' }, { id: 'sample-stage', label: '舞台那张', thumbUrl: './demo/sample-stage.jpg' }];""")

# copy values
rep("""    statusReady: '示例现场 · 在本页运行',
    statusPreparing: '正在布置示例现场…',
    reconnectLabel: '重新连接示例现场',
    reconnectToast: '示例现场已就绪',""",
"""    statusReady: '现场进行中',
    statusPreparing: '正在布置现场…',
    reconnectLabel: '重新连接',
    reconnectToast: '已重新连接',""")
rep("""    joinLabelLobby: '进入示例现场',
    joinLabelRoom: '本场与示例说明',
    trackNote: '原创示例声景 · 不代表真实演出',
    evidenceButton: '示例站 · 数据只存在这个浏览器 · 关于这个示例',
    nonHttpToast: '请通过网址打开；离线 HTML 无法运行示例现场',""",
"""    joinLabelLobby: '进入现场',
    joinLabelRoom: '本场信息',
    trackNote: '本场原创声景',
    evidenceButton: '关于 Music Space',
    nonHttpToast: '请用网址打开 Music Space',""")

rep("""test('the shared strings say what they are for', () => {
  assert.equal(CAST_LABEL, '示例角色 · 自动回复');
  assert.match(RESET_CONFIRM, /清除/);
  assert.match(RESET_CONFIRM, /确定/);
  assert.equal(MEMORY_ONLY_NOTE, '示例数据只保存在本页，刷新会重置');
  assert.equal(READ_ONLY_NOTE, '示例已在另一个标签页打开，这里不能操作');
  assert.deepEqual({ ...DEMO_TIME_COPY }, { label: '演示用：把拍摄时间设成示例现场的 21:47', note: '你填写的时间 · 演示用' });
  assert.deepEqual(TOUR_SAMPLES.map(sample => [sample.id, sample.label]), [['sample-crowd', '人海 · 示例照片'], ['sample-stage', '舞台 · 示例照片']]);
  assert.deepEqual([...TOUR_MORE], ['我的空间', '音乐社群', '专辑世界杯', '一起玩', '音乐探索']);
});""",
"""test('the shared strings say what they are for', () => {
  assert.equal('CAST_LABEL' in copyModule, false, 'no label marks the seeded people any more');
  assert.equal(RESET_CONFIRM, '重新开始会清除你的昵称、小人、照片和交换，确定吗？');
  assert.equal(MEMORY_ONLY_NOTE, '这个浏览器不能保存，刷新后会重新开始');
  assert.equal(READ_ONLY_NOTE, '已在另一个标签页打开，这里只能看');
  assert.deepEqual({ ...DEMO_TIME_COPY }, { label: '把拍摄时间设成 21:47', note: '你填写的时间' });
  assert.deepEqual(TOUR_SAMPLES.map(sample => [sample.id, sample.label]), [['sample-crowd', '人海那张'], ['sample-stage', '舞台那张']]);
  assert.deepEqual(TOUR_SAMPLES.map(sample => [sample.id, sample.label]), SAMPLE_PHOTOS.map(sample => [sample.id, sample.label]), 'the tour offers the roster\\'s own photos by the same names');
  assert.deepEqual([...TOUR_MORE], ['我的空间', '乐迷社群', '专辑世界杯', '一起玩', '音乐探索']);
});""")

# corpus
rep("""  for (const [name, value] of Object.entries({ CAST_LABEL, RESET_CONFIRM, MEMORY_ONLY_NOTE, READ_ONLY_NOTE, ...DEMO_TIME_COPY })) add(`copy.js ${name}`, value);""",
"""  for (const [name, value] of Object.entries({ RESET_CONFIRM, MEMORY_ONLY_NOTE, READ_ONLY_NOTE, ...DEMO_TIME_COPY })) add(`copy.js ${name}`, value);""")
rep("""  for (const known of [null, { name: '访客1', avatar }]) for (const preparing of [false, true]) for (const castNames of [[], ['阿遥·示例', '小满·示例']]) for (const participation of ['open', 'quiet']) {""",
"""  for (const known of [null, { name: '访客1', avatar }]) for (const preparing of [false, true]) for (const castNames of [[], ['阿遥', '小满']]) for (const participation of ['open', 'quiet']) {""")
rep("""    add(`about persistent=${persistent} readOnly=${readOnly} ai=${ai} channel=${channel}`, aboutMarkup({ build: BUILD, castNames: ['阿遥·示例', '小满·示例', '北屿·示例', '林间·示例'], persistent, channel, readOnly, ai }));""",
"""    add(`about persistent=${persistent} readOnly=${readOnly} ai=${ai} channel=${channel}`, aboutMarkup({ build: BUILD, castNames: PEOPLE, persistent, channel, readOnly, ai }));""")
rep("""  const flags = [false, true];
  for (const photo of flags) for (const other of flags) for (const exchange of flags) for (const people of flags) for (const collapsed of flags) {
    const progress = tourProgress({ stage: 'room', ownPhotos: photo ? 1 : 0, hasPairing: other, exchanges: { total: exchange ? 1 : 0 }, friends: people ? 1 : 0, panel: null }, { seenWall: other });
    add(`tour ${[photo, other, exchange, people, collapsed]}`, tourMarkup({ progress, collapsed, esc }));
  }
  return out;
}""",
"""  const flags = [false, true];
  for (const photo of flags) for (const other of flags) for (const exchange of flags) for (const people of flags) for (const collapsed of flags) {
    const progress = tourProgress({ stage: 'room', ownPhotos: photo ? 1 : 0, hasPairing: other, exchanges: { total: exchange ? 1 : 0 }, friends: people ? 1 : 0, panel: null }, { seenWall: other });
    add(`tour ${[photo, other, exchange, people, collapsed]}`, tourMarkup({ progress, collapsed, esc }));
  }
  return out;
}

/** What the seeded people, the boot and the rescue overlay say: names, the room, the lines, the photo labels, banners, toasts, errors. */
function spoken() {
  const out = new Map();
  const add = (label, text) => out.set(label, String(text));
  add('roster ROOM', `${SEEDED_ROOM.title} ${SEEDED_ROOM.venue}`);
  for (const npc of NPCS) { add(`roster ${npc.key} name`, npc.name); if (npc.line) add(`roster ${npc.key} line`, npc.line); }
  for (const sample of SAMPLE_PHOTOS) add(`roster sample ${sample.id}`, Object.values(sample).join(' '));
  for (const [name, value] of Object.entries(npcLines)) if (typeof value !== 'function') add(`npc-lines ${name}`, JSON.stringify(value));
  for (const [name, value] of Object.entries(BOOT_TEXT)) add(`boot TEXT.${name}`, value);
  add('runtime READ_ONLY_MESSAGE', READ_ONLY_MESSAGE);
  add('rescue overlay', rescueScript());
  return out;
}""")

rep("""test('AI words appear only where the model may be spoken of', () => {""",
"""test('no demo word appears anywhere but in the one About sentence, and that sentence is in About only, exactly once', () => {
  const corpus = new Map([...everything(), ...spoken()]);
  assert.ok(corpus.size > 120, 'the audit covers the rendered states and the exports');
  for (const [label, text] of corpus) {
    const about = /^about/.test(label);
    assert.equal(text.split(DISCLOSURE).length - 1, about ? 1 : 0, `${label}: the disclosure ${about ? 'exactly once' : 'never'}`);
    const rest = text.replace(DISCLOSURE, '');
    assert.doesNotMatch(rest, DEMO_WORDS, `${label} says 「${rest.match(DEMO_WORDS)?.[0]}」`);
    for (const word of ['不代表', '不是到场认证', '原件仍归', '不订阅营销', '规则判断', '分身', '核对', '原操作', '原请求', '长期空间', '本地体验版']) assert.ok(!rest.includes(word), `${label} says 「${word}」`);
  }
  for (const npc of NPCS) assert.doesNotMatch(npc.name, /·|示例/, `${npc.key} is named plainly`);
});

test('AI words appear only where the model may be spoken of', () => {""")

# entry markup tests
rep("""  assert.match(html, /我愿意向本场成员（示例角色）展示我的昵称和小人。数据只存在这个浏览器里。/);
  assert.match(html, /<input type="radio" name="participation" value="open" checked>/);
  assert.doesNotMatch(html, /value="quiet" checked/);
  assert.match(html, /value="quiet"/);
  assert.match(html, /愿意打招呼<small>别人可以招手；成为朋友仍需我明确接受。<\\/small>/);
  assert.match(html, /安静参与<small>照样保存和分享照片，不接收新招呼。<\\/small>/);
  assert.match(html, /<small class="eyebrow">示例现场 · 回声现场（虚构）<\\/small><h2>带上小人，进入示例现场<\\/h2>/);
  assert.match(html, /<input name="name" maxlength="18" value="访客2468" autocomplete="nickname" required>/);
  assert.match(html, /<button type="button" class="quiet" data-open="wardrobe">现在换个造型 ↗<\\/button>/);
  assert.match(html, /<button class="primary" type="submit">进入示例现场<\\/button>/);
  assert.match(html, /<div class="demo-entry-actions"><label class="consent">[^]*?<\\/label><button class="primary" type="submit">[^<]*<\\/button><p class="fine demo-entry-status" role="status"><\\/p><\\/div>/, 'the consent, the button and its status line stay together (the sheet pins them to its bottom)');
  assert.match(html, /<button type="button" class="quiet" data-open="about">关于这个示例<\\/button>/);
  assert.match(html, /<details class="demo-entry-more"><summary>自己开个房<\\/summary>[\\s\\S]*data-open="create"/);
  assert.match(html, /没有服务器，也没有账号/);
  assert.match(html, /<div aria-hidden="true"><svg data-preview="1"><\\/svg><\\/div>/);
  assert.deepEqual(seen, [[avatar, { view: 'quarter', width: 92, height: 192 }]]);
  const paragraph = textOf(html.match(/<p>(同场的[\\s\\S]*?)<\\/p>/)[1]);
  assert.match(paragraph, /虚构/);
  assert.match(paragraph, /自动回复/);
  assert.match(paragraph, /不是真人/);
  assert.match(paragraph, /先放一张你的照片/);
});""",
"""  assert.match(html, /<label class="consent"><input name="consent" type="checkbox" required><span>我愿意向本场成员展示我的昵称和小人<\\/span><\\/label>/);
  assert.match(html, /<input type="radio" name="participation" value="open" checked>/);
  assert.doesNotMatch(html, /value="quiet" checked/);
  assert.match(html, /value="quiet"/);
  assert.match(html, /愿意打招呼<small>别人可以向我招手<\\/small>/);
  assert.match(html, /安静参与<small>照片照常分享，不接新招呼<\\/small>/);
  assert.match(html, /<small class="eyebrow">月台 Livehouse · 回声现场<\\/small><h2>带上小人，进入现场<\\/h2><p>进去后先放一张今晚的照片，看看你拍到的是哪一面。<\\/p>/);
  assert.match(html, /<input name="name" maxlength="18" value="访客2468" autocomplete="nickname" required>/);
  assert.match(html, /<p class="fine">入场后随时能换装。<\\/p>/);
  assert.match(html, /<button type="button" class="quiet" data-open="wardrobe">现在换个造型 ↗<\\/button>/);
  assert.match(html, /<button class="primary" type="submit">进入现场<\\/button>/);
  assert.match(html, /<div class="demo-entry-actions"><label class="consent">[^]*?<\\/label><button class="primary" type="submit">[^<]*<\\/button><p class="fine demo-entry-status" role="status"><\\/p><\\/div>/, 'the consent, the button and its status line stay together (the sheet pins them to its bottom)');
  assert.match(html, /<\\/div><button type="button" class="quiet" data-open="about">关于 Music Space<\\/button><details/, 'the About button follows the pinned footer: no fine print in between');
  assert.match(html, /<details class="demo-entry-more"><summary>我是 Livehouse \\/ 主办方，开个房<\\/summary><p class="fine">为每一场演出开一个房间；散场后，乐迷留在你的乐迷社群里。<\\/p><button type="button" class="quiet" data-open="create">开一个房间<\\/button><\\/details><\\/form>$/);
  assert.match(html, /<div aria-hidden="true"><svg data-preview="1"><\\/svg><\\/div>/);
  assert.deepEqual(seen, [[avatar, { view: 'quarter', width: 92, height: 192 }]]);
  assert.doesNotMatch(html, /虚构|自动回复|不是真人|没有服务器|示例/, 'the entry says nothing about what the room is made of');
  assert.equal(count(html, /class="fine"/g), 2, 'two short hints and no fine print: the look line and the host line');
});""")

rep("""test('entry markup: quiet default, preparing disables only the submit button, names are listed and escaped', () => {""",
"""test('entry markup: quiet default, preparing disables only the submit button, the nickname is escaped and nobody is named', () => {""")
rep("""  assert.match(preparing, /<button class="primary" type="submit" disabled>进入示例现场<\\/button>/);
  assert.match(preparing, /role="status">正在布置示例现场…<\\/p>/);""",
"""  assert.match(preparing, /<button class="primary" type="submit" disabled>进入现场<\\/button>/);
  assert.match(preparing, /role="status">正在布置现场…<\\/p>/);
  assert.equal(copy.statusPreparing, '正在布置现场…', 'the same words as the header pill');""")
rep("""  const hostile = entryMarkup({ esc, avatarSvg: () => '', defaults: { name: '"><script>alert(1)</script>', castNames: ['<img src=x onerror=alert(1)>', '小满·示例'] } });
  assert.doesNotMatch(hostile, /<script|<img/);
  assert.match(hostile, /value="&quot;&gt;&lt;script&gt;alert\\(1\\)&lt;\\/script&gt;"/);
  assert.match(hostile, /同场的&lt;img src=x onerror=alert\\(1\\)&gt;、小满·示例都是虚构的/);
  assert.match(entryMarkup({ esc, avatarSvg: () => '', defaults: { name: 'a' } }), /同场的几位示例角色都是虚构的/);
  assert.doesNotThrow(() => entryMarkup());""",
"""  const hostile = entryMarkup({ esc, avatarSvg: () => '', defaults: { name: '"><script>alert(1)</script>', castNames: ['<img src=x onerror=alert(1)>', '小满'] } });
  assert.doesNotMatch(hostile, /<script|<img/);
  assert.match(hostile, /value="&quot;&gt;&lt;script&gt;alert\\(1\\)&lt;\\/script&gt;"/);
  assert.doesNotMatch(hostile, /img src|小满/, 'names handed in are not listed: one of the people arrives only after the visitor');
  assert.equal(hostile, entryMarkup({ esc, avatarSvg: () => '', defaults: { name: '"><script>alert(1)</script>' } }));
  assert.doesNotThrow(() => entryMarkup());""")
rep("""  assert.match(html, /<input name="name" maxlength="18" value="阿晴" autocomplete="nickname" required readonly>/);
  assert.deepEqual(seen, [user.avatar]);
  assert.match(html, /已经有你的小人/);
});""",
"""  assert.match(html, /<input name="name" maxlength="18" value="阿晴" autocomplete="nickname" required readonly>/);
  assert.deepEqual(seen, [user.avatar]);
  assert.match(html, /<p class="fine">已经有你的小人了，直接带它进去。<\\/p>/);
});""")

rep("""test('enter(): nothing is called without consent === true', async () => {
  for (const consent of [false, undefined, null, 'on', 1, 'true', 0]) {
    const controller = fakeController();
    let awaited = false;
    const ready = { then(resolve) { awaited = true; resolve(); } };
    await assert.rejects(() => enter({ name: 'a', avatar: {}, participation: 'open', consent }, controller, { ready, roomCode: 'ABCDEFGHIJKL' }), error => error.code === 'JOIN_CONSENT_REQUIRED');""",
"""test('enter(): nothing is called without consent === true', async () => {
  for (const consent of [false, undefined, null, 'on', 1, 'true', 0]) {
    const controller = fakeController();
    let awaited = false;
    const ready = { then(resolve) { awaited = true; resolve(); } };
    await assert.rejects(() => enter({ name: 'a', avatar: {}, participation: 'open', consent }, controller, { ready, roomCode: 'ABCDEFGHIJKL' }), error => error.code === 'JOIN_CONSENT_REQUIRED' && error.message === '请先勾选同意，再进入现场。');""")
rep("""  await assert.rejects(() => enter({ name: 'a', avatar: {}, consent: true }, fakeController(), { ready: Promise.resolve(), roomCode: () => null }), error => error.code === 'SHOWCASE_NOT_READY');""",
"""  await assert.rejects(() => enter({ name: 'a', avatar: {}, consent: true }, fakeController(), { ready: Promise.resolve(), roomCode: () => null }), error => error.code === 'SHOWCASE_NOT_READY' && error.message === '现场还在布置，请稍后再试。');""")

rep("""  await host.establishIdentity({ name: '阿遥·示例', avatar: randomAvatar(() => 0.2) });""",
"""  await host.establishIdentity({ name: '阿遥', avatar: randomAvatar(() => 0.2) });""")
rep("""  assert.deepEqual(state.members.map(member => [member.name, member.participation]), [['阿遥·示例', 'open'], ['访客1234', 'quiet']]);""",
"""  assert.deepEqual(state.members.map(member => [member.name, member.participation]), [['阿遥', 'open'], ['访客1234', 'quiet']]);""")

open(p,'w',encoding='utf-8').write(s)
print('part 1 ok')
