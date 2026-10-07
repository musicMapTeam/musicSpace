# 手绘涂鸦风（Doodle）设计规范

用户 2026-10-06 选定（与队友即产品负责人 igohomealone216 的对齐没有记录，不写成队友已同意）：整套界面、三维场馆和比赛视频统一为手绘涂鸦风。参考图：`/tmp/space-style-refs/11-doodle/mockup.png`（只看风格，不照抄版式）；字体选型：`/tmp/space-fonts/board/BOARD.png`。

一句话：**米色点阵纸上的马克笔涂鸦**。墨黑手绘线框、硬边错位阴影、粉/薄荷/黄三色马克笔点缀、贴纸和胶带、拍立得照片。用户特别要求文字「有色彩、有层次、有大小」：标题要有错位彩色阴影或描边贴纸效果，关键词放大变色，正文和标题的字号差距拉开。

## 1. 基础（已写好，所有人共用，不要改）

- `web/event-room/doodle/tokens.css`：颜色、字体角色、字号、线宽、圆角、阴影、动效变量，一律用 `var(--ds-*)`，不写新的十六进制颜色（三维场馆和 PNG 导出用同一组色值，见 §6）。
- `web/event-room/doodle/type.css`：叠层文字配方 `.ds-title`（墨字 + 彩色错位影）、`.ds-sticker`（彩色字 + 墨描边 + 墨影，贴纸感）、`.ds-hl`（荧光笔底色）、`.ds-key`（关键词放大变粉）、`.ds-note`（手写批注，倾斜）、`.ds-digits`（时间数字）、`.ds-logo`。各有颜色变体，见文件。
- `web/event-room/doodle/kit.css`（外壳负责，各层共用，实施时新增）：手绘形状遮罩 `--ds-svg-*`（星、闪光、加号、波浪线、圈画、箭头、音符、心、勾、圆点、胶带，颜色一律来自 `background:var(--ds-*)`）和胶带色 `--ds-tape*`；装饰 `.ds-deco` 加形状 `.ds-star`、`.ds-sparkle`、`.ds-plus`、`.ds-squiggle`、`.ds-scribble`、`.ds-arrow`、`.ds-music`、`.ds-heart`，颜色 `.ds-deco--pink/--mint/--yellow/--sky/--ink`；胶带 `.ds-tape`（`--pink/--mint/--sky`）；小组件 `.ds-card`、`.ds-chip`（`--mint/--yellow/--pink`）、`.ds-wavy`（波浪下划线）、`.ds-tilt-l/-r`；动效 `.ds-twinkle`（星星慢闪）、`.ds-boil`（3–4 帧/秒抖线）；`index.html` 里的 SVG 滤镜 `#ds-wobble`（放在 `.ds-defs` 里）。装饰都是 `aria-hidden` 的空元素或伪元素，≤360px 隐藏（要保留的加 `.ds-keep`），减少动态时不动，强制配色时去掉。
- 字体（自托管，`web/event-room/public/fonts/doodle/`，由 `scripts/fonts/build-doodle-fonts.py` 生成，按字频切片，只下载页面用到的切片）：

| 角色变量 | 字体 | 用在 |
|---|---|---|
| `--ds-font-logo` | Doodle Logo（Luckiest Guy） | 「Music Space」字标、英文大字、场馆海报 |
| `--ds-font-display` | Doodle Display（站酷庆科黄油体） | 大标题、首屏标题、面板标题、空状态标题 |
| `--ds-font-ui` | Doodle Marker（霞鹜漫黑） | 按钮、标签、导航、小标题、名字牌、表单标签 |
| `--ds-font-body` | Doodle Hand（悠哉） | 正文、说明、聊天内容、理由文字 |
| `--ds-font-digits` | Doodle Digits（得意黑，已改名） | 时间「21:47」、计数、比分 |
| `--ds-font-note` | Doodle Note（龙藏体） | 手写批注（只限 `NOTE_PHRASES` 里的字，新加批注要把字加进脚本并重跑） |

新增的界面文字如果含有产品里从没出现过的汉字，会退回系统字体（不会显示方块）；收尾时重跑一次字体脚本即可。

字体脚本的实际做法（2026-10-07 收尾时定下）：

