p='/Users/alakazan/workplace/tme/musicSpace/tests/static-demo-ui.test.js'
s=open(p,encoding='utf-8').read()
def rep(a,b,count=1):
    global s
    n=s.count(a)
    assert n==count, (n, a[:90])
    s=s.replace(a,b)

start = s.index("test('About has every section, in order, with the facts the design lists', () => {")
end = s.index("test('About names why the model is absent in the product\\'s own sentence, and only then', async () => {")
new_about = r"""test('About has every section, in order, in the words of the plan', () => {
  const html = aboutMarkup({ build: BUILD, castNames: PEOPLE, persistent: true, channel: 'pages', readOnly: false, ai: 'on' });
  const headings = [...html.matchAll(/<section class="demo-about-section" data-about="([a-z]+)"><h3>([^<]+)<\/h3>/g)].map(match => [match[1], match[2]]);
  assert.deepEqual(headings, [...ABOUT_SECTIONS.map(([id, title]) => [id, title])]);
  assert.deepEqual(headings, [['what', '这是什么'], ['livehouse', '给 Livehouse'], ['ai', 'AI'], ['privacy', '隐私'], ['data', '在线版'], ['version', '版本']]);
  assert.ok(html.startsWith('<small class="eyebrow">同一刻，另一面</small><h2>关于 Music Space</h2><p class="demo-about-lead">同一晚，你拍了舞台，TA 拍了人海。Music Space 让这两面在同一个房间里相遇。</p><div class="demo-about">'));
  const section = id => html.match(new RegExp(`data-about="${id}"><h3>[^<]+</h3>([\\s\\S]*?)</section>`))[1];
  assert.equal(section('what'), '<p>同场的人带着手绘小人，走进同一个三维 Livehouse 房间。放一张今晚的照片，照片墙会把同一刻、拍到另一面的照片排在一起；双方都同意，就能交换。还能向同场的人招手、私聊，一起玩专辑世界杯。散场后，回顾和纪念卡都留着。</p>');
  assert.equal(section('livehouse'), '<p>为每一场演出开一个房间，乐迷带着小人入场。散场后，乐迷留在你的乐迷社群里，下一场的预告直接发到这里。</p>');
  assert.equal(section('ai'), '<p>放照片时，AI 在你的设备上建议它拍的是舞台、人海、身边还是细节；没把握就说「不确定」，由你来选。</p><p class="fine">第一次进入现场后，模型（约 10 MB）会在后台下载；开了省流量，就等你放照片时再下载。</p>');
  assert.equal(section('privacy'), '<p>不用真名，也不用手机号。照片给谁看由你决定，放进来时会缩小、去掉位置信息。交换照片、成为朋友，都要双方同意。</p>');
  assert.equal(section('data'), `<p>${DISCLOSURE}</p><button type="button" class="quiet demo-reset" data-demo-reset data-confirm="${esc(RESET_CONFIRM)}">重新开始</button>`);
  assert.equal(section('version'), '<p class="demo-about-stamp">版本 <code>0.22.0-rc.1</code> · 提交 <code>abc1234</code> · 构建于 <code>2026-10-06 02:15 UTC</code> · 渠道 <code>pages</code></p>');
  assert.match(textOf(section('version')), /^版本 0\.22\.0-rc\.1 · 提交 abc1234 · 构建于 2026-10-06 02:15 UTC · 渠道 pages$/);
  assert.equal(count(html, new RegExp(DISCLOSURE, 'g')), 1, 'the one disclosure of the product, once');
  assert.ok(html.endsWith('</section></div>'));
});

test('About keeps to the product: no cast, no photo source, no rule internals, no storage engine, no model name, no prototype, no link', () => {
  for (const ai of ['on', 'unsupported', 'page', 'failed']) for (const readOnly of [false, true]) for (const persistent of [true, false]) {
    const html = aboutMarkup({ build: BUILD, castNames: PEOPLE, persistent, channel: 'preview', readOnly, ai });
    const label = `ai=${ai} readOnly=${readOnly} persistent=${persistent}`;
    for (const name of PEOPLE) assert.ok(!html.includes(name), `${label}: names nobody (${name})`);
    for (const word of ['AI 图像', '生成', `${SAME_MOMENT_MS / 60_000} 分钟`, 'EXIF', 'IndexedDB', 'SQLite', 'WebAssembly', 'TinyCLIP', 'onnxruntime', 'int8', '早期原型', '0.16', '准确率', '规则计算']) assert.ok(!html.includes(word), `${label}: does not say ${word}`);
    assert.doesNotMatch(html, /href=|classic|<a\b/, `${label}: links nowhere`);
  }
});

test('About escapes the build stamp and the channel, and lists no names whatever it is given', () => {
  const html = aboutMarkup({ build: { version: '<b>1</b>', commit: '"><img src=x onerror=alert(1)>', builtAt: '<script>alert(2)</script>' }, castNames: ['<i>阿遥</i>'], channel: '<svg onload=alert(3)>', ai: 'on' });
  assert.doesNotMatch(html, /<script|<img|<svg|<b>|<i>/);
  for (const escaped of ['&lt;b&gt;1&lt;/b&gt;', '&quot;&gt;&lt;img src=x onerror=alert(1)&gt;', '&lt;script&gt;alert(2)&lt;/script&gt;', '&lt;svg onload=alert(3)&gt;']) assert.ok(html.includes(escaped), escaped);
  assert.ok(!html.includes('阿遥'), 'the castNames option is ignored');
  assert.doesNotThrow(() => aboutMarkup({ ai: 'on' }));
  assert.match(aboutMarkup({ ai: 'on' }), /<p class="demo-about-stamp">这次构建没有留下版本信息<\/p>/);
  assert.equal(aboutMarkup({ castNames: [], ai: 'on' }), aboutMarkup({ ai: 'on' }));
  assert.match(aboutMarkup({ build: { version: '1', builtAt: '2026-10-06' }, ai: 'on' }), /构建于 <code>2026-10-06<\/code>/);
});

test('About: the preview label, the memory-only warning, the other-tab note and the reset button', () => {
  const plain = aboutMarkup({ build: BUILD, channel: 'pages', ai: 'on' });
  assert.doesNotMatch(plain, /预览版/);
  assert.doesNotMatch(plain, /demo-about-warn/);
  assert.match(aboutMarkup({ build: BUILD, channel: 'preview', ai: 'on' }), /渠道 <code>preview<\/code> · <strong class="demo-about-channel">预览版<\/strong>：发布前的测试副本，不是最终版本<\/p>/);
  const memory = aboutMarkup({ persistent: false, ai: 'on' });
  assert.match(memory, /<p>在线版里的场地、观众和照片是演示内容，观众会自动回复。<\/p><p class="demo-about-warn" role="note">这个浏览器不能保存，刷新后会重新开始。<\/p><button/);
  const readOnly = aboutMarkup({ readOnly: true, ai: 'on' });
  assert.match(readOnly, /<p class="demo-about-warn" role="note">已在另一个标签页打开，这里只能看。要重新开始，请回到先打开的那个标签页。<\/p>/);
  assert.match(readOnly, /data-demo-reset[^>]* disabled>重新开始<\/button>/, 'a read-only tab cannot wipe the data the other tab is using');
  const open = aboutMarkup({ ai: 'on' });
  assert.match(open, /<button type="button" class="quiet demo-reset" data-demo-reset data-confirm="[^"]+">重新开始<\/button>/);
  assert.doesNotMatch(open, /data-demo-reset[^>]* disabled/);
  assert.ok(open.includes(`data-confirm="${esc(RESET_CONFIRM)}"`), 'the confirm sentence travels with the button');
  assert.equal(count(open, /data-demo-reset/g), 1);
  assert.doesNotMatch(open, /class="fine">[^<]*重新开始/, 'no fine print explains the button');
  const both = aboutMarkup({ persistent: false, readOnly: true, ai: 'on' });
  assert.equal(count(both, /demo-about-warn/g), 2);
  assert.ok(both.indexOf('这个浏览器不能保存') < both.indexOf('已在另一个标签页打开'));
});

"""
s = s[:start] + new_about + s[end:]

