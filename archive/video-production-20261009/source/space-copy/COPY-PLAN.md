# Music Space — complete-product copy plan (2026-10-07)

Branch feat/complete-product-copy (base 8fa52f0, 0.22.0-rc.1). Owner decisions: no explanatory/defensive/legal/demo-status copy; one disclosure, in About only; host side and long-term community are for Livehouse venues. Copy only, no new features.

Ownership: each source file and each test file is edited by exactly one area (listed below). Use the strings here verbatim; "‖" separates several strings of one entry, "(remove)" means delete the text (and its element when it holds nothing else).

## Glossary and style

```
TERMS (use exactly these; the old words on the right must not appear in UI copy)
- 现场: the show's room as the audience lives it — 进入现场, 我的现场, 现场进行中, 正在布置现场…, 现场已更新, 三维现场. (old: 示例现场)
- 这一场 / 本场: this show; 同场的人; 散场; 下一场 = the next show.
- 房间 / 开房: the host side — a Livehouse opens a room for each show. Host entry everywhere (Node entry button, static entry details summary, recap): 「我是 Livehouse / 主办方，开个房」. Create panel eyebrow 「Livehouse / 为这一场开房」; submit 「开房并进入现场」 and 房主 unchanged. (old: 主办方 / 开一个现场, 自己开个房, 自己开一场)
- Livehouse / 场地: the venue. Seeded venue 「月台 Livehouse」, seeded show 「回声现场」. Write Livehouse (LIVEHOUSE only in caps eyebrows). (old: （虚构场地）, · 示例场)
- 乐迷社群: the venue's long-term fan community. Feature name and list heading 「Livehouse 乐迷社群」 (room panel, rooms panel, recap, community list h2); the show's linked one 「这家 Livehouse 的乐迷社群」; a member's own list 「我的乐迷社群」 (personal space, chat settings); members 乐迷 / 社群成员; count 「{n} 位乐迷」; scene sticker 「MUSIC SPACE / 乐迷社群」; list intro 「散场后，乐迷留在场地的社群里；下一场的预告直接发到这里。」; create button 「创建 Livehouse 乐迷社群」. (old: 长期音乐社群, 音乐社群, 长期社群, 长期空间, 空间, 我的社群)
- 下一场预告: an event preview posted in the community — button, panel title and aria 「下一场预告」, panel eyebrow 「LIVEHOUSE / 下一场见」, list heading 「下一场」, form 「发布下一场预告」 / 「演出名称」 / 「给乐迷的话」 / 「发布预告」. (old: 活动预告, 空间与活动, 活动, 接下来的见面)
- 散场聊天室 / 聊天室: the show's group chat (unchanged). Settings menu 「设置与管理 ···」.
- 照片墙: photo wall; 上墙 / 未上墙; visibility 「仅自己保存」 / 「分享给本场成员」 (unchanged).
- 同一刻 / 另一面 / 同一刻的另一面 (unchanged); wall group note 「3 分钟内拍下」.
- 视角 舞台 / 人海 / 身边 / 细节 (unchanged). AI labels unchanged: 「AI 判断：人海」 「不确定，请选择」 「AI 建议，未改动」 「作者选择」.
- 照片交换: 发起交换, 等待对方回应, 交换已接受, 对方谢绝了, 交换已撤销, 撤销这次交换, 小图预览, 原图. (old: 等待本人回应, 在线访问已结束, 限尺寸预览, 定向交换, 在线访问)
- 招手 / 招个手, 朋友 (mutual), 私聊, 屏蔽, 安静参与 / 愿意打招呼. Friend state 「你们已经是朋友了。」 (old: 互相同意成为朋友, 双向朋友, 联系 as a noun)
- 小人: the avatar. Identity errors say 「请先确认你的小人身份」 / 「身份已变化，请刷新页面」. (old: 分身, 浏览器身份)
- 回看这一晚 / 回顾, 纪念卡, 文字纪念票, 双人纪念 / 创作角 (unchanged).
- Onboarding card: 「第一次来 n/4」; 跳过路线; 知道了，收起路线; 路线走完了. (old: 示例路线)
- Ready-made photos: 「人海那张」 「舞台那张」; own photo 「用我自己的照片」; tour step title 「放一张今晚的照片」; upload-form group title 「或者挑一张今晚的」. (old: 人海 · 示例照片, 没有现场照片？用示例照片试试)
- Seeded people: 阿遥 (房主, 「月台的阿遥」), 小满, 北屿, 林间. (old: ·示例 suffix)
- Actions: 重新开始 = reset (old 重置示例 / 重置示例数据); 重新载入 = reload the page; 刷新 = re-read data (old 核对最新状态 / 重新核对); 重新读取 = retry a failed read; 重试 = retry an operation (old 原操作重试 / 按原选择重试 / 确认原操作结果); 不再等待 (old 停止本机等待); 再想想 = back out of a confirm (old 返回查看).
- About: 「关于 Music Space」 (button, title, room-sheet button). (old: 关于这个示例, 示例站 · 数据只存在这个浏览器 · 关于这个示例)
- Confirmations: the Node source says 「服务器已确认。」 「服务已确认。」 「服务已收到…」; the static build rewrites them to 「已确认。」 「已收到…」 (COPY_RULES).
- 在线版: the judged online edition; the word appears only in About.
STYLE
- Simplified Chinese; warm, short, confident, a little playful. Space between CJK and Latin or digits (AI 判断, 24 人, 21:47, Music Space). Full-width punctuation; 「」 for UI names.
- 你 = the visitor; TA = another person; 对方 only in status lines (等待对方回应).
- Paragraphs, empty states, panel problem lines and About end with 。; buttons, labels, chips, pills, toasts, checkbox labels and controller error toasts have no final 。.
- Hints about 16 characters or fewer, one sentence each. Errors short and neutral: what happened + what to do (…，请刷新 / …，请重试).
- Consent checkboxes stay: one short first-person clause, no explanation (「我愿意向本场成员展示我的昵称和小人」, 「我同意先给小图，TA 接受后再给原图」, 「我同意交换这两张」, 「把这段说明交给本场房主」).
- Never in UI copy (except the single About sentence, and 预览版 on the preview channel): 示例, 虚构, 模拟, 演示, 不是真人, 自动回复, 在本页运行, 没有服务器, 只存在这个浏览器, 本地体验版, 不代表…, 不是到场认证, 不会自动…, 原件仍归各自, 无法（远程）收回, 不订阅营销, 不扩大照片权限, 规则判断 / 不是 AI, 未核实, 明确… as a hedge, 核对, 原操作 / 原请求, 分身, 真实 as a claim, 长期空间.
- Honesty floor: no claim of real people, real venues, partnerships, online presence, a server in the static build, or features that do not exist; never call a rule AI; cast lines never say they are people; Node copy stays true for real rooms (upload on save, server confirmation).
```

## About sheet (full copy)

```
关于 Music Space — the full sheet (web/static-runtime/showcase/about-panel.js, aboutMarkup)

[eyebrow] 同一刻，另一面
[h2] 关于 Music Space
[p.demo-about-lead] 同一晚，你拍了舞台，TA 拍了人海。Music Space 让这两面在同一个房间里相遇。

[section data-about=what] 这是什么
同场的人带着手绘小人，走进同一个三维 Livehouse 房间。放一张今晚的照片，照片墙会把同一刻、拍到另一面的照片排在一起；双方都同意，就能交换。还能向同场的人招手、私聊，一起玩专辑世界杯。散场后，回顾和纪念卡都留着。

[section data-about=livehouse] 给 Livehouse
为每一场演出开一个房间，乐迷带着小人入场。散场后，乐迷留在你的乐迷社群里，下一场的预告直接发到这里。

[section data-about=ai] AI
放照片时，AI 在你的设备上建议它拍的是舞台、人海、身边还是细节；没把握就说「不确定」，由你来选。
[p.fine, only when ai === 'on'] 第一次进入现场后，模型（约 10 MB）会在后台下载；开了省流量就不下载。
[p.fine, only when ai !== 'on'] the matching AI_OFF_LINES sentence, unchanged (e.g. 这个浏览器用不了本机 AI，视角请自己选。)

[section data-about=privacy] 隐私
不用真名，也不用手机号。照片给谁看由你决定，放进来时会缩小、去掉位置信息。交换照片、成为朋友，都要双方同意。

[section data-about=data] 在线版
在线版里的场地、观众和照片是演示内容，观众会自动回复。
[p.demo-about-warn role=note, only when storage is memory-only] 这个浏览器不能保存，刷新后会重新开始。
[p.demo-about-warn role=note, only in a read-only tab] 已在另一个标签页打开，这里只能看。要重新开始，请回到先打开的那个标签页。
[button.quiet.demo-reset data-demo-reset data-confirm="重新开始会清除你的昵称、小人、照片和交换，确定吗？", disabled in a read-only tab] 重新开始

[section data-about=version] 版本
[p.demo-about-stamp] 版本 0.22.0-rc.1 · 提交 abc1234 · 构建于 2026-10-06 02:15 UTC · 渠道 pages   (versionLine unchanged; when nothing is known: 这次构建没有留下版本信息)
[preview channel only, appended] · 预览版：发布前的测试副本，不是最终版本

The disclosure sentence appears exactly once in the product, here. Nothing in the sheet names the cast, the photo source, the 3-minute rule, IndexedDB, SQLite/WASM, the model name or the 0.16 prototype; no links.
```

## Area: shell