- 重新生成：`pip install fonttools brotli`，然后 `python3 scripts/fonts/build-doodle-fonts.py`。上游文件按脚本里的网址下载并核对 SHA-256，字体和许可文本缓存在 `DOODLE_FONT_CACHE`（默认 `/tmp/music-space-font-cache`），离线也能重跑；产物是 `web/event-room/public/fonts/doodle/` 的 woff2、`fonts.css` 和 `LICENSES.txt`，都入库，不属于 `npm run build`。来源、许可和改动另记在 `THIRD_PARTY_NOTICES.md`「Doodle web fonts」一节。
- 切片：Display、Marker、Hand 的第 0 片是首屏的全部汉字（`FIRST_SCREEN` 列出的文件：`index.html`、示例站的 `copy.js`、`entry-panel.js`、`demo-hooks.js`、`tour.js`、`roster.js`，加上 `FIRST_SCREEN_TEXT` 里 `app.js` 写进外壳的几句）、全产品最常用的 300 个字、标点和拉丁字母，以及源码里真正用到的符号（箭头、心、星等，不再整段带上没用的符号区）；第 1–3 片按字频往后排；Marker 和 Hand 还有第 4 片，是 GB2312 一级字里产品没用到的部分，给用户自己打的字。Note 只有 `NOTE_PHRASES` 里的字，Logo 和 Digits 只有拉丁字母。首屏（手机）只下载 6 个文件，约 317 KB；首屏要出现的新字写进上面那些文件或 `FIRST_SCREEN_TEXT`，否则首屏会多下载一整片。`index.html` 预加载 `marker-0` 和 `display-0`。
- 霞鹜漫黑没有 ↗ ✓ ♡ ♫ ✦ ✧ ☾ ↩ ↔ ▾ ▴ ℗：脚本从悠哉取出这 12 个字形，做成 `marker-symbols.woff2`，作为 Doodle Marker 的一部分（用 Marker 的行高数据），按钮里的箭头和心不再掉到系统字体。
- 站酷庆科黄油体的「入」和「几」字形完全相同（「进入示例现场」会读成「进几示例现场」），「个」在标题字号像「卜」，也没有「·」：脚本用它自己的「人」和竖笔重画「入」「个」，「·」用它自己的圆点。以后换 Display 字体时要重新检查这几处。

## 2. 版式规则

1. 页面底：`background:var(--ds-paper) var(--ds-dots)`。去掉现在的深绿外框；深色只留给三维窗口和照片衬底（`--ds-night`）。
2. 每个屏幕至少一个「叠层标题时刻」：`.ds-title` 或 `.ds-sticker` 配 `.ds-hl`/`.ds-key`。同一屏里叠层标题不超过两个，其余文字保持干净。
3. 字号层级：首屏标题 `--ds-size-hero`（手机 40px 起），面板标题 `--ds-size-h1/h2`，正文 16px（不小于 15px），辅助 14px，元信息 12–13px。正文和标题至少差 2 级。
4. 一个组件里最多两种马克笔颜色。马克笔色块上的小字一律墨色（白字只用于 ≥24px 的粗标题）。
5. 线：组件边框 `--ds-border`（2.5px 墨线），小元素 2px，强调 3.5px。圆角用 `--ds-radius-1/2/card/btn` 这类不规则手绘圆角，药丸形用 `--ds-radius-pill`。阴影一律是硬边错位影（`--ds-shadow*` 或彩色 `5px 5px 0 var(--ds-pink)`），不用模糊阴影。
6. 轻微旋转（±0.5°–2°）只给贴纸、标签、拍立得、胶带，不给正文块、输入框和三维画布。
7. 装饰（星星、闪光、波浪线、圈画、箭头、音符、胶带）：每个区域最多 2–3 个，`pointer-events:none`，不压住文字和可点区域，窄屏（≤360px）减少或隐藏。

## 3. 组件配方