rep("""test('About names why the model is absent in the product\\'s own sentence, and only then', async () => {
  const { AI_OFF_LINES } = await import('../web/js/photo-insight.js');
  assert.doesNotMatch(aboutMarkup({ ai: 'on' }), /用不了本机 AI|没能载入/);
  for (const state of ['unsupported', 'page', 'failed']) assert.ok(aboutMarkup({ ai: state }).includes(`<p class="fine">${AI_OFF_LINES[state]}</p>`), state);""",
"""test('About names why the model is absent in the product\\'s own sentence, and only then; the download line only when it can run', async () => {
  const { AI_OFF_LINES } = await import('../web/js/photo-insight.js');
  assert.doesNotMatch(aboutMarkup({ ai: 'on' }), /用不了本机 AI|没能载入/);
  assert.match(aboutMarkup({ ai: 'on' }), /约 10 MB/);
  for (const state of ['unsupported', 'page', 'failed']) {
    assert.ok(aboutMarkup({ ai: state }).includes(`<p class="fine">${AI_OFF_LINES[state]}</p>`), state);
    assert.doesNotMatch(aboutMarkup({ ai: state }), /约 10 MB|后台下载/, `${state}: nothing downloads, so nothing says it does`);
  }""")

rep("""test('roomInviteMarkup has no code, no QR, no link and nothing to copy', () => {
  for (const isShowcase of [true, false]) {
    const html = roomInviteMarkup({ room: { code: 'ABCDEFGHIJKL', id: 'room-1' }, isShowcase });
    assert.doesNotMatch(html, /ABCDEFGHIJKL/);
    assert.doesNotMatch(html, /qr|invite|copy|href|nfc/i);
    assert.doesNotMatch(html, /邀请码|二维码/);
    assert.match(html, /别的设备.*进不来/);
    assert.match(html, /data-open="about"/);
    assert.match(html, /完整的房间服务/);
  }
  assert.match(roomInviteMarkup({ isShowcase: true }), /示例角色都是自动回复的虚构角色/);
  assert.match(roomInviteMarkup({ isShowcase: false }), /自己开的房间.*示例角色不会来/);
});""",
"""test('roomInviteMarkup has no code, no QR, no link and nothing to copy: only the way to About, the same in every room', () => {
  for (const isShowcase of [true, false, undefined]) {
    const html = roomInviteMarkup({ room: { code: 'ABCDEFGHIJKL', id: 'room-1' }, isShowcase });
    assert.equal(html, '<div class="demo-room-note"><button type="button" class="quiet" data-open="about">关于 Music Space</button></div>');
    assert.doesNotMatch(html, /ABCDEFGHIJKL/);
    assert.doesNotMatch(html, /qr|invite|copy|href|nfc/i);
    assert.doesNotMatch(html, /邀请码|二维码/);
  }
  assert.equal(roomInviteMarkup(), roomInviteMarkup({ isShowcase: false }));
});""")