Files: web/event-room/index.html, web/event-room/app.js, web/event-client/*.js, web/avatar/three-scene.js (print text only)

### Tests owned

- tests/event-room-profile-seams.test.js: update :130 :140 :148 (new Node presence copy), :134 :265 (已连接), :158 (已重新连接), :143 (本场原创声景), :156 (<button class="quiet" data-reconnect>重新连接</button>), :167 (请用网址打开 Music Space), :176 (invite block: 写入 NFC 邀请标签 + <p class="fine">把链接发给今晚同场的朋友。</p>, QR/NFC fine line gone), :289 (关于 Music Space); optional: fixture :386/:388 示例现场没能启动 -> 现场没能打开
- tests/event-room-binding.test.js: :303 doesNotMatch -> /你们已经是朋友了/ (still matches /上次确认/); :447 -> /离场后只保留自己的照片/ (unchanged fragment, panels recap-view) and /去另一个现场/ (panels recap-view); update :182 /已明确失败/ -> /没有成功/ (移除失败记录 unchanged); still-passing fragments to re-verify: 照片所属的现场, 不会恢复原来的朋友, 等待更新 (and not 已经成为朋友), 这一场已结束, 已保存, 暂未读到, 入场已确认
- tests/event-client.test.js: verify /身份/ still matches the new IDENTITY_REQUIRED text (请先确认你的小人身份)
- tests/event-identity-backup.test.js: verify fragments still match: 另一个服务地址, 损坏, 密码不正确, 12至128, 来源 (unchanged message), 安全加密能力

### Changes (86 entries)

| file | current | new | note |
|---|---|---|---|
| web/event-room/index.html | .brand aria-label="Space 全景" | Music Space | aria-label only |
| web/event-room/index.html | #music-map-entry aria-label="打开应用内 Music Map" | 音乐探索 | visible 音乐探索 ↗ unchanged |
| web/event-room/index.html | #my-look aria-label="我的衣橱，实时试穿" | 我的小人 · 换装 | visible 我的小人 ↗ unchanged |
| web/event-room/index.html | #error h2 这个浏览器暂时无法打开三维现场 ‖ #error p 请在支持 WebGL2 的浏览器中打开。房间操作和照片仍可继续使用。 | 三维现场暂时打不开 ‖ 照片和同场名单照常能用，也可以换个浏览器试试。 | identical to app.js:328 |
| web/event-room/index.html | footer #evidence 本地体验版 · 手绘小人 / 三维现场 |  | keep the empty <span id="evidence"> (static puts the About button in it) |
| web/event-room/index.html | .desktop-caption p 一个真实房间、一场共同的音乐现场。先选你的位置，再看看大家留下了什么。 | 一场演出，一个房间。先选你的位置，再看看大家留下了什么。 | honesty: drops 真实 (Node only; static hides this p) |
| web/event-room/index.html | .desktop-caption small 主办方开房，观众带上自己的小人入场。照片由你决定仅自己保存，还是分享给同场成员。 | Livehouse 为每一场演出开一个房间，乐迷带着小人入场；散场后，留在场地的乐迷社群里。 | shown on the judged desktop view |
| web/event-room/app.js | :109 participation hints 照样保存和分享照片，不接收新招呼。 ‖ 别人可以招手；成为朋友仍需我明确接受。 | 照片照常分享，不接新招呼 ‖ 别人可以向我招手 | static entry-panel.js PARTICIPATION uses the same two hints |
| web/event-room/app.js | :116 · {n} 个明确失败 |  · {n} 个失败 |  |
| web/event-room/app.js | :121 这张照片目前无法读取，请重新核对可用内容。 ‖ 暂未读到照片，恢复连接后可重试。 | 这张照片现在看不了。 ‖ 暂未读到这张照片。 |  |
| web/event-room/app.js | :125 MUSIC SPACE / COMMUNITY ‖ aria 查看长期音乐社群 ‖ {n} 位社群成员 · 不是在线人数 ‖ #render-status {n} 位社群成员 | MUSIC SPACE / 乐迷社群 ‖ 查看乐迷社群 ‖ {n} 位乐迷 ‖ {n} 位乐迷 | no presence claim |
| web/event-room/app.js | :129 当前身份已不能读取这一场，请在我的现场查看状态。自己的照片仍保留。 | 这一场已无法查看，你的照片还在 |  |
| web/event-room/app.js | :134 presenceCopyLobby 用一个小人加入现场，保存照片、看看他人的视角；愿意时再认识彼此。 ‖ presenceCopyAlone 上传第一张照片，或邀请真正同场的朋友。 ‖ presenceCopyRoom 照片可以只为自己保存。认识别人，由双方决定。 | 带上小人进场，留下照片，看看别人的视角。 ‖ 放上第一张照片，再邀请同场的朋友。 ‖ 照片给谁看、认识谁，都由你决定。 | Node defaults; static copy.js keeps its own presence lines |
| web/event-room/app.js | :135 trackNote default 房间选定的原创示例声景 · 不代表真实演出曲目 | 本场原创声景 | same value as static copy.js trackNote |
| web/event-room/app.js | :136 连接暂时中断。已输入内容仍在，恢复后可用原操作重试。 ‖ 浏览器身份已失效。新建身份不能找回旧记录。 | 网络断开了，输入的内容还在 ‖ 这个浏览器里的小人已失效 | data-loss consequence stays in the profile consent checkbox |
| web/event-room/app.js | :138 statusReady default 房间服务已连接 | 已连接 |  |
| web/event-room/app.js | :142 浏览器身份已变化，正在重新载入 ‖ 身份已变化，请重新打开这个页面核对 | 身份已变化，正在重新载入 ‖ 身份已变化，请刷新页面 |  |
| web/event-room/app.js | :192 title 近景只显示选中的人，返回全景看大家 ‖ title 点击照片可以查看详情 | 返回全景看看大家 ‖ 点照片看大图 |  |
| web/event-room/app.js | :202 先用这个小人，入场后随时能逐件换装。 | 入场后随时能换装。 | same line in static entry-panel.js |
| web/event-room/app.js | :204 现场已创建；请再明确关联给社群成员。 | 现场开好了，再关联到乐迷社群 |  |
| web/event-room/app.js | :208 我选择写入 NFC 邀请标签 ‖ 二维码和 NFC 标签只包含上方邀请网址… ‖ 链接可转发给来参加这一场的人。入场者仍需本人同意… | 写入 NFC 邀请标签 ‖ (remove the QR/NFC fine line) ‖ 把链接发给今晚同场的朋友。 | Node invite block |
| web/event-room/app.js | :209 我愿意向本场成员展示我的昵称和小人。照片默认仅自己可见，由我另行选择分享。 | 我愿意向本场成员展示我的昵称和小人 | consent stays; identical to static entry consent |
| web/event-room/app.js | :214 已招手，等待本人回应 | 已招手，等待对方回应 |  |
| web/event-room/app.js | :217 已展开更多记录，自动刷新暂缓以保留位置。以下是上次读取的列表… ‖ 关系状态暂未更新。已提交的选择会保留… | 已暂停自动刷新。 ‖ 关系列表暂未更新。 |  |
| web/event-room/app.js | :218 互相愿意 / 才成为朋友 ‖ 已互相同意成为朋友 → ‖ 还没有互相确认的朋友。认识一个同场的人，从招个手开始。 | 互相愿意 / 成为朋友 ‖ 已是朋友 → ‖ 还没有朋友，从招个手开始。 |  |
| web/event-room/app.js | :219 已屏蔽 · 点此查看取消 | 已屏蔽 · 可取消 |  |
| web/event-room/app.js | :220 暂时没有待回应的招呼。对方不接受，就不会成为朋友。 ‖ 朋友只意味着双方明确愿意认识… | 暂时没有新招呼。 ‖ (remove) |  |
| web/event-room/app.js | :223 照片可以只留给自己，也能分享给已入场的人。看到喜欢的视角… ‖ 我是主办方，开个房 ‖ reconnectLabel default 重新连接房间服务 | 输入邀请码，走进今晚的现场。 ‖ 我是 Livehouse / 主办方，开个房 ‖ 重新连接 | Node entry panel |
| web/event-room/app.js | :224 不需要现实姓名。先用默认造型，入场后随时换装。 ‖ consent 我知道这是新身份，无法凭同一昵称找回原来的照片和房间。 ‖ 身份保存在这个浏览器。清除浏览器数据会失去访问权… | 不用真名，入场后随时能换装。 ‖ 我知道新身份找不回原来的照片和房间 ‖ (remove) | Node keeps 备份或恢复我的小人身份 below |
| web/event-room/app.js | :225 主办方也以自己的身份加入，不会替其他观众入场。 ‖ eyebrow 主办方 / 开一个现场 ‖ 为活动开现场。创建成功后还需单独确认关联给社群… ‖ song suffix （原创示例） ‖ 可加入 24 人，入场窗口 24 小时。关闭后不再加入或上传… | 开房前，先做一个自己的小人。 ‖ Livehouse / 为这一场开房 ‖ 开好后，再把它关联到乐迷社群。 ‖ （原创） ‖ 最多 24 人，入场开放 24 小时。 | 今晚叫什么名字？, 例如：月台 Livehouse and 开房并进入现场 unchanged |
| web/event-room/app.js | :226 你已经加入，场景内容还没读出来。重新读取会继续这次入场… ‖ 重新读取这个现场 | 已经入场，现场还没读出来。 ‖ 重新读取现场 | 入场已确认 unchanged |
| web/event-room/app.js | :229 这里只展示场次资料。加入后才会让同场成员看到你的昵称与小人。 | (remove) | the join consent says it |
| web/event-room/app.js | :230 长期音乐社群 ‖ 切换安静会结束本场待回应的招呼。已有朋友、私聊和照片权限不变… | Livehouse 乐迷社群 ‖ 改为安静参与会结束待回应的招呼。 | room panel |
| web/event-room/app.js | :231 长期音乐社群 | Livehouse 乐迷社群 | rooms panel |
| web/event-room/app.js | :232 static alone 这里现在只有你。先保存自己的现场记忆… ‖ Node alone 不用等别人，先保存自己的现场记忆。想和同场朋友一起看… ‖ 你的小人在场景里。这里列出其他成员… | 现在只有你，先放一张照片吧。 ‖ 先放一张照片，再邀请同场的朋友。 ‖ (remove) | static must not mention inviting (static-binding :387) |
| web/event-room/app.js | :235 当前关系暂未更新，下面是上次确认的状态。 | 关系状态暂未更新。 |  |
| web/event-room/app.js | :236 从这张现场照片认识作者。照片分享和成为朋友是两个独立选择。 | 从这张照片认识作者。 |  |
| web/event-room/app.js | :237 这是你的小人。你决定和谁认识，也决定给谁看照片。 | 这是你的小人。 |  |
| web/event-room/app.js | :238 你已屏蔽对方，不会收到后续招呼。 | 你已屏蔽 TA。 |  |
| web/event-room/app.js | :241 上次确认你们互为朋友，当前状态需要重新读取。 ‖ 你们已经互相同意成为朋友。 ‖ 照片仍按原场次授权，不会因此开放私藏。 | 上次确认你们是朋友，状态待更新。 ‖ 你们已经是朋友了。 ‖ (remove) |  |
| web/event-room/app.js | :242 TA 选择安静参与，不接收新招呼。仍可查看 TA 已分享给本场的照片。 | TA 选择安静参与，不接新招呼。 |  |
| web/event-room/app.js | :243 你正在安静参与。想认识这位作者，可以先改为愿意打招呼… | 你正在安静参与，想招手先改一下。 | button 我愿意打招呼 follows |
| web/event-room/app.js | :244 先招个手，对方愿意回应后，你们才会成为朋友。 | 先招个手，TA 接受了就是朋友。 |  |
| web/event-room/app.js | :245 这一场已结束。已有的招呼仍可回应，新的招呼留给下一次同场。 | 这一场已结束，下一场再招手吧。 |  |
| web/event-room/app.js | :247 这是本场房主。目前没有独立平台申诉渠道，仍可选择个人屏蔽或离场。 | 这是本场房主。 |  |
| web/event-room/app.js | :249 不展示手机号或社交账号。没有公开聊天，也不会自动添加好友。 | (remove) |  |
| web/event-room/app.js | :252 block confirm 会结束已有联系、待回应招呼和双方全部定向照片交换… ‖ 取消屏蔽不会自动恢复朋友。这个屏蔽只作用于现场系统… | 会结束你们的联系和照片交换，彼此不再可见。 ‖ (remove) |  |
| web/event-room/app.js | :253 双方的朋友列表都会移除这份联系，也不能再发新私聊… | 移除后不能再私聊，聊天记录会保留。 |  |
| web/event-room/app.js | :254 不会恢复原来的朋友或招呼。将来仍需重新打招呼并由对方接受。 ‖ 如果双方仍在同一现场，小人与原本分享给本场的照片会重新可见… ‖ 屏蔽记录已经变化，请重新查看。 | 不会恢复原来的朋友，需要重新招手。 ‖ (remove) ‖ 屏蔽状态已变化，请重新查看。 |  |
| web/event-room/app.js | :256 照片墙只按本场范围展示。未上墙的本人照片也能在此看到… | (remove) | static-binding :445 drops its assertion |
| web/event-room/app.js | :257 会从照片墙撤下，取消涉及它的待回应申请，并结束所有已接受交换的双向在线访问。各自原件保留… | 会从照片墙撤下，并结束涉及它的交换。 |  |
| web/event-room/app.js | :258 离开房间仍能找回自己的照片。这里不会自动下载其他成员的照片。 | (remove) |  |
| web/event-room/app.js | :261 看看 ${name} · 认识与否由彼此决定 ‖ 回到这张照片所属的现场后，才能再次选择分享… ‖ 照片墙和定向交换分开授权… ‖ 双方明确同意两张指定照片后，散场仍可在线查看… | 认识一下 ${name\|\|'这位作者'} ‖ 回到照片所属的现场后才能分享。 ‖ (remove) ‖ (remove) |  |
| web/event-room/app.js | :262 离场后不再读取其他人的照片墙分享。自己的照片会从墙上撤下… | 你的照片会从墙上撤下，已完成的交换还在。 |  |
| web/event-room/app.js | :263 已有成员仍可查看已获授权的照片。场次结束后不能恢复入场。 | 结束后不能再入场或上传。 |  |
| web/event-room/app.js | :264 房间和你的照片列表都将不再显示它…已经下载的副本无法收回。 | 移除后无法恢复，相关交换也会结束。 |  |
| web/event-room/app.js | :265 结果未确认的操作会保留原来的内容和目标… ‖ 下面的操作已明确失败，可以移除失败记录或稍后按原内容重试。草稿会保留。 ‖ · 未能保存恢复信息 ‖ 使用原操作重试 | 重试不会重复提交。 ‖ 这些操作没有成功，可以重试或移除。 ‖ · 刷新后会丢失 ‖ 重试 | 移除失败记录 and 停止等待 buttons unchanged |
| web/event-room/app.js | :275 现场已切换，请重新选择要上传的照片 | 现场已切换，请重新选照片 |  |
| web/event-room/app.js | :277 reconnectToast default 房间服务已连接 | 已重新连接 |  |
| web/event-room/app.js | :278 confirm fallback 确定要重置示例数据吗？ | 确定要重新开始吗？ |  |
| web/event-room/app.js | :284 现在愿意打招呼。是否招手，由你决定。 | 现在可以招手了 |  |
| web/event-room/app.js | :286-290 选择已提交，等待更新关系状态 ‖ 招呼已送达，等待对方决定 ‖ 请求已处理，请查看最新状态 ‖ 选择已处理，请查看朋友列表 ‖ 屏蔽已提交，本页先隐藏对方 ‖ 已屏蔽，联系与待回应招呼已结束 ‖ 状态已更新，请以当前列表为准 ‖ 已移除这份联系 ‖ 当前仍有屏蔽记录，请以列表为准 ‖ 已取消屏蔽，不会自动恢复朋友 | 已提交，等待更新 ‖ 招呼已送达，等待对方回应 ‖ 已处理，请看最新状态 ‖ 已回应，去朋友列表看看 ‖ 屏蔽已提交 ‖ 已屏蔽 ‖ 状态已更新 ‖ 已移除朋友 ‖ 仍在屏蔽中 ‖ 已取消屏蔽 | accept toast must not say 已经成为朋友 |
| web/event-room/app.js | :304 已收回这张照片的全部在线分享，原件保留 | 已收回这张照片的全部分享 |  |
| web/event-room/app.js | :311 邀请网址已写入标签；读取后仍需本人明确加入 ‖ 未允许写入 NFC，可继续使用二维码或链接 ‖ 标签写入未完成，可重新选择写入 | 邀请已写入标签 ‖ 没有 NFC 权限，可以用二维码或链接 ‖ 没写进标签，再试一次 | Node over https only |
| web/event-room/app.js | :312 复制没有成功，可以选取上方邀请码 | 没复制成功，可以手动复制邀请码 |  |
| web/event-room/app.js | :313 原操作已确认，可从我的现场查看结果 | 已确认，可以在「我的现场」查看 |  |
| web/event-room/app.js | :314 失败记录已移除，照片草稿仍保留 ‖ 已停止等待。若请求已到达，停止等待不会撤销服务器操作。 | 已移除，照片草稿还在 ‖ 已停止等待，已发出的操作不会撤回 | true in both builds; static deletes COPY_RULES stop-waiting |
| web/event-room/app.js | :328 三维现场暂时没有打开 ‖ 入场、照片和同场名单仍可使用。你可以继续操作… | 三维现场暂时打不开 ‖ 照片和同场名单照常能用，也可以换个浏览器试试。 |  |
| web/event-room/app.js | :334 小人已保存，同场画面会在恢复连接后更新 | 小人已保存，现场稍后更新 |  |
| web/event-room/app.js | :346 操作已收到，场次状态会在恢复连接后更新 | 已收到，现场状态稍后更新 |  |
| web/event-room/app.js | :350 新场馆暂未载入，当前使用备用现场。 | 场馆没载入，先用备用现场 |  |
| web/event-room/app.js | :355 confirm 用这个活动预填开房表单？现有开房草稿会被替换。 | 用这场预告开房？当前开房草稿会被替换。 |  |
| web/event-room/app.js | :357 evidenceButton fallback 关于这个示例 | 关于 Music Space |  |
| web/event-room/app.js | :359 nonHttpToast default 请通过本地房间服务打开，离线 HTML 无法建立真实房间 | 请用网址打开 Music Space | same value as static copy.js |
| web/event-client/api.js | :46 连接暂时没有回应。草稿仍在，可用原操作重试。 ‖ :49 连接已取消或超时。草稿和原操作仍在。 ‖ :51 照片服务返回了无法使用的内容。 ‖ :57 服务返回了无法读取的内容。请稍后用原操作重试。 ‖ :58 读取已取消。原操作仍可重试。 | 网络没有回应，请稍后重试 ‖ 连接超时，请重试 ‖ 照片读取失败 ‖ 读取失败，请稍后重试 ‖ 读取已取消，可以重试 |  |
| web/event-client/controller.js | :74 本机存储不可用或已满… ‖ :130 浏览器身份已变化，请重新载入以核对新会话。 ‖ :161 浏览器身份已丢失或改变… ‖ :162 请先连接并确认当前浏览器身份。不会自动替换旧身份。 | 浏览器存储不可用，刷新可能丢草稿 ‖ 身份已变化，请刷新页面 ‖ 小人身份已变化，请刷新页面 ‖ 请先确认你的小人身份 |  |
| web/event-client/controller.js | :248 回顾服务返回了无法核对的身份、现场或分页内容。 ‖ :313 社交服务返回了无法核对的身份或列表。 ‖ :356 社交服务返回了无法核对的成员资料。 ‖ :385 请先读取这条招呼、朋友或屏蔽记录。 ‖ :386 这条社交记录已变化，请重新确认。 ‖ :398 现场已经切换，请重新确认本次操作的目标。 ‖ :413 请先重试或处理尚未确认的操作。 | 回顾读取失败，请重试 ‖ 关系列表读取失败，请重试 ‖ 成员资料读取失败，请重试 ‖ 请先刷新关系列表 ‖ 关系状态已变化，请刷新 ‖ 现场已切换，请重新选择 ‖ 还有未完成的操作，请先处理 |  |
| web/event-client/controller.js | :421 身份已经改变。旧操作不能建立或替换当前身份… ‖ :425 此操作属于之前的身份，不能改用当前身份重试… ‖ :460 身份已经建立，但浏览器未能保存… ‖ :505 浏览器无法保存原操作的重试信息… ‖ :509 发送状态无法保存，请恢复本机存储后用原操作重试。 ‖ :514 身份已变化，原操作保留给原身份确认。 ‖ :515 已停止等待。原操作仍可重试。 | 身份已变化，请刷新页面 ‖ 这是之前身份的操作，不能重试 ‖ 小人没能存进浏览器，请重试 ‖ 浏览器存储不可用，暂时不能发送 ‖ 浏览器存储不可用，请稍后重试 ‖ 身份已变化，请刷新页面 ‖ 已停止等待，可以重试 |  |
| web/event-client/controller.js | :544 当前已有浏览器身份，请先连接核对，不会自动新建。 ‖ :545 旧身份不能凭昵称恢复… ‖ :546 请明确选择昵称和分身。 ‖ :551 身份资料版本已变化，请重新确认。 ‖ :556/:564 请确认向本场成员展示昵称和分身。 ‖ :563 现场已经切换，请先查看这个邀请码的预览。 ‖ :569 请明确选择仅自己可见或向本场成员展示。 | 这个浏览器已经有小人了 ‖ 请先勾选确认，再新建小人 ‖ 请填写昵称并选好小人 ‖ 小人资料已变化，请刷新 ‖ 请先勾选同意展示昵称和小人 ‖ 现场已切换，请重新输入邀请码 ‖ 请选择照片给谁看 | 分身 -> 小人 |
| web/event-client/controller.js | :580 请先读取自己创建的现场并确认当前版本。 ‖ :585 请先进入双方都在的开放现场。 ‖ :586 双方都选择愿意打招呼后，才可发起新联系。 ‖ :591 这条招呼已经处理，请刷新后再确认。 ‖ :608 这张照片已不在当前现场回顾中。 ‖ :612 现场或可见范围已变化，旧照片不会展示。 | 请先刷新这一场 ‖ 只能在同一场里招手 ‖ 双方都愿意打招呼才能招手 ‖ 这条招呼已处理过了 ‖ 这张照片已不在回顾里 ‖ 照片已变化，请刷新 |  |
| web/event-client/controller.js | :629 请明确同意导出当前身份的加密备份。 ‖ :630/:640 备份只能绑定当前实际服务地址。/恢复只能使用当前实际服务地址。 ‖ :633/:635 …期间身份已变化，没有导出备份。 ‖ :639 请明确同意核对后替换本浏览器身份。 ‖ :643 已取消恢复，当前身份没有改变。 ‖ :645 服务没有认可这份身份，当前身份没有改变。 ‖ :646 浏览器身份已变化或恢复已取消，没有替换身份。 ‖ :653/:659 身份已变化，旧内容不会显示。/身份已变化，旧创作内容不再显示。 | 请先勾选同意导出备份 ‖ 备份地址与当前网址不符 ‖ 身份已变化，未导出备份 ‖ 请先勾选同意替换身份 ‖ 已取消恢复 ‖ 这份备份已失效，身份未改变 ‖ 恢复未完成，身份未改变 ‖ 身份已变化，请刷新页面 | identity backup is Node only |
| web/event-client/identity-backup.js | :14 请选择12至128个字符的独特备份密码。 ‖ :15 当前浏览器没有可用的安全加密能力，不能导出或恢复身份。 ‖ :30 不支持这份备份的格式或加密参数。 ‖ :31 这份备份属于另一个服务地址。为保护身份，不会向当前地址提交凭据。 ‖ :51 备份密码不正确，或文件已经损坏。当前身份没有改变。 | 备份密码需要12至128个字符 ‖ 浏览器缺少安全加密能力，无法备份 ‖ 不支持这份备份的格式 ‖ 这份备份属于另一个服务地址 ‖ 密码不正确或文件已损坏 | :11 备份只能绑定一个明确的房间服务来源。 stays (test /来源/) |
| web/event-client/moderation-controller.js | :28 浏览器身份已变化，请重新打开管理界面。/请先核对当前身份。 ‖ :29 无法保存原操作的重试记录，暂时不能提交。 ‖ :41/:53 重试记录无法保存，尚未发送。 ‖ :43 发送状态不能保存，请恢复存储。 ‖ :51 连接没有确认结果，请保留原操作。 ‖ :54 请明确确认向本场房主提交这项反馈。 ‖ :56 请明确确认将这个身份移出本场。 ‖ :57 请明确允许此身份重新申请。 | 身份已变化，请重新打开 / 请先确认你的小人身份 ‖ 浏览器存储不可用，暂时不能提交 ‖ 浏览器存储不可用，尚未发送 ‖ 浏览器存储不可用，请稍后重试 ‖ 结果未确认，请稍后重试 ‖ 请先勾选确认提交反馈 ‖ 请先勾选确认移出 ‖ 请先勾选允许重新加入 |  |
| web/event-client/exchange-controller.js | :16 请核对双方的两张照片及版本。 ‖ :17/:214 请明确同意预览…/请明确同意交换这两张指定照片。 ‖ :48 无法保存原操作的重试编号… ‖ :79/:80 浏览器身份已变化，请重新打开交换。/请先核对当前浏览器身份。 ‖ :150 身份已变化，原操作留给原身份确认。 ‖ :162/:171 原操作…不能保存，请恢复本机存储后重试。 ‖ :187 连接没有确认结果，可用原操作重试。 ‖ :202 已有待确认操作，请先确认原操作。 ‖ :205 重试编号无法保存，尚未发送。 ‖ :212 请重新读取并核对这项交换。 ‖ :219 当前尚无可确认的照片访问权限。 ‖ :228 身份或访问范围已变化，不展示旧照片。 | 照片已变化，请重新选择 ‖ 请先勾选同意交换 ‖ 浏览器存储不可用，暂时不能发送 ‖ 身份已变化，请重新打开 / 请先确认你的小人身份 ‖ 身份已变化，请刷新页面 ‖ 浏览器存储不可用，请稍后重试 ‖ 结果未确认，可以重试 ‖ 还有待确认的操作，请先处理 ‖ 浏览器存储不可用，尚未发送 ‖ 交换状态已变化，请刷新 ‖ 还不能查看这两张照片 ‖ 照片已变化，请刷新 |  |
| web/event-client/chat-controller.js | :36 本机存储不可用。草稿仍在… ‖ :95/:96 浏览器身份已改变，请重新打开对话。/请先确认当前浏览器身份。 ‖ :113 身份已切换。原操作仍待原身份确认，不代表已撤回。 ‖ :242 发送状态无法保存… ‖ :276 连接没有确认结果，可用原消息重试。 ‖ :291 已有待确认操作，请先用原操作重试。 ‖ :295 重试编号还不能保存… ‖ :300 当前不能发送新消息，请刷新好友状态。 ‖ :301 请输入1至1000个字的有效文字。 ‖ :312 结果未确认，必须保留原操作重试。 | 浏览器存储不可用，暂时不能发送 ‖ 身份已变化，请重新打开对话 / 请先确认你的小人身份 ‖ 身份已变化，请刷新页面 ‖ 浏览器存储不可用，请稍后重试 ‖ 结果未确认，可以重发原消息 ‖ 还有待确认的消息，请先重试 ‖ 浏览器存储不可用，草稿还在 ‖ 现在不能发消息，请刷新 ‖ 请输入1至1000个字 ‖ 结果未确认，请重试 |  |
| web/avatar/three-scene.js | :499 canvas print ORIGINAL FICTIONAL PRINT | ORIGINAL PRINT | gallery prints in the 3D venue |

## Area: panels

Files: web/event-room/{moment-upload,moment-wall,exchange-panel,exchange-suggest,memory-card,memory-card-view,memory-card-png,recap-view,chat-panel,community-panel,space-management,corner-panel,corner-png,music-games,music-topics,music-card,worldcup-panel,personal-space,moderation-panel,wardrobe,identity-continuity-panel,original-map-entry}.js, web/js/photo-insight.js

### Tests owned

- tests/event-moment-upload.test.js: :18 NUDGE, :126-:129 fixtures (labels 人海那张/舞台那张, no notes, DEMO_TIME label 把拍摄时间设成 21:47 / note 你填写的时间), :345/:346/:348/:355/:362/:371 (FINE texts; sample-group marker -> 或者挑一张今晚的 or .moment-samples), :529 正在载入照片…, :544 找不到这张照片, :577 no sample flag, :725 empty hint, :736/:1313 offNight, :744/:746/:1381 demo-time texts, :1106 NUDGE_PLAIN, plus photo-insight lines at :212 :627-:649 :685 :708 :825 :828 :1003-:1017 :1053 :1327
- tests/event-moment-wall.test.js: GROUP_NOTE :68-:71 (3 分钟内拍下, still under .moment-group__note), untimed note gone :170, ribbon gone :179-:188 :237 :255 (assert no data-moment-ribbon); cast-name fixture :17 may drop ·示例
- tests/event-exchange-suggest.test.js: RULE_NOTE gone :111-:115, NO_RECOMMENDATION :119 :121, missing-time reason :84-:88 :319, exchange-panel no-photo text :307; fixture :157 may drop ·示例
- tests/event-memory-card.test.js: :13 /文字纪念票/ still matches
- tests/event-moderation-panel.test.js: :19 /本场房主/ still matches; update :24 (只移出这一场，TA 在照片墙上的分享会撤下。), :28 (这是本场房主，你可以屏蔽 TA 或离场。 / 这张照片看不到了。), :37 (还有一步没完成，请先处理下方的记录。)
- tests/event-chat-notice.test.js: :9 -> /服务已收到上一条.*无需重发/; fixtures :44 :72 may use the new shell error texts
- tests/event-wardrobe.test.js: :133 /原内容重试/ still matches; :69 :82 :108 unchanged
- tests/event-corner-export.test.js: verify after the corner-panel/corner-png edits
- scripts/test/insight.test.mjs: :33-:37 viewpointHint and AI_NOTE_ROOM new texts (room hint still must not contain '，照片不上传'), :92 TIME_OUT_OF_RANGE keeps the no-break space (/2000\s年至明天/)

### Changes (111 entries)

| file | current | new | note |
|---|---|---|---|
| web/event-room/moment-upload.js | :98 SAMPLES_TITLE 没有现场照片？用示例照片试试 | 或者挑一张今晚的 | group title under the file button; the tour card uses 放一张今晚的照片 |
| web/event-room/moment-upload.js | :99 SAMPLE_NOTE_FALLBACK 时间为虚构 ‖ :559 sample flag <b>示例照片</b> · ${note} | (remove both: render no data-sample-flag line) | the capture-time line stays |
| web/event-room/moment-upload.js | :100 WORKING.sample 正在载入示例照片… | 正在载入照片… |  |
| web/event-room/moment-upload.js | :101 DEMO_NOTE 你填写的时间 · 演示用 ‖ :102 DEMO_LABEL 演示用：把拍摄时间设成示例现场的时间 ‖ :493 已把拍摄时间设成 ${time}（演示用）· 再按一次撤销 | 你填写的时间 ‖ 把拍摄时间设成这一场的时间 ‖ 已设成 ${time} · 再按一次撤销 | static passes copy.js DEMO_TIME_COPY (label 把拍摄时间设成 21:47); keep data-demo-time |
| web/event-room/moment-upload.js | :103 NUDGE_WITH_AI 先选一个视角（AI 还在判断时也可以自己选）… ‖ :104 NUDGE_PLAIN 先选一个视角。没有视角，就找不到同一刻的另一面。 | 先选一个视角，不用等 AI。 ‖ 先选一个视角。 |  |
| web/event-room/moment-upload.js | :105 FINE_STATIC 照片会缩小并去除位置信息，只保存在这个浏览器里；… ‖ :106 FINE_SERVER 保存时照片会上传至受权限保护的房间服务… | 照片会缩小，并去掉位置信息。 ‖ 照片会缩小、去掉位置信息后上传。 | Node stays true (upload on save) |
| web/event-room/moment-upload.js | :385 找不到这张示例照片 | 找不到这张照片 | same as static boot.js:689 |
| web/event-room/moment-upload.js | :487 hint 改过的时间以你填的为准。 | (empty: keep p[data-taken-hint]) |  |
| web/event-room/moment-upload.js | :490 这个时间不在示例现场那一晚（${date}），按规则不算同一刻。 | 这个时间不在 ${date} 那晚，不算同一刻。 |  |
| web/event-room/moment-upload.js | :562 label.file-choice 选照片 | 用我自己的照片 (when sample buttons exist) ‖ 选照片 (otherwise, Node) | static-binding :517 still sees 选照片 in Node markup |
| web/js/photo-insight.js | :16 AI_NOTE_ROOM AI 在本机判断，判断时照片不上传；保存现场卡时才上传照片 | AI 在本机判断，判断时不上传照片 | Node only; never promise the photo is never uploaded |
| web/js/photo-insight.js | :26 NO_TIME 没读到拍摄时间（截图或转发的图常会丢失） ‖ :28 TIME_OUT_OF_RANGE 这个时间不在可选范围内（2000 年至明天），没有采用；不填也能保存。 | 没读到拍摄时间 ‖ 时间需在 2000 年至明天之间。 | keep U+00A0 between 2000 and 年 |
| web/js/photo-insight.js | :77 viewpointHint 配对时，用它来找互补的那一面。+ AI 在本机判断，照片不上传，没把握就不替你选，选了也随时可改。 | 配对时，用它找另一面。 + (AI on) local: AI 在本机判断，照片不上传，你说了算。 / room: AI 在本机判断，判断时不上传照片。你说了算。 |  |
| web/js/photo-insight.js | :242 取自文件信息，只是大概，不一定是拍摄时间；… ‖ :243 选填，不填也能保存；填了才能按时间配对「同一刻」。 | 文件里的时间，只是大概；改一下才算数。 ‖ 选填；填了才能找「同一刻」。 | :239 sample note 示例照片的虚构时间 is classic-only; leave |
| web/event-room/moment-wall.js | :7 GROUP_NOTE 按拍摄时间分组（相差不超过 3 分钟），规则判断，不是 AI | ${SAME_MOMENT_MS / 60_000} 分钟内拍下 (= 3 分钟内拍下) | keep .moment-group__note; NOTE_UNITS may wrap 3 分钟内 in nowrap |
| web/event-room/moment-wall.js | :9 UNTIMED_NOTE 没有拍摄时间，无法按时间配对 | (remove: no note under 没有拍摄时间) |  |
| web/event-room/moment-wall.js | :10 PIPELINE_RIBBON AI 建议视角 → 规则找同一刻 → 双方同意才交换 | (remove the ribbon element) | per-photo AI 建议，未改动 bylines stay |
| web/event-room/exchange-panel.js | :11 statuses 等待本人回应 ‖ 在线访问已结束 | 等待对方回应 ‖ 交换已撤销 | 交换已接受 / 对方谢绝了 / 申请已结束 / 申请已过期 unchanged |
| web/event-room/exchange-panel.js | :12 boundary 任一方撤销，会同时结束本次两张照片的在线访问；原件仍归各自… | (remove at both uses, :45 and :59) |  |
| web/event-room/exchange-panel.js | :19 这张图的预览仍太大，请换一张较简单的照片。 ‖ :30 正在核对照片… ‖ :39 请先核对当前浏览器身份，再打开照片交换。 ‖ :44 你在这一场还没有照片。先保存一张自己的，再回来交换。 | 预览太大，请换一张照片。 ‖ 正在读取照片… ‖ 请先确认你的小人身份。 ‖ 先放一张自己的照片，再来交换。 |  |
| web/event-room/exchange-panel.js | :45 发送后，${name} 可以看并保存我的小图预览。TA 明确接受后… ‖ consent 我同意提供选中照片的预览，并在对方接受后分享这张原图 ‖ 照片或场次范围已变化，请重新打开并选择。 | 发出后，TA 先看到小图；TA 接受后，你们互看原图。 ‖ 我同意先给小图，TA 接受后再给原图 ‖ 照片有变化，请重新选择。 | judge route; [data-x-consent] unchanged; 把这两张交给对方确认 ↗ unchanged |
| web/event-room/exchange-panel.js | :48 操作已由服务收到，当前权限还没读取出来。无需重新发起。 / 正在核对这项交换。 ‖ :52 · 最新权限待确认 / 操作已由服务收到。当前权限还没读取出来，不需要重新发起。 ‖ :89 操作已由服务收到，最新权限暂未读出… | 服务已收到，无需重发。 / 正在读取… ‖ · 待刷新 / 服务已收到，无需重发。 ‖ 服务已收到，无需重发。 | keeps COPY_RULES service-received matching (static: 已收到，无需重发。) |
| web/event-room/exchange-panel.js | :53 限尺寸预览 ‖ :54 这次交换不再提供照片访问。各自的原件仍保留… ‖ :55 申请有效至 ${date}。换另一张图需要结束此申请后重新发起。 | 小图预览 ‖ 这次交换已结束。 ‖ 有效至 ${date} |  |
| web/event-room/exchange-panel.js | :56 接受后，你会把自己的这张指定原图分享给 ${name}… ‖ consent 我已核对两张照片，同意这次交换 | 接受后，你们互看这两张原图。 ‖ 我同意交换这两张 | 同意，交换这两张 button unchanged |
| web/event-room/exchange-panel.js | :57 对方尚未同意，原图还没有通过本次交换开放。 ‖ :58 双方已明确同意。退出房间后，还能从「照片交换」回来查看。 / 撤销这次交换的在线访问 | 等 TA 接受后，就能互看原图。 ‖ 散场后也能在「照片交换」里看。 / 撤销这次交换 | judge route end (交换已接受) |
| web/event-room/exchange-panel.js | :60 确认结束本次两张照片的双向在线访问？不会删除各自原件。 ‖ 确认撤回这个申请？对方将不能继续读取这次小图预览。 ‖ 确认谢绝这次申请？ ‖ 返回查看 ‖ :61 核对最新状态 | 撤销后，你们都看不到对方那张了。 ‖ 撤回这个申请？ ‖ 谢绝这次交换？ ‖ 再想想 ‖ 刷新 | 确认撤销/确认撤回/确认谢绝 unchanged |
| web/event-room/exchange-panel.js | :63 照片交换与交朋友分开决定。这里留下双方明确选中的两张照片。 ‖ 还没有交换。照片分享不要求交换；想交换时，双方各自选择一张。 | 你的每一次交换，都在这里。 ‖ 还没有交换。去照片墙找找同一刻的另一面。 |  |
| web/event-room/exchange-panel.js | :65 正在确认原操作… / 结果还没确认，请保留原操作 / 原选择重试 / 移除失败记录 / 停止本机等待 | 正在确认… / 结果未确认，可以重试 / 重试 / 移除 / 不再等待 | 发起交换 / 处理交换 labels unchanged |
| web/event-room/exchange-panel.js | :73 照片权限已变化，请重新核对。 ‖ :80 请在当前开放的现场，选择另一人放到照片墙的照片。 ‖ :87 照片范围刚刚变化，请重新选择。 ‖ :104 仅停止本机等待，不代表撤回已经送达的申请。 | 照片有变化，请刷新。 ‖ 只能交换照片墙上别人的照片。 ‖ 照片有变化，请重新选择。 ‖ 已停止等待。 |  |
| web/event-room/exchange-suggest.js | :8 RULE_NOTE 规则判断，不是 AI。要不要交换，仍由你和对方决定。 | (remove; drop the <small> at :57) | never label the rule as AI; the reason text stays |
| web/event-room/exchange-suggest.js | :9 NO_RECOMMENDATION 没有找到「同一刻的另一面」。你也可以自己选一张… ‖ :42 ${…}没有拍摄时间，无法判断是不是同一刻。 | 没找到同一刻的另一面，自己选一张吧。 ‖ ${对方的这张\|你的这张\|两张照片都}没有拍摄时间。 |  |
| web/event-room/memory-card.js | :3 所选内容已变化，请重新核对后保存。 ‖ :7 请确认仅将所选内容下载到你的设备。 ‖ :31 暂未保存，恢复连接后可重试。 | 内容有变化，请重新选择。 ‖ 请先勾选确认。 ‖ 没保存成功，请重试。 |  |
| web/event-room/memory-card-view.js | :4 确认身份和可用内容后，再保存纪念卡。 | (remove) |  |
| web/event-room/memory-card-view.js | :6 只选自己的照片，最多两张。也可以不选照片，保存一张文字纪念票。 ‖ 署名保留 ‖ 这一页还没有自己的照片。文字纪念票仍可保存… ‖ 带上已保存的小人 ‖ 造型和署名以你现在确认的内容为准。 | 最多选两张自己的照片；不选就是一张文字纪念票。 ‖ (remove, with its separator) ‖ 这一页没有你的照片，也能存文字纪念票。 ‖ 带上我的小人 ‖ (remove) |  |
| web/event-room/memory-card-view.js | :6 consent 确认仅将所选内容下载到我的设备。照片可见范围不变。 ‖ 正在核对所选内容并准备图片… / 已发起下载，请查看设备的下载列表。/ 连接恢复后，先重新核对可用内容。 ‖ 取消保存，返回回顾 / 重新核对可用内容 / 再次下载这张成品 ‖ 不会上传或自动公开。已下载的副本无法通过撤销召回… | 确认保存到我的设备 ‖ 正在生成纪念卡… / 已开始下载。 / 连接恢复后请刷新。 ‖ 取消 / 刷新 / 再下载一次 ‖ (remove) |  |
| web/event-room/memory-card-png.js | :10 EMPTY_NOTE 不必交换联系方式，也能留下自己的记忆。 ‖ PRIVACY 私人纪念 · 分享副本前，请确认你愿意公开其中内容。 | 散场以后，记忆还在。 ‖ 私人纪念 | header MUSIC SPACE / 这一晚 already brands the PNG |
| web/event-room/recap-view.js | :6 正在核对你现在可以查看的照片和联系… ‖ :9 暂未确认最新状态。下面是上次读取的记录… | 正在读取这一晚… ‖ 先显示上次读取的记录。 |  |
| web/event-room/recap-view.js | :10 我的长期音乐社群 ‖ 聊天室需明确加入；不改变照片权限或自动添加好友。 | Livehouse 乐迷社群 ‖ (remove) |  |
| web/event-room/recap-view.js | :11 选择自己的照片和小人，做一张带署名的私人纪念卡。 ‖ 不包含私聊、朋友名单或他人的照片，不自动公开。 | 用你的照片和小人，做一张纪念卡。 ‖ (remove) |  |
| web/event-room/recap-view.js | :12 自己的照片，以及读取时仍获授权的共享照片。 ‖ 离场后只保留自己的照片，不再读取别人的共享图。 ‖ :13 已经双方同意的定向交换有独立权限… | (remove) ‖ 离场后只保留自己的照片。 ‖ 散场后也能看，随时可以撤销。 | event-room-binding :447 matches 离场后只保留自己的照片 |
| web/event-room/recap-view.js | :14 h3 从本场开始的联系 ‖ 现在仍互为朋友。关系变化后，这里也会更新。 ‖ 这里还没有当前有效的双向联系。 ‖ :15 只显示当前有权查看的内容；刷新和切页会重新核对。 | 在这一场认识的人 ‖ (remove) ‖ 还没有在这一场认识的人。 ‖ (remove .recap-refresh-note text) |  |
| web/event-room/recap-view.js | :16 输入另一个现场的邀请码 ‖ 自己开一场 | 去另一个现场 ‖ 我是 Livehouse / 主办方，开个房 | 再见，在下一场。 and 我的现场记录 unchanged |
| web/event-room/chat-panel.js | :7 上一条已由服务保存。记录暂未刷新，恢复连接后会继续读取，不必重发。 | 服务已收到上一条，无需重发。 | static build: 已收到上一条，无需重发。 |
| web/event-room/chat-panel.js | :14 对方明确接受后才能私聊 ‖ footer 仅文字 · 照片仍由各自决定分享范围 | 互相接受后就能私聊 ‖ (remove text; keep the 回看这一晚 button) |  |
| web/event-room/chat-panel.js | :28 正在确认对话与当前关系… ‖ 已互相接受联系。这里只保存文字，不展示在线状态。 ‖ 这份联系已结束。既往消息仍可查看，不能再发送新消息。 | 正在打开… ‖ 你们已经是朋友了。 ‖ 这段联系已结束，只能看以前的消息。 | no presence claim |
| web/event-room/chat-panel.js | :29 既往对话 ‖ 先在同场的人里打个招呼，双方接受后就能私聊。 ‖ 已展开更多记录，自动刷新暂缓以保留位置。 | 以前的对话 ‖ 先去同场的人里打个招呼。 ‖ 已暂停自动刷新。 |  |
| web/event-room/chat-panel.js | :30 已保存 (own message status) ‖ :31 已保存 = 服务已收到，不代表对方已读 ‖ 联系结束后不能发送 ‖ 正在确认发送… / 发送结果还未确认，保留原内容 / 原内容重试 / 移除失败记录 | 已发送 ‖ (remove) ‖ 联系已结束 ‖ 正在发送… / 发送未确认，可以重试 / 重试 / 移除 |  |
| web/event-room/community-panel.js | :7 aria 音乐社群与聊天室 ‖ :13 浏览器未保存草稿，请在关闭前复制文字。 ‖ :16 h2 fallback 音乐社群 | 乐迷社群与聊天室 ‖ 草稿没存上，关闭前请先复制。 ‖ Livehouse 乐迷社群 | eyebrow 散场以后，也留一个位置 unchanged |
| web/event-room/community-panel.js | :17 已归档 · 暂停新的参与，保留历史阅读 / 开放中的长期空间 ‖ 空间与活动 ‖ 上一操作仍待确认，请用原请求重试。 / 确认原操作结果 | 已归档 / 开放中 ‖ 下一场预告 ‖ 上一步还没确认，可以重试。 / 重试 | data-group-space unchanged |
| web/event-room/community-panel.js | :17 主办方的长期空间。每次加入都由你选择；不订阅营销，不扩大照片权限。 ‖ 还没有加入的社群。 | 散场后，乐迷留在场地的社群里；下一场的预告直接发到这里。 ‖ 还没有加入乐迷社群。 |  |
| web/event-room/community-panel.js | :17 create form 我的音乐社群 (title label) ‖ 创建长期空间，展示我的昵称、小人与发言 ‖ 创建我的社群 | 社群名称 ‖ 创建社群，向成员展示我的昵称、小人和发言 ‖ 创建 Livehouse 乐迷社群 |  |
| web/event-room/community-panel.js | :17 你已被房主移出，需房主恢复资格后本人重新加入。 ‖ 加入后，成员能看到你的昵称、小人与主动发送的文字。安静参与不会改变，不自动加好友，不订阅营销。 ‖ 明确加入，继续聊 ‖ 已静音 · 不显示提醒 | 你已被移出这个聊天室。 ‖ 加入后，大家能看到你的昵称、小人和发言。 ‖ 加入，继续聊 ‖ 已静音 | consent 我愿意加入这个聊天室 unchanged |
| web/event-room/community-panel.js | :17 停止入场和上传后仍可聊… ‖ 退出后停止读取与发言… ‖ 文字仍由作者和房主管理。 ‖ 场景里的小人代表社群成员，不代表正在在线或实际到场。你的新联系偏好：…发言和好友是两种选择。 | (remove all four) | the mode toggle button still shows the state |
| web/event-room/community-panel.js | :17 改为安静，不接新招呼 / 我愿意在社群打招呼 ‖ summary 社群里的小人 ‖ 招个手，仍需对方接受 | 改为安静参与 / 我愿意打招呼 ‖ 社群成员 ‖ 招个手 |  |
| web/event-room/community-panel.js | :17 context tags 成员自填 · 未核实 / 本聊天室小游戏结果 / 本聊天室 Worldcup ‖ 重看这份话题或结果 ‖ 还没有发言。可以安静坐一会儿，也可以主动留一句。 ‖ 把这一页收到的消息标为已读 | 成员话题 / 小游戏结果 / 专辑世界杯 ‖ 去看看 ‖ 还没有人说话，来说第一句吧。 ‖ 标为已读 |  |
| web/event-room/community-panel.js | :17 toolbar 一起玩 · 默契局／音乐关系接龙 / 成员音乐话题 · 发布与讨论 / 专辑世界杯 · 一起选张来聊 | 一起玩 / 音乐话题 / 专辑世界杯 | data-group-games/-topics/-worldcup unchanged |
| web/event-room/community-panel.js | :17 正在讨论「${title}」 · 成员自填，未核实 / 取消话题引用 ‖ 正在回复所选消息 ‖ 正在确认… / 发送到聊天室 ‖ 恢复资格，仍需本人重新加入 | 正在聊「${title}」 / 取消 ‖ 正在回复 ‖ 正在发送… / 发送 ‖ 允许重新加入 |  |
| web/event-room/community-panel.js | :18 本场主办方的长期社群 ‖ 我的长期音乐社群 ‖ 绑定我维护的长期空间 / 关联这个场次 | 这家 Livehouse 的乐迷社群 ‖ 我的乐迷社群 ‖ 关联我的乐迷社群 / 关联到这一场 |  |
| web/event-room/community-panel.js | :23 Music Map · 沿音乐探索 ↗ ‖ :25 本场与管理 ··· | 音乐探索 ↗ ‖ 设置与管理 ··· |  |
| web/event-room/community-panel.js | :26 准备分享的音乐发现 · 仍需明确确认 / 把音乐发现与留言分享给当前聊天室成员 / 确认分享这份发现 / 取消，保留聊天草稿 | 分享这首歌 / 分享给聊天室成员 / 分享 / 取消 | 想说的一句话 unchanged; consent box stays |
| web/event-room/community-panel.js | :30 身份已变化，请重新确认。 ‖ :35 移出后对方不能继续读取与发言，是否继续？ / 退出后不能再读取或发送，已有好友私聊保留。确定退出？ / 本场还未关联长期社群。房主可先创建再关联。 | 身份有变化，请刷新。 ‖ 把 TA 移出聊天室？ / 退出这个聊天室？ / 这一场还没有关联乐迷社群。 |  |
| web/event-room/space-management.js | :11 本机未能保留草稿，请在关闭前复制文字。 ‖ :15 eyebrow SPACE / 让下一次见面有个地方 ‖ h2 fallback 空间与活动 ‖ 重新读取空间 ‖ 上次操作结果待确认… / 确认原操作结果 ‖ 正在读取空间和活动… | 草稿没存上，关闭前请先复制。 ‖ LIVEHOUSE / 下一场见 ‖ 下一场预告 ‖ 重新读取 ‖ 上一步还没确认，可以重试。 / 重试 ‖ 正在读取… |  |
| web/event-room/space-management.js | :15 已归档 · 历史可读，暂停新的参与 / 开放中 · 每次参与由本人决定 ‖ 主办方还没有留下空间介绍。 ‖ 活动预告是主办方自填信息，不是到场认证… ‖ 维护我的空间 / 空间名称 / 空间介绍 / 归档，仅保留历史阅读 ‖ 归档不删除历史、好友或个人回顾… ‖ 确认更新以上介绍与状态 / 明确保存空间 / 放弃修改，读取最新资料 | 已归档 / 开放中 ‖ 还没有社群介绍。 ‖ (remove) ‖ 编辑社群资料 / 社群名称 / 社群介绍 / 归档 ‖ (remove) ‖ 确认更新社群资料 / 保存 / 放弃修改 |  |
| web/event-room/space-management.js | :15 h3 接下来的见面 ‖ 已关联现场 / 活动预告 · 尚未开现场 ‖ 现场「${title}」 · 可预览入场 / 已结束入场 ‖ · 你的入场资格已被移除 ‖ 预览现场，再决定是否加入 ‖ 社群身份不恢复现场资格或照片权限。 | 下一场 ‖ 房间已开 / 下一场预告 ‖ 现场「${title}」 · 可以进场 / 已结束 ‖ · 你已被移出 ‖ 去看看这一场 ‖ (remove) |  |
| web/event-room/space-management.js | :15 为这个活动开现场 / 关联我已创建的现场 / 选择本人创建的现场 / ${title} · 可入场 / 已结束入场 ‖ 确认向本社群提供邀请码；每人仍需同意入场 / 明确关联这个现场 ‖ 还没有活动预告。先留下下次见面的想法，再单独开现场。 | 为这一场开房 / 关联我开的房间 / 选一个我开的房间 / ${title} · 可以进场 / 已结束 ‖ 把这一场的邀请码给社群成员 / 关联 ‖ 还没有下一场预告。 |  |
| web/event-room/space-management.js | :15 已关联的现场记录 / ${title} · 已结束入场 / 查看现场预览 / 预览现场 ‖ 此处不读取照片；自己的回顾在「我的空间」。 ‖ 发布新的活动预告 / 活动名称 / 时间（北京时间，可留空）/ 给成员的话 / 确认向本社群成员发布活动资料 / 发布活动预告 ‖ 刷新空间与活动 | 关联的场次 / ${title} · 已结束 / 可以进场 / 去看看 ‖ (remove) ‖ 发布下一场预告 / 演出名称 / 时间（北京时间，可留空） / 给乐迷的话 / 发布给社群成员 / 发布预告 ‖ 刷新 |  |
| web/event-room/space-management.js | :20 服务器已确认，待确认记录未能清除… ‖ :22 服务器已确认；现场加入与照片权限仍独立。 ‖ :27 aria 空间与活动 / 本机草稿或待确认记录无法读取… ‖ :30 明确取消这个预告？不会删除已有现场或成员的回顾。 | 服务器已确认。 ‖ 服务器已确认。 ‖ 下一场预告 / 草稿没能读取。 ‖ 取消这次预告？ | server-confirmed keeps matching (static: 已确认。) |
| web/event-room/corner-panel.js | :17 服务已确认，但原请求记录未能清理… ‖ :20 草稿无法保存在浏览器，请在关闭前复制自己的留言。 ‖ :21 本地草稿或原请求记录不可读取，请先核对。 ‖ :52 服务已确认这次操作。 | 服务已确认。 ‖ 草稿没存上，关闭前请先复制。 ‖ 草稿没能读取。 ‖ 服务已确认。 | service-confirmed keeps matching (static: 已确认。) |
| web/event-room/corner-panel.js | :30 alt 署名者主动提供的照片 / 照片暂时读不到，可重新读取；未生成无照片的替代成品。 ‖ :32 小人与留言：${name}（· 照片同署名）/ 二维手绘小人 · 双方主动提供的共同草稿 | 共同纪念里的照片 / 照片没读到，请刷新。 ‖ ${name} 的这一面 / 我们的共同草稿 | 正在读取照片。 unchanged |
| web/event-room/corner-panel.js | :36 上一操作结果未确认，不自动重新发送。/ 按原请求确认结果 ‖ 仅当前双向朋友可邀请。先展示自己的署名与小人… ‖ 我选择邀请这位朋友，展示自己的署名与小人 / 创建共同创作邀请 ‖ 共同成果是独立、私有的选择，不展示到现场或社群。显示最近50份。 | 上一步还没确认。 / 重试 ‖ 邀请 TA 一起做一张双人纪念。 ‖ 邀请 TA，并展示我的昵称和小人 / 发出邀请 ‖ 只有你们两个人看得到。 |  |
| web/event-room/corner-panel.js | :36 旧成果已不可用 / 等待对方本人参与 / 收到一个共同邀请 / 继续共同草稿 / 曾明确保存 · ‖ 还没有共同创作。可从一位双向朋友的人物卡发出邀请。 ‖ 正在核对共同草稿及权限。 ‖ 任一方已撤销共同创作… | 已失效 / 等待对方加入 / 收到邀请 / 继续创作 / 已保存 · ‖ 还没有共同创作。去朋友的人物卡里邀请 TA。 ‖ 正在读取… ‖ 这次共同创作已撤销。 |  |
| web/event-room/corner-panel.js | :36 对方邀请你进入共同草稿。参与会展示自己的署名与小人… / 我本人选择参与，展示自己的署名与小人 / 明确参与共同创作 ‖ 等待朋友本人明确参与。你不能替对方同意，也不会自动分享照片。 ‖ 素材已撤回或改变；共同预览、确认、保存及导出已暂停… | TA 邀请你一起做一张纪念。 / 加入，并展示我的昵称和小人 / 加入 ‖ 等 TA 加入。 ‖ 有素材变了，请重新选择。 |  |
| web/event-room/corner-panel.js | :36 我选择的本人照片 / 不带照片，只用小人与留言 / 我的照片 N · 私藏 / 本场展示 / 读取更多本人照片 ‖ 对方或另一标签已编辑，草稿仍在… / 保留我的草稿，按新版本复核 ‖ 我选择把当前署名、小人、留言和所选本人照片提供给这一位共同创作者 ‖ 照片只在这个创作角定向读取…编辑会撤回双方的旧确认。 | 我的照片 / 不放照片 / 我的照片 N · 未上墙 / 已上墙 / 更多照片 ‖ TA 刚改过，你的草稿还在。 / 保留我的草稿 ‖ 把我的小人、留言和照片给 TA ‖ (remove) | 我的一句话 unchanged |
| web/event-room/corner-panel.js | :36 保存我的草稿部分 / 自己的未提交草稿不进入共同成品… / 放弃我的未提交改动 ‖ 我确认当前共同成果及双方署名 / 我选择把双方确认的这一版本保存到我的创作 ‖ 这一版本已保存到我的创作；对方是否保存，由对方另行选择。 ‖ 我选择导出双方确认的署名、小人、留言及所选照片 / 生成共同纪念PNG ‖ 内容编辑、素材变动或关系失效后需重新确认。主动下载的文件无法远程收回。 | 保存我的部分 / 你的改动还没保存。 / 放弃改动 ‖ (consents) 我确认这一版 / 把这一版存到我的创作 ‖ 已保存到我的创作。 ‖ (consent) 导出这一版 / (button) 生成纪念图 PNG ‖ (remove) | buttons 确认这一版本 and 保存到我的创作 unchanged |
| web/event-room/corner-panel.js | :36 alt 实际生成的共同纪念PNG / 核对权限并下载PNG / 关闭成品预览 / 我选择撤销共同创作 ‖ :51 先确认上一操作结果。/ 无法保存原请求，本次操作未发送。 ‖ :56 已停止等待旧创作。/ 共同成果或权限已改变，不能继续导出。 ‖ :57 已取消生成。/ 成品已生成；下载仍需你主动选择。 | 我们的共同纪念图 / 下载 PNG / 收起预览 / 撤销共同创作 ‖ 上一步还没完成。 / 没发出去，请重试。 ‖ 已停止等待。 / 内容有变化，请重新导出。 ‖ 已取消生成。 / 纪念图做好了。 |  |
| web/event-room/corner-panel.js | :59 请先建立自己的小人身份。/ aria 私有双人创作角 ‖ :62 撤销后双方不能继续读取、保存或导出共同内容。确定撤销？ ‖ :63 本人照片列表暂未读取，可先用小人与留言… ‖ :65 连接已断开，共同内容暂时收起… | 请先做一个自己的小人。 / 双人创作角 ‖ 撤销这次共同创作？ ‖ 照片没读到，先用小人和留言吧。 ‖ 连接断了，草稿还在，恢复后请刷新。 |  |
| web/event-room/corner-png.js | :75 需要双方可用的小人和署名。 ‖ :76 小人与留言分别由署名者提供 · 双方确认版 ${revision} ‖ :78 浏览器暂不支持导出，可保留已保存的创作记录。 ‖ :104 导出未完成，请重新选择导出。 | 需要双方的小人。 ‖ 我们一起做的 · 第 ${revision} 版 ‖ 这个浏览器暂不支持导出。 ‖ 导出没完成，请重试。 |  |
| web/event-room/music-games.js | :14 原创虚构示例 / 成员自填 · 未核实 ‖ :15 本机没有保存草稿，请在关闭前复制文字。 ‖ :19 自愿参与，可随时退出。这里没有人格、匹配分或品味排名。 ‖ 重新读取本局 / 上一笔操作待确认。保留原请求… / 确认原操作结果 | 原创专辑卡 / 成员自填 ‖ 草稿没存上，关闭前请先复制。 ‖ 想玩就加入，随时可以退出。 ‖ 重新读取 / 上一步还没确认，可以重试。 / 重试 |  |
| web/event-room/music-games.js | :19 默契局先各自选，再揭晓本轮合计；关系接龙使用留档关系卡… ‖ 空间已归档，小游戏历史可读，暂停新发起。/ 空间已归档，暂停新的参与和推进… ‖ 等待自愿加入 / 已完成 · 可重看结果 / 已结束，未产生完整结果 ‖ 这里还没有小游戏。两位成员愿意加入，就能开始一局。 | 默契局：先各自选，再一起揭晓。接龙：一人接一首。 ‖ 社群已归档。 ‖ 等人加入 / 已完成 / 已结束 ‖ 还没有小游戏，来开一局吧。 | 音乐偏好默契局 / 音乐关系接龙 / 正在玩 unchanged |
| web/event-room/music-games.js | :19 邀请大家自愿玩一局 / 我自己填写四个文字选项 / 选项 N · 成员自填，未核实 ‖ 使用四个原创虚构专辑示例；没有音频、真实封面或真实音乐人。 ‖ 已留档关系卡 / 我自填的音乐文字 ‖ 成员自填，未核实；下一位说明自己的关联… ‖ 明确向本聊天室发起小游戏；不代替任何人加入 / 发起这局，等待自愿参与 | 开一局 / 自己写四个选项 / 选项 N ‖ 用四张原创专辑卡。 ‖ 关系卡 / 我自己写 ‖ (remove) ‖ 在聊天室发起这一局 / 发起这一局 |  |
| web/event-room/music-games.js | :19 ${n} 位目前仍有资格的参与者 / 等待本人自愿加入 ‖ 选择仅用于这一局；不会改变联系意愿… / 我自愿参加这一局 / 明确加入小游戏 ‖ 退出删除未揭晓选择… ‖ 至少两人自愿加入后开始；不会替其他成员选择。 ‖ 接龙起点 · 已留档关系卡 / 成员自填，未核实 | ${n} 人参加 / 等人加入 ‖ (remove) / 我要参加这一局 / 加入这一局 ‖ (remove) ‖ 两人以上就能开始。 ‖ 接龙起点 · 关系卡 / 成员自填 |  |
| web/event-room/music-games.js | :19 ${n} 人已提交；揭晓前只显示你自己的选择。 ‖ 确认提交本轮选择；本轮不能改票 / 先保留我的选择 / 取消，尚未提交 ‖ 你的选择已提交。其他人的答案仍未公开，等待揭晓。 ‖ 本局已开始，未加入的人可阅读揭晓后的合计… ‖ 揭晓会停止本轮提交… / 明确结束本轮并揭晓合计 | ${n} 人已选 ‖ 就选它，提交后不能改 / 提交 / 取消 ‖ 已提交，等一起揭晓。 ‖ 这一局已开始，下一局再来。 ‖ (remove) / 结束这一轮并揭晓 |  |
| web/event-room/music-games.js | :19 当前轮到的人已不在可见成员中；主办方可明确跳过 / 。不替别人作答。 ‖ 已核实的共同音乐人 / 我的个人联想（未核实）/ 留档关系卡 / 自述方式的名称 / 自述音乐人（可留空）/ 我的关联理由 ‖ 核实方式只能使用关系卡之间已有的共同音乐人… ‖ 明确把这一段接龙发布给本聊天室 ‖ 本步由管理者明确跳过：${reason}。没有代答。 | 轮到的人已离开 / (remove) ‖ 共同音乐人 / 我的联想 / 关系卡 / 歌名 / 音乐人（可留空） / 为什么接这首 ‖ (remove) ‖ 发到聊天室 ‖ 这一步跳过了：${reason} |  |
| web/event-room/music-games.js | :19 只描述这一局出现的共同选择，不代表人格或匹配程度。 ‖ 这一轮各自有不同选择，也可以接着聊。没有强行选出优胜者。 ‖ 这一步当前不可见，不绕过屏蔽读取。 ‖ 已核实的共同音乐人关系；下面的理由是成员自己的话 / 成员自述 · 未核实 ‖ 没有虚构接龙答案。 | (remove) ‖ 这一轮大家选得都不一样，正好接着聊。 ‖ 这一步看不到。 ‖ 共同音乐人 / 成员的联想 ‖ 这一步没有答案。 |  |
| web/event-room/music-games.js | :19 这一步暂时无法继续 / 明确跳过，不替成员作答 ‖ 结束本局并删除未揭晓选择，不编造结果。/ 明确结束这一局 ‖ 把这一局带回讨论 / 明确把本局结果入口和我的话发到聊天室 ‖ 本局没有完整结果。已公开的步骤可回看… ‖ 本聊天室的小游戏与历史 / 刷新游戏状态 | 跳过这一步 / 确认跳过 ‖ (remove) / 确认结束这一局 ‖ 带回聊天室 / 把结果和这句话发到聊天室 ‖ 这一局提前结束了。 ‖ 全部小游戏 / 刷新 |  |
| web/event-room/music-games.js | :24 服务器已确认；本机记录未清除，下次可按原请求核对。 ‖ :25 服务器已确认这次操作。 ‖ :27 本机待确认记录或草稿无法读取… / aria 自愿音乐小游戏 ‖ :29 退出会删除尚未揭晓的选择…确定退出？ | 服务器已确认。 ‖ 服务器已确认。 ‖ 草稿没能读取。 / 音乐小游戏 ‖ 退出这一局？ |  |
| web/event-room/music-topics.js | :8 成员的音乐话题 ‖ 下列名称、音乐人和话语由成员自填，未核实。四张留档关系卡是通往独立 Music Map 的小桥… ‖ 重新读取话题 / 上次发布或撤回待确认，保留原请求。/ 确认原操作结果 / 空间已归档，保留阅读和撤回，暂停新发布。 | 音乐话题 ‖ (remove) ‖ 重新读取 / 上一步还没确认，可以重试。 / 重试 / 社群已归档。 | MUSIC / 从一首歌接着说 unchanged |
| web/event-room/music-topics.js | :8 成员自填 · 未核实 / ${author} 留下的话题 ‖ 把这个话题带回聊天室 ‖ 还没有成员话题。留一首让你想到现场的歌，也留一句你想聊的话。 ‖ 明确向当前聊天室发布我的自填文字 / 发布音乐话题 / 刷新话题 | 成员自填 / ${author} 留下的话题 ‖ 带回聊天室聊 ‖ 还没有话题。留一首让你想起今晚的歌吧。 ‖ 发到聊天室 / 发布 / 刷新 |  |
| web/event-room/music-topics.js | :10 服务器已确认；本机待确认记录未清除… ‖ :11 服务器已确认。引用撤回的话题不会继续显示其资料。 ‖ :12 本机未保留草稿，请在关闭前复制文字。 ‖ :14 本机草稿或待确认记录无法读取，请保留原内容。/ aria 成员音乐话题 ‖ :16 撤回这份自填话题？引用将不再展示话题资料… | 服务器已确认。 ‖ 服务器已确认。 ‖ 草稿没存上，关闭前请先复制。 ‖ 草稿没能读取。 / 音乐话题 ‖ 撤回这个话题？ |  |
| web/event-room/music-card.js | :6 在应用内探索这段关系 ↗ ‖ ${sourceLabel} · 署名依据 ↗ ‖ 应用内 Music Map；本卡没有音频、歌词或唱片封面。资料核对于 ${checkedAt}。 | 去音乐探索里看看 ↗ ‖ ${sourceLabel} ↗ ‖ (remove) |  |
| web/event-room/music-card.js | :9 带一首歌来聊 · Music Map ‖ 从已核对的共同演唱关系出发。探索不会发送消息… ‖ 确认把音乐卡和我的留言发给当前聊天室成员 | 带一首歌来聊 ‖ (remove) ‖ 分享给聊天室成员 | currently not shown in the joined layout; aria labels and 分享音乐卡 unchanged |
| web/event-room/worldcup-panel.js | :9 本机草稿不可读，请重新填写；没有发布。 ‖ :10 草稿只在当前页面，刷新可能丢失；还没有发布。 ‖ :12 服务器已确认；本机待确认记录未清理… ‖ :13 ${mark} · 原创虚构专辑 / 成员自填 · 未核实 | 草稿没能读取，请重新填写。 ‖ 草稿没存上，关闭前请先复制。 ‖ 服务器已确认。 ‖ ${mark} · 原创专辑卡 / 成员自填 |  |
| web/event-room/worldcup-panel.js | :16 这局选项由成员自填，未核实；仅使用本站绘制的文字版式… / 可以使用四张原创虚构专辑示例，也可以自己填写四个文字选项。+ 投票只描述本聊天室的选择，不是榜单或品味评分… ‖ 空间已归档，历史结果可读，暂停发起、投票与结果发布。 ‖ 有一笔待确认操作，先用原请求核对结果。/ 确认原请求结果 | 两两对决，选出今晚这一张。 ‖ 社群已归档。 ‖ 上一步还没确认，可以重试。 / 重试 | 这一晚，选张专辑来聊 / 这里还没有专辑世界杯。 unchanged |
| web/event-room/worldcup-panel.js | :16 当前与历史 / 已经完成的结果 ‖ ${creator}发起 · 原创虚构示例 / 成员自填，未核实 · 已完成 / 进行中 ‖ 正在读取这个聊天室的世界杯。/ 看更早的20个 / 正在读取当前轮次。 ‖ 我自己填写四个文字选项 / 选项 N · 成员自填，未核实 ‖ 确认向当前聊天室发布上面的四个文字选项并发起投票 / 发起四张专辑的世界杯 | 筛选 / 已完成 ‖ ${creator} 发起 · 已完成 / 进行中 ‖ 正在读取… / 更早的 / 正在读取… ‖ 自己写四个选项 / 选项 N ‖ 在聊天室发起这场世界杯 / 发起世界杯 |  |
| web/event-room/worldcup-panel.js | :16 ${creator}发起 · 本轮已完成 / 每轮每个身份一票，投后不能改票 ‖ 最后一轮 ‖ 本轮选择：《${title}》 ‖ 明确结束本轮并晋级 / 至少有一张真实投票才能结束。/ 由发起者明确结束这一轮；离开或被移除时暂停晋级。 | ${creator} 发起 · 已完成 / 每轮一票 ‖ 决赛 ‖ 胜出：《${title}》 ‖ 结束这一轮 / 至少要有一票。 / 等发起人结束这一轮。 |  |
| web/event-room/worldcup-panel.js | :16 确认把这一票计入《${title}》？/ 确认投票，提交后这一轮不能改票 / 确认这一票 / 取消，不投票 ‖ 结束后该轮不再接受投票，结果按服务器当前票数决定。 ‖ 平票时明确选择 / 留下平票决定的理由 / 确认结束本轮（，平票决定会显示给成员）/ 确认结束并晋级 / 取消，继续投票 | 投给《${title}》？ / 投出后不能改 / 投票 / 取消 ‖ 结束后这一轮停止投票。 ‖ 平票，选一张晋级 / 理由 / 确认结束这一轮 / 结束并晋级 / 继续投票 | the vote-count COPY_RULE source goes away; static deletes that rule |
| web/event-room/worldcup-panel.js | :16 明确把本局结果入口和我的话发回聊天室 / 把结果带回讨论 / 本聊天室的世界杯与历史 / 刷新轮次 / 回到聊天室讨论 ‖ :19 这一轮已变化，请重新查看后确认。 ‖ :22 本机无法保留待确认请求…尚未发送。/ 服务器已确认这次操作。 ‖ :27 本机待确认记录不可读，请保留原请求结果。/ aria 虚构专辑世界杯 | 把结果和这句话发到聊天室 / 带回聊天室 / 全部世界杯 / 刷新 / 回到聊天室 ‖ 这一轮有变化，请再看一眼。 ‖ 没发出去，请重试。 / 服务器已确认。 ‖ 本机记录没能读取。 / 专辑世界杯 |  |
| web/event-room/personal-space.js | :11 我的署名与已保存小人 ‖ 正在读取本人空间… / 重新读取本人记录 ‖ 我的音乐社群 (quick button) / 我的社群 (h3) ‖ 私聊回访 ‖ 主持、已加入、退出与被移除分别标注，打开不会自动加入。 | 我的小人 ‖ 正在读取… / 重新读取 ‖ 我的乐迷社群 / 我的乐迷社群 ‖ 私聊 ‖ (remove) | MY SPACE / 长期留在这里 and 现场是认识的起点… unchanged |
| web/event-room/personal-space.js | :11 还没有长期社群。可以明确创建自己的空间，或先预览朋友的邀请。/ 创建或预览社群邀请 ‖ · 查看本人回顾 ‖ 还没有现场。先预览邀请，再决定是否带着小人加入。/ 预览现场或开一场 / 查看全部现场和照片记录 | 还没有加入乐迷社群。 / 加入或创建社群 ‖ · 回顾 ‖ 还没有去过的现场。 / 进场或开个房 / 全部现场和照片 |  |
| web/event-room/personal-space.js | :11 双方同意的朋友 · 打开私聊 ‖ 还没有双向朋友。不用急，愿意打招呼时再认识同场或同社群的人。/ 完整好友与招呼列表 ‖ 社群和好友不授予旧现场照片权限。身份备份只由本人选择… | 朋友 · 私聊 ‖ 还没有朋友。去同场的人里打个招呼吧。 / 全部好友与招呼 ‖ (remove) |  |
| web/event-room/moderation-panel.js | :6 房主已移出该身份 / 房主已结束处理，未在此反馈下移出 ‖ :7 只移出这一场：撤下其照片墙分享，取消待回应的交换。本人原件、已接受的定向交换和朋友关系仍保留… ‖ :13 这位观众还有一项未完成处理。请先在下方按原选择重试… | 房主已移出 TA / 房主已查看 ‖ 只移出这一场，TA 在照片墙上的分享会撤下。 ‖ 还有一步没完成，请先处理下方的记录。 |  |
| web/event-room/moderation-panel.js | :15 · 提交时的昵称 ‖ 反馈指向一张现场照片。/ 按当前权限查看照片 / 照片已撤下，或你当前无权查看；反馈不会额外开放图片。 ‖ 移出本场并结束这项反馈 / 已查看，不采取移出 | (remove) ‖ 关于一张照片 / 查看照片 / 这张照片看不到了。 ‖ 移出本场 / 已查看，不移出 | 撤回这项反馈 unchanged |
| web/event-room/moderation-panel.js | :18 请先核对当前浏览器身份。 ‖ :20 请从当前现场的成员或照片打开反馈。 ‖ :21 这份说明会交给本场房主查看。不会自动附上私聊… ‖ placeholder 请只说明现场行为，不要填写私聊正文或联系方式。 ‖ consent 我同意把这段说明和选定目标交给本场房主 ‖ 房主能看到你填写的说明，不显示你的身份字段… | 请先确认你的小人身份。 ‖ 请从同场的人或照片发起反馈。 ‖ 只有本场房主会看到。 ‖ 说说现场发生了什么 ‖ 把这段说明交给本场房主 ‖ (remove) | 是什么情况？ / 告诉房主具体发生了什么 / 提交给本场房主 unchanged |
| web/event-room/moderation-panel.js | :23 你提交给各场房主的反馈。它们只由对应房主处理，其他普通观众看不到。 / 正在读取自己的反馈… ‖ :24 正在确认本场房主身份… ‖ :27 下面是观众反馈，尚不代表事实已经核实… ‖ :28 你需要仍在本场，才能从当前名单选择成员… ‖ :29 此身份不能再加入本场 / 已允许重新申请；不会自动入场 / 允许重新申请 / 这是对本场匿名身份的限制，不是现实身份认证或全站封禁。 ‖ :30 核对最新状态 | 只有对应场次的房主能看到。 / 正在读取… ‖ 正在读取… ‖ (remove) ‖ 暂时没有可移出的成员。 ‖ 已移出，不能再加入 / 可以重新加入 / 允许重新加入 / (remove) ‖ 刷新 |  |
| web/event-room/moderation-panel.js | :32 只恢复申请资格。对方仍须本人同意加入… / 撤回后，房主仍会看到这项记录已撤回… / 结束这项反馈的处理，不在这条反馈下移出成员。/ 返回查看 ‖ :33 正在确认这项操作… / 结果还没有确认 / 按原选择重试 / 移除失败记录 | TA 可以重新加入这一场。 / 撤回后，房主会看到它已撤回。 / 不移出，结束这项反馈。 / 再想想 ‖ 正在确认… / 结果未确认，可以重试 / 重试 / 移除 |  |
| web/event-room/moderation-panel.js | :39 目前没有独立平台申诉渠道；房主不会审核针对自己的反馈。你仍可选择屏蔽或离场。 / 这张照片不在当前本场可见范围内。 ‖ :42 操作已由服务收到，最新处理状态暂未确认… / 操作已由服务收到，列表暂未更新… ‖ :44 现场或身份已变化，请重新打开反馈。/ 向房主反馈 ${name}（待确认标签） | 这是本场房主，你可以屏蔽 TA 或离场。 / 这张照片看不到了。 ‖ 服务已收到，无需重复提交。 / 服务已收到，列表稍后更新。 ‖ 有变化，请重新打开。 / 向房主反馈 ${name} | service-received keeps matching |
| web/event-room/moderation-panel.js | :50 结束这项反馈的处理？/ 确认移出并结束反馈 / 确认不采取移出 ‖ :51 允许 ${name} 重新申请？/ 允许重新申请 | 结束这项反馈？ / 确认移出 / 确认，不移出 ‖ 允许 ${name} 重新加入？ / 允许重新加入 |  |
| web/event-room/wardrobe.js | :15 试试组合示例 ‖ 会替换当前穿搭，之后仍可逐件修改。 ‖ :16 正在确认保存，请稍候；关闭不能撤回已经提交的保存。 ‖ :24 保存结果暂未确认。关闭衣橱后，在「待确认操作」用原内容重试，不能当作已撤回。 | 试试现成搭配 ‖ 一键换装，之后还能逐件改。 ‖ 正在保存，请稍候。 ‖ 保存还没确认，可在「待确认操作」里用原内容重试。 | keep the literal 取消 (code compares textContent) |
| web/event-room/identity-continuity-panel.js | :5 身份存在当前浏览器。提前备份可以迁移到同一服务… ‖ 文件由本机加密，只由你保管。密码不上传… ‖ 独特的备份密码（12至128个字符）/ 我明确选择导出当前身份的加密备份，自行保管文件与密码 / 制作并下载加密备份 ‖ 选择自己保管的备份文件 / 核对同一服务后，明确替换本浏览器身份… / 核对并恢复身份 | 换手机或清缓存前，先备份你的小人。 ‖ 备份文件已加密，忘记密码就打不开。 ‖ 备份密码（至少 12 位） / 导出加密备份，由我自己保管 / 下载加密备份 ‖ 备份文件 / 用备份替换现在的身份 / 恢复身份 | Node only |
| web/event-room/identity-continuity-panel.js | :8 正在本机核对，请稍候… / 加密备份已生成，请保管文件和密码。没有上传至云端。 | 正在处理… / 备份已下载，请保管好文件和密码。 |  |
| web/event-room/original-map-entry.js | :9 当前离线，恢复连接后再打开音乐探索；聊天草稿会保留。 ‖ :12 浏览器无法保留返回位置，请允许本机存储后重试。 | 离线了，联网后再打开音乐探索。 ‖ 浏览器不允许存储，请开启后重试。 |  |

## Area: static

Files: web/static-runtime/** (boot, runtime, showcase/*), scripts/build/static-html-plugin.mjs, runtime-preview/src/*.js (error messages only), docs: AGENTS.md, docs/design/doodle.md, scripts/demo/README.md, scripts/pages/README.md

### Tests owned

- tests/static-demo-ui.test.js: copy values (:80-:100), WITH_AI/WITHOUT_AI (照片墙帮你找到同一刻的另一面，双方同意就交换。), shared strings (:131-:141: no CAST_LABEL export or ''), entry (:200-:260: new eyebrow/h2/lead/consent/participation hints/submit/host details, no 虚构/自动回复/没有服务器), About (:399-:466 rewritten for the new sections), roomInvite (:476-:488), tour (:520-:610: 第一次来 n/4, 放一张今晚的照片, 人海那张/舞台那张/用我自己的照片), demo-hooks (:795, :890-:906), demo time (:941-:950); keep the BANNED audit and add a demo-word audit (see risks); fixtures WORLD/SAMPLES drop ·示例
- tests/static-boot.test.js: TEXT (:226-:231), rescue labels (:837-:838 重新开始 / 打开经典版), :1288 找不到这张照片
- tests/static-showcase-seed.test.js: roster (:105-:107, :128-:141; samples without note; lines without DISCLOSURE; drop the DISCLOSURE import), :71 'a name' mutation -> '小满二', :466-:473 rewrite targets name '小满', PINNED_WORLD entry for SEED_REV 3 (digest printed by the failing test); optional community assertions
- tests/static-autopilot.test.js: lines test (:145-:158: new WELCOME_LINES/GENERIC_LINES, no DISCLOSURE; keep the no-person regexes), roster sync (:170-:176), names (:242 :414 :442)
- tests/static-runtime.test.js: READ_ONLY_MESSAGE (:806-:807, :819)
- tests/static-copy-transform.test.js: three rules only (fixtures 服务器已确认。->已确认。, 服务已确认。->已确认。, 服务已收到，无需重发。->已收到，无需重发。), the every-occurrence fixture, the matched-nothing test (use another rule than stop-waiting), rescue labels (:264-:328), noscript/nomodule (:119-:120, :352)
- scripts/test/static-build.test.mjs: no edit expected (it iterates COPY_RULES); run it on a STATIC_OUT build
- tests/event-room-static-binding.test.js: fixtures :51 :53 :110-:111 (回声现场 / 月台 Livehouse / plain names / samples), :208 (entry must NOT mention 虚构), :234 (正在布置现场…), :255 still /勾选|愿意/, :314 预览版 unchanged, :316 (cast names without ·示例 are NOT listed in About: assert the disclosure sentence instead), :323 :326 :341 (memory-only note 这个浏览器不能保存，刷新后会重新开始), :363 :368 (现在还不能重新开始，请稍后再试。), :376 (no cast-badge), :380 server fixture, :387 :391 (shell people-alone copy), :431 (no ribbon: panels), :445 (wall fine print removed: shell), :509 :510 :517 :518 (panels FINE texts: 照片会缩小，并去掉位置信息。 / 照片会缩小、去掉位置信息后上传。; Node keeps 选照片), :533 :655 unchanged
- tests/static-prefix-sync.test.js: optional comment update only (:9 「重置示例数据」 -> 「重新开始」)

### Changes (45 entries)

| file | current | new | note |
|---|---|---|---|
| web/static-runtime/showcase/copy.js | statusReady 示例现场 · 在本页运行 ‖ statusPreparing 正在布置示例现场… ‖ reconnectLabel 重新连接示例现场 ‖ reconnectToast 示例现场已就绪 | 现场进行中 ‖ 正在布置现场… ‖ 重新连接 ‖ 已重新连接 | statusPreparing must equal boot.js TEXT.preparing |
| web/static-runtime/showcase/copy.js | RULES_SENTENCE 规则帮你找到同一刻的另一面，双方同意才交换。 | 照片墙帮你找到同一刻的另一面，双方同意就交换。 | lobby card: 同一晚，你拍了舞台，TA 拍了人海。[AI 在本机给你一个视角建议，]照片墙帮你找到同一刻的另一面，双方同意就交换。 |
| web/static-runtime/showcase/copy.js | joinLabelLobby 进入示例现场 ‖ joinLabelRoom 本场与示例说明 ‖ trackNote 原创示例声景 · 不代表真实演出 ‖ evidenceButton 示例站 · 数据只存在这个浏览器 · 关于这个示例 ‖ nonHttpToast 请通过网址打开；离线 HTML 无法运行示例现场 | 进入现场 ‖ 本场信息 ‖ 本场原创声景 ‖ 关于 Music Space ‖ 请用网址打开 Music Space | keys unchanged (COPY_KEYS); trackNote/nonHttpToast equal the Node defaults |
| web/static-runtime/showcase/copy.js | CAST_LABEL 示例角色 · 自动回复 | (remove the export; demo-hooks castLabel() returns '') | no cast badge in 同场的人 |
| web/static-runtime/showcase/copy.js | RESET_CONFIRM 重置会清除这个浏览器里的示例数据：…确定要重置吗？ | 重新开始会清除你的昵称、小人、照片和交换，确定吗？ |  |
| web/static-runtime/showcase/copy.js | MEMORY_ONLY_NOTE 示例数据只保存在本页，刷新会重置 ‖ READ_ONLY_NOTE 示例已在另一个标签页打开，这里不能操作 | 这个浏览器不能保存，刷新后会重新开始 ‖ 已在另一个标签页打开，这里只能看 | equal to boot.js TEXT.memoryOnly / TEXT.readOnly |
| web/static-runtime/showcase/copy.js | DEMO_TIME_COPY label 演示用：把拍摄时间设成示例现场的 21:47 ‖ note 你填写的时间 · 演示用 | 把拍摄时间设成 21:47 ‖ 你填写的时间 | pressed text comes from moment-upload: 已设成 21:47 · 再按一次撤销 |
| web/static-runtime/showcase/copy.js | TOUR_SAMPLES 人海 · 示例照片 / 舞台 · 示例照片 ‖ TOUR_MORE ['我的空间','音乐社群','专辑世界杯','一起玩','音乐探索'] | 人海那张 / 舞台那张 ‖ ['我的空间','乐迷社群','专辑世界杯','一起玩','音乐探索'] | same labels as roster SAMPLE_PHOTOS |
| web/static-runtime/showcase/entry-panel.js | PARTICIPATION open 别人可以招手；成为朋友仍需我明确接受。 ‖ quiet 照样保存和分享照片，不接收新招呼。 | 别人可以向我招手 ‖ 照片照常分享，不接新招呼 | same as app.js:109 |
| web/static-runtime/showcase/entry-panel.js | eyebrow 示例现场 · 回声现场（虚构） ‖ h2 带上小人，进入示例现场 ‖ lead ${who}都是虚构的，由这个页面自动回复，不是真人。进去后先放一张你的照片，看看你拍到的是哪一面。 | 月台 Livehouse · 回声现场 ‖ 带上小人，进入现场 ‖ 进去后先放一张今晚的照片，看看你拍到的是哪一面。 | drop the who/castNames builder (林间 arrives later, so naming the cast as present would be untrue) |
| web/static-runtime/showcase/entry-panel.js | hint known 这个浏览器里已经有你的小人，会直接带着它进去。 ‖ hint new 先用这个小人，入场后随时能逐件换装。 | 已经有你的小人了，直接带它进去。 ‖ 入场后随时能换装。 |  |
| web/static-runtime/showcase/entry-panel.js | consent 我愿意向本场成员（示例角色）展示我的昵称和小人。数据只存在这个浏览器里。 ‖ submit 进入示例现场 ‖ status 正在布置示例现场… | 我愿意向本场成员展示我的昵称和小人 ‖ 进入现场 ‖ 正在布置现场… | consent stays required; identical to app.js joinConsent |
| web/static-runtime/showcase/entry-panel.js | fine 没有服务器，也没有账号：这个示例完全在你的浏览器里运行，选择只存在这里。 ‖ button 关于这个示例 | (remove) ‖ 关于 Music Space |  |
| web/static-runtime/showcase/entry-panel.js | <summary>自己开个房</summary> ‖ 也可以在这个浏览器里自己开一个房间：只有你自己，示例角色不会来。 ‖ <button data-open=create>自己开个房</button> | 我是 Livehouse / 主办方，开个房 ‖ 为每一场演出开一个房间；散场后，乐迷留在你的乐迷社群里。 ‖ 开一个房间 |  |
| web/static-runtime/showcase/entry-panel.js | JOIN_CONSENT_REQUIRED 请先勾选：我愿意向本场成员（示例角色）展示我的昵称和小人。 ‖ SHOWCASE_NOT_READY 示例现场还没有布置好，请稍后再试。 | 请先勾选同意，再进入现场。 ‖ 现场还在布置，请稍后再试。 |  |
| web/static-runtime/showcase/about-panel.js | ABOUT_SECTIONS what/cast/photos/ai/rules/data/version ‖ eyebrow 示例站 · 回声现场（虚构） ‖ h2 关于这个示例 ‖ lead 真的：…模拟的：同场的人。 ‖ all section texts | [['what','这是什么'],['livehouse','给 Livehouse'],['ai','AI'],['privacy','隐私'],['data','在线版'],['version','版本']] ‖ 同一刻，另一面 ‖ 关于 Music Space ‖ see about_sheet for every line | drop the SAME_MOMENT_MS import; castNames param ignored; download line only when ai==='on', AI_OFF_LINES line otherwise |
| web/static-runtime/showcase/about-panel.js | memory-only 这个浏览器没有让这里保存数据：${MEMORY_ONLY_NOTE}。 ‖ read-only 这个标签页是只读的：${READ_ONLY_NOTE}。重置请在先打开的那个标签页里做。 ‖ fine 点「重置示例」会先让你确认一次… ‖ button 重置示例 | ${MEMORY_ONLY_NOTE}。 ‖ ${READ_ONLY_NOTE}。要重新开始，请回到先打开的那个标签页。 ‖ (remove) ‖ 重新开始 | keep data-demo-reset, data-confirm, disabled in a read-only tab |
| web/static-runtime/showcase/about-panel.js | version fine 更早的 0.16 版本称为早期原型，只有本地双角色示例，不属于这个示例。 | (remove) | versionLine unchanged, incl. 预览版：发布前的测试副本，不是最终版本 on the preview channel |
| web/static-runtime/showcase/about-panel.js | roomInviteMarkup lead (showcase / own room) + fine 真正的多人房间需要完整的房间服务… + button 关于这个示例 | <div class="demo-room-note"><button type="button" class="quiet" data-open="about">关于 Music Space</button></div> | same for both rooms; no invite UI added |
| web/static-runtime/showcase/tour.js | step photo 放一张你的照片 / 选一张示例照片最快；也可以用你自己的照片。 ‖ other-side hint 照片墙会标出和你同一刻、拍到另一面的那张… ‖ exchange hint 点「和 TA 交换这个视角」，勾选同意再发出… ‖ people hint 向同场的示例角色招手，对方接受后可以私聊；散场后还能回看这一晚。 | 放一张今晚的照片 / 挑一张，或者用你自己的。 ‖ 照片墙会把它标出来。 ‖ 在照片墙点「和 TA 交换这个视角」。 ‖ 向同场的人招个手，对方接受就能私聊。 | buttons 人海那张 / 舞台那张 / 用我自己的照片; other titles and buttons unchanged |
| web/static-runtime/showcase/tour.js | :67 示例路线 ${n}/${total} ‖ :69 aria ${label}示例路线 ‖ :100 aria 示例路线 | 第一次来 ${n}/${total} ‖ ${label}路线 (收起路线 / 展开路线) ‖ 第一次来 | 跳过路线 / 知道了，收起路线 / 路线走完了 unchanged |
| web/static-runtime/showcase/roster.js | SEED_REV = 2 ‖ DISCLOSURE （示例角色的自动回复：我不是真人。） | SEED_REV = 3 (comment: 3: complete-product copy — names, room, venue, lines, sample labels) ‖ (remove the export) |  |
| web/static-runtime/showcase/roster.js | ROOM title 回声现场 · 示例场 / venue 月台 Livehouse（虚构场地） ‖ names 阿遥·示例 小满·示例 北屿·示例 林间·示例 | 回声现场 / 月台 Livehouse ‖ 阿遥 小满 北屿 林间 | rewrite the header comment (no 「·示例」 rule) |
| web/static-runtime/showcase/roster.js | lines yao 大家好，今晚我把舞台这一面放上了照片墙。${DISCLOSURE} ‖ man 我拍的是人海这一面，手都举起来了。${DISCLOSURE} ‖ bei 我只拍了看台边的一盏灯，算细节。${DISCLOSURE} | 大家好，我是月台的阿遥。今晚舞台这一面，我先放上照片墙啦。 ‖ 我拍的是人海这一面，手都举起来了。 ‖ 我只拍了看台边的一盏灯，算细节。 | 阿遥 is the room host = the venue's person; passes the no-person regexes; must equal npc-lines GROUP_LINES |
| web/static-runtime/showcase/roster.js | SAMPLE_PHOTOS label 人海 · 示例照片 / 舞台 · 示例照片 ‖ note 虚构的拍摄时间 21:48（21:47），写在文件里 | 人海那张 / 舞台那张 ‖ (remove the note property) | the EXIF time stays in the files; the time row reads 拍摄于 21:48 · 来自照片自带的信息 |
| web/static-runtime/showcase/npc-lines.js | DISCLOSURE export ‖ WELCOME_LINES[0] 嗨，欢迎来到「回声现场」。我是示例角色，由这个页面自动回复。 ‖ GENERIC_LINES[2] = DISCLOSURE ‖ GROUP_LINES yao/man/bei = line + DISCLOSURE | (remove) ‖ 嗨，欢迎来到「回声现场」！ ‖ 下次月台见！ ‖ the three roster lines, no suffix | WELCOME_LINES[1] 你拍到的是哪一面？ and GENERIC_LINES[0..1] unchanged; rewrite the header comment |
| web/static-runtime/showcase/demo-hooks.js | :109 正在布置示例现场… ‖ :117 这个示例现在不能重置。 ‖ :102 castLabel -> CAST_LABEL | copy.statusPreparing (正在布置现场…) ‖ 现在还不能重新开始，请稍后再试。 ‖ castLabel returns '' |  |
| web/static-runtime/boot.js | TEXT preparing 正在布置示例现场… ‖ memoryOnly 示例数据只保存在本页，刷新会重置 ‖ readOnly 示例已在另一个标签页打开，这里不能操作 ‖ healed 示例已更新，已为你重新布置 ‖ failed 示例现场没能启动。可以重新载入，或重置示例数据后再试。 | 正在布置现场… ‖ 这个浏览器不能保存，刷新后会重新开始 ‖ 已在另一个标签页打开，这里只能看 ‖ 现场已更新 ‖ 现场没能打开，请重新载入或重新开始。 | dismiss 知道了 unchanged; update the header comments that quote old strings |
| web/static-runtime/boot.js | :689 找不到这张示例照片 | 找不到这张照片 | same as moment-upload.js:385 |
| web/static-runtime/runtime.js | :36 READ_ONLY_MESSAGE 示例已在另一个标签页打开，这个标签页不能操作。请回到那个标签页，或关闭它后刷新本页。 | 已在另一个标签页打开，请回到那里操作。 |  |
| scripts/build/static-html-plugin.mjs | COPY_RULES server-confirmed 服务器已确认->示例已确认 ‖ service-confirmed 服务已确认->示例已确认 ‖ service-received 服务已收到->示例已收到 ‖ vote-count ‖ stop-waiting | to: 已确认 ‖ to: 已确认 ‖ to: 已收到 ‖ (delete rule) ‖ (delete rule) | panels keeps the three sources; shell removes stop-waiting's source; panels removes vote-count's; update the header comment and the JSDoc |
| scripts/build/static-html-plugin.mjs | rescue body 这个示例在你的浏览器里运行，需要先启动一个本地小数据库… ‖ button 重置示例数据 ‖ link 打开早期原型 ‖ fine 重置只清除这个浏览器里本页的示例数据和身份，不会上传任何内容。 | 先重新载入试试；还不行的话，点「重新开始」。 ‖ 重新开始 ‖ 打开经典版 ‖ 「重新开始」会清除你的昵称、小人、照片和交换。 | heading 页面没能完整启动 and 重新载入 unchanged; href ./classic/ unchanged (owner may drop the link: classic/ still says 示例) |
| scripts/build/static-html-plugin.mjs | noModule 这个浏览器版本太旧，打不开 Music Space 示例页。… ‖ noScript 需要开启 JavaScript 才能打开 Music Space 示例页。 | 这个浏览器版本太旧，打不开 Music Space。请换用较新的 Chrome、Edge、Safari 或 Firefox。 ‖ 需要开启 JavaScript 才能打开 Music Space。 | the map page notices are already fine |
| runtime-preview/src/event-community.js | :35 JOIN_CONSENT_REQUIRED 请确认向聊天室成员展示昵称、小人与自己主动发出的文字；不订阅营销。 | 请先勾选同意，再加入聊天室。 | shared by Node and static; no test asserts these worker messages |
| runtime-preview/src/event-social.js | :101 COMMUNITY_EVENT_REQUIRED 请先由主办方关联真实场次，再从社群建立新联系。 | 主办方关联场次后，才能在乐迷社群里打招呼。 |  |
| runtime-preview/src/event-games.js | :69 TWO_ANSWERS_REQUIRED 至少两位仍在场的参与者作答后才能揭晓；无票不虚构结果。 | 至少两位参与者作答后才能揭晓。 |  |
| runtime-preview/src/event-worldcup.js | :28 请确认在当前聊天室发起虚构专辑投票。 ‖ :46 只能选择这一轮的两张虚构专辑。 ‖ :54 还没有真实投票，不能替大家决定。 | 请先勾选确认，再发起专辑世界杯。 ‖ 只能选这一轮的两张专辑。 ‖ 还没有人投票，不能替大家决定。 |  |
| runtime-preview/src/event-spaces.js | :8 找不到这个长期空间。 ‖ :12 退出、移除或屏蔽后不能继续读取活动资料。 ‖ :18 只有主办方可以维护长期空间。 / 请明确确认更新空间资料和状态。 ‖ :24 只有主办方可以组织活动。 ‖ :25 请确认向本社群成员提供活动资料；现场入场和照片另行授权。 ‖ :26 空间已归档或更新，请重新读取。 | 找不到这个乐迷社群。 ‖ 现在看不到这个社群的预告。 ‖ 只有主办方可以管理乐迷社群。 / 请先勾选确认，再保存社群资料。 ‖ 只有主办方可以发布下一场预告。 ‖ 请先勾选确认，再发布下一场预告。 ‖ 社群已归档或有更新，请刷新。 |  |
| runtime-preview/src/event-spaces.js | :27 活动时间需在过去一天到未来一年之间，也可留空。 ‖ :28 找不到这个活动。 ‖ :29 请选择取消预告或关联已创建的现场。 ‖ :30 活动已关联或取消，不能覆盖已有决定。 ‖ :32 请选择本人创建的现场。 ‖ :33 只能关联本人尚未关联的现场，不会替成员入场。 | 演出时间需在昨天到一年后之间，也可留空。 ‖ 找不到这场预告。 ‖ 请选择取消预告，或关联你开的房间。 ‖ 这场预告已关联或已取消。 ‖ 请选择你开的房间。 ‖ 只能关联你开的、还没关联过的房间。 |  |
| runtime-preview/src/admission-protocol.js | :34 NFC 标签需要可由手机访问的 HTTPS 邀请地址；本机 HTTP 仍可复制链接或二维码。 | 写 NFC 需要 HTTPS 地址，可以先用链接或二维码 | Node only |
| web/static-runtime/showcase/seed.js | (nothing seeded) the showcase room has no linked community | OPTIONAL, do last: as host 阿遥 with fixed keys, POST /communities {title:'月台 Livehouse 乐迷社群', joinConsent:true}; POST /rooms/{roomId}/community {communityId}; POST /communities/{id}/space {title:'月台 Livehouse 乐迷社群', description:'散场后，乐迷留在这里；下一场的预告也发在这里。', archived:false, revision, editConsent:true}; POST /communities/{id}/events {title:'回声现场 Vol.2', venue:'月台 Livehouse', startsAt:null, note:'时间定了就在这里说。', organizeConsent:true} | content only (existing APIs), covered by SEED_REV 3; without it 「这家 Livehouse 的乐迷社群」 shows 这一场还没有关联乐迷社群。; drop it if seed/autopilot tests need logic changes |
| AGENTS.md | 诚实规则 3, 7, 9, 10, 11 and 端侧 AI 预下载的例外 (「关于这个示例」里写明了这件事) | add a dated 2026-10-07 section on top: one disclosure only, in About (在线版里的场地、观众和照片是演示内容，观众会自动回复。); no ·示例 names, no sample/fiction labels, no explanatory or legal fine print; Livehouse framing; About states the ~10 MB background download when the model can run; rules 1, 2, 4, 5, 6, 8 still hold | keep the older text as history, as the file already does |
| docs/design/doodle.md | §5 judge route 「进入示例现场」→ 勾选同意 →「进入示例现场」→ 示例路线卡「人海 · 示例照片」… ‖ 带示例角色的评委版 | 「进入现场」→ 勾选同意 →「进入现场」→「第一次来」卡片「人海那张」→ 上传表单 →「保存这张照片」→ 照片墙 →「和 TA 交换这个视角」→ 勾选 →「把这两张交给对方确认 ↗」→ 几秒后「交换已接受」 ‖ 带种子角色的评委版 |  |
| scripts/demo/README.md | cast names with ·示例, SEED_REV notes | 阿遥 / 小满 / 北屿 / 林间; SEED_REV 3 entry |  |
| scripts/pages/README.md | rescue labels 重置示例数据 / 打开早期原型 | 重新开始 / 打开经典版 |  |

## Risks and checks

1. COPY_RULES (build fails if a rule matches nothing): exactly three rules remain — server-confirmed 服务器已确认→已确认, service-confirmed 服务已确认→已确认, service-received 服务已收到→已收到. vote-count and stop-waiting are deleted together with their sources (worldcup end-round note: panels; app.js:314: shell). Panels must keep at least one 「服务器已确认。」 (music-games, music-topics, worldcup-panel, space-management), one 「服务已确认。」 (corner-panel) and start the exchange/moderation/chat notices with 「服务已收到」. No new text in web/static-runtime or runtime-preview may contain 服务器已确认 / 服务已确认 / 服务已收到 (static-build.test.mjs checks the built page; the plugin only rewrites web/event-room and web/event-client). tests/static-copy-transform.test.js 'the real sources still carry every sentence' must pass before the build is tried.
2. Cross-area tests: each test file has one owner, but several assert other areas' strings (event-room-static-binding: panels' FINE texts and ribbon, shell's wall note and people-alone copy; event-room-binding: panels' recap strings). Owners copy this plan's strings verbatim. Areas edit in parallel, so a full npm test (plus scripts/test) is only meaningful after all three land; until then run the owned files.
3. Seeded world: SEED_REV 2→3; add the new digest to PINNED_WORLD; static-showcase-seed.test.js:71 ('a name' mutation sets 小满, now the real name — use 小满二) and :466-:473 (rewrites name '小满·示例') are traps. Stored worlds self-heal with the toast 「现场已更新」, which judges who saw the old build will get once.
4. Hooks: kept with new text — .moment-group__note, p[data-taken-hint] (empty), data-sample-photo, data-demo-time, data-demo-reset, data-x-consent, data-open="about", span#evidence, .demo-room-note, data-group-space and every routing hook. Removed with their text (tests updated by the owners) — data-moment-ribbon, the untimed group note, the exchange boundary .exchange-fine, the sample flag (data-sample-flag), .recap-refresh-note text, the cast badge (castLabel returns ''), the entry fine line, About sections cast/photos/rules, the exchange-suggest <small>. wardrobe.js keeps the literal 取消. No id/class/data-* that JS routes on changes.
5. Layout: the Doodle CSS was tuned for old strings (「人海 · 示例照片」 one-line rule, 「（虚构场地）」 wrap, 「阿遥·示例」 name units, the 「示例路线 2/4」 sticker, the long footer button). New strings are mostly shorter; longer ones are the host entry 「我是 Livehouse / 主办方，开个房」 (entry details summary, Node entry, recap button), the desktop caption small text, the community list intro and the About sections. Re-check at 390×844, 1440×900 and 320 px wide (no overflow, tap targets ≥44 px). CSS comments quoting old strings may be updated but are not UI.
6. Fonts: new characters (乐迷, 隐私, 演示, 挑, 筛 …) need the Doodle font slices regenerated before release, as planned.
7. Honesty checks: 演示 and 自动回复 appear once, in About; 「我是月台的阿遥」 passes static-autopilot's no-person regexes; 「这家 Livehouse 的乐迷社群」 assumes the host is a venue, which is the product framing; 「现场进行中」 and 「{n} 位乐迷」 make no presence claim; 「把拍摄时间设成 21:47」 sets a time the visitor chooses and the row then says 你填写的时间; Node keeps FINE_SERVER (upload on save), AI_NOTE_ROOM and 服务器已确认; the room hint must not contain 「，照片不上传」 (insight.test).
8. Final audit (recommended, static owns the test): add to tests/static-demo-ui.test.js a scan of the rendered corpus and of copy/roster/npc-lines exports for 示例|虚构|模拟|演示|自动回复|不是真人|在本页运行|没有服务器|只存在这个浏览器, allowing only the About sentence; after `STATIC_OUT=/tmp/space-copy/final/dist-pages npm run build:pages`, grep the built index.html for the same words — expected hits: 演示 ×1 and 自动回复 ×1 (the About sentence), nothing else.
9. Still showing demo wording, out of this plan: classic/ (0.16 page; only reachable from the rescue overlay link, renamed 「打开经典版」 — drop the link if the owner prefers), music-map/ (web/original-map: 「情景示例 · 虚构」 labels only on its fictional dataset), web/js/photo-insight.js 'sample' source note 「示例照片的虚构时间」 (classic only), web/event-room/music-map.js (dead module), THIRD_PARTY_NOTICES.md (legal notice for the AI-generated photos; keep).
10. Non-copy bugs seen during the inventory, not fixed here: on phones 林间 (5th member) cannot be opened from the people list (only 4 avatars are drawn, go() is skipped, openPersonDetails never opens the panel); the person panel keeps 「从这张照片认识作者」 after reopening from the people list (contactPhotoId is never cleared). Read-only tabs find the cast by name, so a visitor nicknamed 小满 counts as cast (no visible effect now that the badge is gone).
11. Optional seeded community (static, do last): without it 「这家 Livehouse 的乐迷社群」 in the showcase group chat ends in the toast 「这一场还没有关联乐迷社群。」 — honest, but a dead end for the Livehouse story.
12. Docs: AGENTS.md honesty rules 3/7/9/10/11 and its AI pre-download note (which promises a sentence in 「关于这个示例」) must be superseded by a dated 2026-10-07 section, or later agents will re-add the labels.