| 组件 | 做法 |
|---|---|
| 主按钮 | 墨底米字（`--ds-font-ui`，17–19px），`--ds-radius-btn`，`box-shadow:5px 5px 0 var(--ds-pink)`；按下 `translate(2px,2px)` 阴影收到 3px；禁用：`--ds-paper-deep` 底、`--ds-ink-3` 字、虚线框、无阴影 |
| 次按钮 | `--ds-paper-card` 底，墨框，`5px 5px 0 var(--ds-mint)` |
| 文字按钮/链接 | 墨字，下面一条手绘波浪下划线（SVG 背景或 `text-decoration: underline wavy`），悬停变粉 |
| 标签/状态 chip | 药丸形，墨框 2–2.5px，薄荷/黄/粉底，`--ds-shadow-sm`，可微转 ±2° |
| 计数徽标 | 粉底墨框小圆，`--ds-font-digits` |
| 卡片 | `--ds-paper-card` 底，墨框，`--ds-radius-card`，`--ds-shadow` 或 `--ds-shadow-lg`；重要卡片顶部一条半透明黄胶带 |
| 拍立得照片 | 白底宽边（底边更宽，放手写说明），墨框 2px，硬影，±1.5° 交替旋转，顶部胶带；照片本身不加滤镜 |
| 面板/弹层 | 手机为底部纸张抽屉，桌面为侧边纸张；墨框 + `--ds-shadow-lg`，顶部胶带；关闭按钮为圆形贴纸「×」 |
| 输入框 | `--ds-paper-card` 底，墨框 2px，`--ds-radius-2`；聚焦：薄荷粗影 `4px 4px 0 var(--ds-mint)` |
| 复选/单选 | 手绘方框/圆圈，选中为马克笔勾（粉或墨） |
| 底部导航 | 一排贴纸标签；当前项黄底墨框带阴影、微转；图标线条圆头 2.2px |
| 吐司提示 | 对话气泡：纸底墨框，带小尾巴，弹出动画 `--ds-pop` |
| 聊天气泡 | 自己：薄荷浅底靠右；对方：纸底靠左；都带墨框和尾巴；昵称用 `--ds-font-ui`，内容用 `--ds-font-body` |
| 空状态 | 一个小涂鸦（音符/星星/小人线稿）+ `.ds-title` 小标题 + 一句手写批注 |
| 加载屏 | 「灯快亮了」用 hero 字号叠层标题，几颗闪烁的星星（慢速、可关） |
| 焦点 | `:focus-visible{outline:3px dashed var(--ds-ink);outline-offset:3px}` |

动效：按下位移、悬停（仅精确指针）`rotate(-1deg) translateY(-1px)`、面板弹入 `scale(.96)→1`；装饰线可做「抖线」（3–4 帧/秒切换）。`prefers-reduced-motion: reduce` 时全部关闭。

## 4. 不变量（必须遵守）

- 不改 JS 逻辑、文案语义、DOM 结构里被脚本和测试依赖的 `id`/`class`/`data-*`/`aria-*`；需要加装饰时只**新增** class、包裹元素或伪元素。
- 新样式写在自己负责的 `web/event-room/doodle/*.css` 里，覆盖旧选择器（`index.css` 由 `app.js` 最后导入，同等优先级时后者生效）；不改旧 CSS 文件，必要时用更高优先级。
- 不加 npm 依赖，不引用外部网址（字体、图片、CDN），不用苹果系统专有字体，不用受版权保护的图片。
- 可点区域 ≥44×44px；正文对比度 ≥4.5:1；320px 宽不溢出；参考视口 390×844（手机）和 1440×900（桌面）。
- 只能改自己负责的文件。仓库里同时有别的代理在改，不要 commit、push、stash、reset、checkout。

## 5. 运行与截图

- 共享开发服务器（已启动，热更新，带种子角色的评委版）：`http://127.0.0.1:5190/`。如果不通，用 `npx vite --config /tmp/space-doodle/vite.dev-static.config.mjs --port <空闲端口>` 自己起一个，不要停别人的进程。
- 截图：`require('/tmp/space-video-prep/tools/node_modules/playwright-core')`，`chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'})`；手机 `{width:390,height:844,deviceScaleFactor:2}`，桌面 `{width:1440,height:900}`。每次新开 context 就是一个全新的种子世界。等 `window.__SPACE_BOOT__==='ready'` 再操作。
- 评委路线（到达各界面的方法）：「进入现场」→ 勾选同意 →「进入现场」→「第一次来」卡片「人海那张」→ 上传表单 →「保存这张照片」→ 照片墙 →「和 TA 交换这个视角」→ 勾选 →「把这两张交给对方确认 ↗」→ 几秒后「交换已接受」。底部导航「同场的人」「照片墙」「我的空间」，顶部「音乐探索」「♡」「我的小人」「···」。
- 截图存到 `/tmp/space-doodle/shots/<你的代号>/`，文件名写清界面和视口。

## 6. 三维场馆方向

纸面立体书 / 涂鸦小剧场：不改 Blender 模型（`venue.glb` 的校验不变），只改渲染。