# tour
rep("""  assert.deepEqual(TOUR_STEPS.map(step => step.title), ['放一张你的照片', '看「同一刻的另一面」', '发起交换', '招个手 / 私聊 / 回看这一晚']);
  const first = tourMarkup({ progress: tourProgress({ ...ROOM }), esc });
  assert.equal(textOf(first.match(/<p class="demo-tour-title">([\\s\\S]*?)<\\/p>/)[1]), '示例路线 1/4 · 放一张你的照片');
  const buttons = [...first.matchAll(/<button type="button" class="demo-tour-action (primary|quiet)" data-tour-action="([^"]+)">([^<]+)<\\/button>/g)].map(match => [match[1], match[2], match[3]]);
  assert.deepEqual(buttons, [['primary', 'sample:sample-crowd', '人海 · 示例照片'], ['quiet', 'sample:sample-stage', '舞台 · 示例照片'], ['quiet', 'open:upload', '用我自己的照片']]);
  assert.match(first, /<button type="button" class="demo-tour-skip quiet" data-tour-skip>跳过路线<\\/button>/);
  assert.match(first, /<button type="button" class="demo-tour-toggle" data-tour-toggle aria-expanded="true" aria-label="收起示例路线">收起<\\/button>/);""",
"""  assert.deepEqual(TOUR_STEPS.map(step => step.title), ['放一张今晚的照片', '看「同一刻的另一面」', '发起交换', '招个手 / 私聊 / 回看这一晚']);
  assert.deepEqual(TOUR_STEPS.map(step => step.hint), ['挑一张，或者用你自己的。', '照片墙会把它标出来。', '在照片墙点「和 TA 交换这个视角」。', '向同场的人招个手，对方接受就能私聊。']);
  for (const step of TOUR_STEPS) assert.ok([...step.hint].length <= 18, `a short hint: ${step.hint}`);
  const first = tourMarkup({ progress: tourProgress({ ...ROOM }), esc });
  assert.equal(textOf(first.match(/<p class="demo-tour-title">([\\s\\S]*?)<\\/p>/)[1]), '第一次来 1/4 · 放一张今晚的照片');
  assert.match(first, /<p class="demo-tour-hint">挑一张，或者用你自己的。<\\/p>/);
  const buttons = [...first.matchAll(/<button type="button" class="demo-tour-action (primary|quiet)" data-tour-action="([^"]+)">([^<]+)<\\/button>/g)].map(match => [match[1], match[2], match[3]]);
  assert.deepEqual(buttons, [['primary', 'sample:sample-crowd', '人海那张'], ['quiet', 'sample:sample-stage', '舞台那张'], ['quiet', 'open:upload', '用我自己的照片']]);
  assert.match(first, /<button type="button" class="demo-tour-skip quiet" data-tour-skip>跳过路线<\\/button>/);
  assert.match(first, /<button type="button" class="demo-tour-toggle" data-tour-toggle aria-expanded="true" aria-label="收起路线">收起<\\/button>/);""")
rep("""  assert.equal(textOf(second.match(/<p class="demo-tour-title">([\\s\\S]*?)<\\/p>/)[1]), '示例路线 2/4 · 看「同一刻的另一面」');""",
"""  assert.equal(textOf(second.match(/<p class="demo-tour-title">([\\s\\S]*?)<\\/p>/)[1]), '第一次来 2/4 · 看「同一刻的另一面」');""")
rep("""  assert.match(textOf(third), /示例路线 3\\/4 · 发起交换/);""", """  assert.match(textOf(third), /第一次来 3\\/4 · 发起交换/);""")
rep("""  assert.match(textOf(fourth), /示例路线 4\\/4 · 招个手 \\/ 私聊 \\/ 回看这一晚/);""", """  assert.match(textOf(fourth), /第一次来 4\\/4 · 招个手 \\/ 私聊 \\/ 回看这一晚/);""")
rep("""  assert.match(textOf(last), /示例路线 4\\/4 · 路线走完了/);
  assert.match(textOf(last), /更多可以逛：我的空间、音乐社群、专辑世界杯、一起玩、音乐探索。/);""",
"""  assert.match(textOf(last), /第一次来 4\\/4 · 路线走完了/);
  assert.match(textOf(last), /更多可以逛：我的空间、乐迷社群、专辑世界杯、一起玩、音乐探索。/);
  assert.match(last, /<button type="button" class="demo-tour-skip primary" data-tour-skip>知道了，收起路线<\\/button>/);""")