- 调色：亮色纸面为主，马克笔色点缀。地板牛皮纸色、墙面米色，幕布用一种饱和马克笔色，舞台墨色，音箱墨色加米色喇叭，鼓和灯用薄荷、黄、粉。颜色取自 tokens.css 的同一组色值。
- 明暗：两档色阶；暗部不压暗颜色，而是叠墨色斜排线（屏幕空间、细线）。
- 描边：后处理墨线（深度 + 颜色边缘），2–3px；线条可以低频「抖动」（6–8 帧/秒换一次噪声），`prefers-reduced-motion` 时静止；加一层很淡的纸张颗粒。
- 舞台海报和画廊标语重画为涂鸦海报（用 Doodle Logo / Display 字体，画之前 `await document.fonts.load(...)`，字体到了再重画一次）。
- 性能：后处理像素比上限 2；低端设备或 `?doodle=0` 时退回现有着色；只影响活动房间场景（`liveMode`），不影响其他页面。

实现（`web/avatar/doodle-pass.js` 和 `three-scene.js` 的活动房间路径；色值在 `venue-art.js` 的 `DOODLE_COLORS`，与 tokens.css 相同），与上面的计划有几处不同：

- 场景先画进一张带深度的图（支持时用半精度浮点），再由一个全屏合成步骤加墨线（深度 + 颜色边缘）、两档明暗与屏幕空间斜排线、纸张颗粒和点阵。照片、灯、印刷品和二维小人用不受光的材质，不画斜线，也不描颜色边。
- 抖线约 7 帧/秒，只重跑合成，不重画场景；减少动态、标签页隐藏时不抖，场景被面板盖住时暂停。
- 像素比上限 2，场景图至少 1.5 倍超采样，总量上限约 530 万像素。
- 低端设备（软件渲染器，或不超过两个处理器核心）不退回旧着色：画风保留，只是不抖线、不超采样、像素比为 1。
- `?doodle=0`（`off`、`false`、`classic` 同义）只把渲染换回旧的卡通着色，配色和界面不变；同一标签页重新载入仍记得这个选择（`sessionStorage` 的 `music-space-event-doodle`），`?doodle=1` 换回来。缺少所需能力（WebGL1、没有 highp、最大纹理小于 4096）或涂鸦着色器编译失败时，自动用旧着色。
- 只在活动房间（事件房间页带着 tokens.css，或调用方明确要 `renderStyle:'doodle'`）启用；`/livehouse/` 样张保持原样。

## 7. 音乐探索（Music Map，`web/original-map/`）

用户 2026-10-07 决定保留 Music Map，并入同一个产品：`/music-map/` 的页面叫「音乐探索」，界面和三维小院都按本规范画，§2–§4 同样适用。实现细节记在 `web/original-map/README.md`，这里只记和活动房间不同或要注意的地方。

- 样式：`web/original-map/css/doodle/` 直接共用事件房间的 `tokens.css`、`type.css`、`kit.css`（只读，不改）；颜色只从 tokens 取，样式表里不写新的十六进制颜色（`tests/original-map-copy.test.js` 检查）。0.16 的样式表放在 `css/legacy.css` 的 `@layer legacy` 里，只管布局。图标是自绘的线条图标（`js/icons.js`，24px 网格、2.2px 圆头墨线，加 `#ds-wobble`），不用 Phosphor。
- 字体：两套构建在 `<head>` 里链接事件房间的 `fonts/doodle/fonts.css`（Pages 是 `../fonts/doodle/`，Node 是 `../event-room/fonts/doodle/`），预加载 `marker-0`、`display-0`；不从代码导入，单文件页面里没有字体数据。用 Logo、Display、Marker、Hand、Digits 五种，不用 Note。字体脚本扫描整个 `web/`，音乐探索的字也在切片里（2026-10-08 核对：Marker 和 Hand 覆盖源码里的全部汉字；Display 缺的 24 个繁体字是上游字体本来没有的，退回 Marker）。
- 三维：小院和唱片店用 §6 的同一个渲染（`web/avatar/doodle-pass.js`，不改它），接法在 `js/sakura-doodle.js`，色值同样来自 `venue-art.js` 的 `DOODLE_COLORS` / `DOODLE_KRAFT`。招牌、封套、徽章、海报这些印刷品用 Doodle 字体重画（`js/sakura-doodle-prints.js`），字体到了再画一次。抖线约 7 帧/秒，减少动态或标签页隐藏时不抖，低端设备不抖。
- 回退：`?doodle=0`（`off`、`false`、`classic` 同义）给旧的渲染：同一套纸面配色，走原来的 Sakura 卡通着色和描线（`js/vendor/sakura/`），界面不变；浏览器缺少所需能力或涂鸦着色器编译失败时也自动这样。和活动房间不同，音乐探索只读自己地址里的参数，不读也不写 `sessionStorage`：房间里用了 `?doodle=0`，进到音乐探索仍是涂鸦渲染，要在音乐探索的地址上另加。