rep("""  assert.match(html, /aria-expanded="false" aria-label="展开示例路线">展开<\\/button>/);
  assert.doesNotMatch(html, /data-tour-action|data-tour-skip|demo-tour-hint/);
  assert.match(textOf(html), /示例路线 1\\/4 · 放一张你的照片/);""",
"""  assert.match(html, /aria-expanded="false" aria-label="展开路线">展开<\\/button>/);
  assert.doesNotMatch(html, /data-tour-action|data-tour-skip|demo-tour-hint/);
  assert.match(textOf(html), /第一次来 1\\/4 · 放一张今晚的照片/);""")
rep("""  assert.deepEqual([container.attrs.role, container.attrs['aria-live'], container.attrs['aria-label']], ['region', 'polite', '示例路线']);""",
"""  assert.deepEqual([container.attrs.role, container.attrs['aria-live'], container.attrs['aria-label']], ['region', 'polite', '第一次来']);""")
rep("""  assert.match(container.html, /示例路线 1\\/4/);""", """  assert.match(container.html, /第一次来 1\\/4/);""")

# demo-hooks
rep("""  assert.deepEqual(demo.castNames(), ['阿遥·示例', '小满·示例', '北屿·示例', '林间·示例']);
  assert.equal(demo.samples, SAMPLES);""",
"""  assert.deepEqual(demo.castNames(), ['阿遥', '小满', '北屿', '林间']);
  assert.equal(demo.samples, SAMPLES);""")
rep("""  const about = demo.aboutMarkup({ ai: 'on' });
  assert.match(about, /这个浏览器没有让这里保存数据/);
  assert.match(about, /这个标签页是只读的/);
  assert.match(about, /阿遥·示例、小满·示例、北屿·示例、林间·示例/);
  assert.match(about, /版本 <code>0\\.22\\.0-rc\\.1<\\/code>/);""",
"""  const about = demo.aboutMarkup({ ai: 'on' });
  assert.match(about, /这个浏览器不能保存，刷新后会重新开始。/);
  assert.match(about, /已在另一个标签页打开，这里只能看。/);
  assert.match(about, /data-demo-reset[^>]* disabled>重新开始/);
  for (const name of PEOPLE) assert.ok(!about.includes(name), `About names nobody (${name})`);
  assert.match(about, /版本 <code>0\\.22\\.0-rc\\.1<\\/code>/);""")
rep("""  assert.throws(() => demo.reset(), /不能重置/);""",
"""  assert.throws(() => demo.reset(), error => error.message === '现在还不能重新开始，请稍后再试。');""")

start = s.index("test('createDemoProfile: castLabel tells the cast from everyone else, and no token ever reaches a screen', () => {")
end = s.index("test('createDemoProfile: the entry form starts with the random look and a saved draft wins over it', () => {")
new_hooks = r"""test('createDemoProfile: castLabel labels nobody (the people list shows the seeded people like anyone), isCast still knows them, and no token ever reaches a screen', () => {
  const demo = createDemoProfile({ getWorld: () => WORLD, build: BUILD, channel: 'pages' });
  for (const member of [{ id: 'u-yao', name: '阿遥' }, { id: 'u-lin' }, { id: 'u-visitor', name: '访客1234' }, { id: 'u-visitor', name: '阿遥' }, null, undefined, {}]) assert.equal(demo.castLabel(member), '');
  assert.equal(demo.isCast('u-man'), true);
  assert.equal(demo.isCast('u-lin'), true, 'the quiet member who arrives later is one of them too');
  assert.equal(demo.isCast('u-visitor'), false);
  assert.equal(demo.isCast(''), false);
  const surfaces = [demo.aboutMarkup({ ai: 'on' }), demo.entryMarkup({ state: { identity: { status: 'missing' } }, esc, avatarSvg: renderAvatarSvg }), demo.roomInviteMarkup({ code: 'ABCDEFGHIJKL' }), JSON.stringify(demo.castNames()), demo.castLabel({ id: 'u-yao' })];
  for (const text of surfaces) assert.doesNotMatch(text, /SECRET-TOKEN/);
  assert.ok(!JSON.stringify(Object.keys(demo)).includes('token'));
});

test('createDemoProfile: a plainer world (ids, names and the room code only) works as well, and an array of people too', () => {
  const plain = createDemoProfile({ getWorld: () => ({ castIds: ['u-yao', 'u-lin'], castNames: ['阿遥', '林间'], roomCode: 'ABCDEFGHIJKL' }) });
  assert.equal(plain.roomCode(), 'ABCDEFGHIJKL');
  assert.deepEqual(plain.castNames(), ['阿遥', '林间']);
  assert.equal(plain.isCast('u-lin'), true);
  assert.equal(plain.isCast('u-man'), false);
  assert.equal(plain.castLabel({ id: 'u-yao' }), '');
  assert.equal(plain.roomInviteMarkup({ code: 'ABCDEFGHIJKL' }), roomInviteMarkup());
  const listed = createDemoProfile({ getWorld: () => ({ people: [{ id: 'a', name: '甲' }, { id: 'b', npc: { name: '乙' } }, null], room: { code: 'QQQQQQQQQQQQ' } }) });
  assert.deepEqual(listed.castNames(), ['甲', '乙']);
  assert.equal(listed.isCast('b'), true);
  assert.equal(listed.roomCode(), 'QQQQQQQQQQQQ');
  const none = createDemoProfile({ getWorld: () => null });
  assert.deepEqual([none.roomCode(), none.castNames(), none.isCast('a')], [null, [], false]);
});

test('createDemoProfile: roomInviteMarkup is the same way to About for the show\'s room, the visitor\'s own and a room it cannot place', () => {
  const demo = createDemoProfile({ getWorld: () => WORLD });
  const showcase = demo.roomInviteMarkup({ code: 'ABCDEFGHIJKL', id: 'room-1' });
  const own = demo.roomInviteMarkup({ code: 'ZZZZZZZZZZZZ', id: 'room-2' });
  assert.equal(showcase, '<div class="demo-room-note"><button type="button" class="quiet" data-open="about">关于 Music Space</button></div>');
  assert.equal(own, showcase);
  assert.equal(demo.roomInviteMarkup(undefined), showcase);
  assert.doesNotMatch(showcase + own, /ABCDEFGHIJKL|ZZZZZZZZZZZZ/);
});

"""
s = s[:start] + new_hooks + s[end:]

rep("""  const first = demo.entryDefaults({});
  assert.deepEqual(first, { name: demo.defaultName, avatar: demo.defaultAvatar, preparing: true, castNames: ['阿遥·示例', '小满·示例', '北屿·示例', '林间·示例'] });""",
"""  const first = demo.entryDefaults({});
  assert.deepEqual(first, { name: demo.defaultName, avatar: demo.defaultAvatar, preparing: true });""")
rep("""  assert.ok(html.includes(`value="${demo.defaultName}"`));
  assert.match(html, /同场的阿遥·示例、小满·示例、北屿·示例、林间·示例都是虚构的/);""",
"""  assert.ok(html.includes(`value="${demo.defaultName}"`));
  for (const name of PEOPLE) assert.ok(!html.includes(name), `the entry names nobody (${name})`);""")
rep("""  const status = { textContent: '正在布置示例现场…' };""", """  const status = { textContent: '正在布置现场…' };""")
rep("""  assert.deepEqual([submit.disabled, status.textContent], [true, '正在布置示例现场…']);""",
"""  assert.deepEqual([submit.disabled, status.textContent], [true, '正在布置现场…']);""")
rep("""  const demo = createDemoProfile({ getWorld: () => WORLD, samples: [{ id: 'sample-stage', label: '舞台 · 示例照片' }, { id: 'sample-crowd', label: '人海 · 示例照片' }], readOnly: () => readOnly });""",
"""  const demo = createDemoProfile({ getWorld: () => WORLD, samples: [{ id: 'sample-stage', label: '舞台那张' }, { id: 'sample-crowd', label: '人海那张' }], readOnly: () => readOnly });""")

open(p,'w',encoding='utf-8').write(s)
print('part 2 ok')
