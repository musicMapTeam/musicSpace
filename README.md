# Music Space

**同一刻，另一面。演唱会散场以后，同场观众交换彼此没有的视角。**

你拍到了舞台，朋友记住了人海。各自留下现场卡，向对方申请交换；对方同意后，两张卡合成一张两人署名的双联票根，收进各自的纪念册。「同一刻」按照片自带的拍摄时间判断，「另一面」按视角判断：视角由一个在你自己的设备上运行的小模型建议，照片不上传。Music Space（暂定名）从 Music Map × Music Space 0.15（`3dd102c`）拆出，是移除了 Map 的独立产品；Music Map 留在[自己的仓库](#music-map-在哪)。

线上演示：<https://musicmapteam.github.io/musicSpace/>（**待部署，当前未上线**）。

## 主线

现场卡 → 私藏 / 展示 → 申请交换 → 对方同意 → 两人署名的双联票根 → 纪念册

- **现场卡**：选一张自己的现场照片，选时刻和视角（舞台 / 人海 / 身边 / 细节），留一句话，可写「这一刻在唱的歌」（选填，至多 40 字）。默认私藏。
  - **拍摄时间**：压缩前从原图读取 EXIF，卡上写「拍摄于 21:47」（北京时间；照片带时区就换算，不带就当作北京时间）。读不到（截图、转发的图常会丢失）就明说，可自己填一个大约的时间，或留空；文件修改时间、修图软件写下的时间和 PNG 里的时间只作为预填的猜测；你自己填写或改过时间，才用来判断「同一刻」。
  - **视角**：模型在本机判断，有把握才替你预选并标「AI 判断：舞台」，没把握就写「不确定，请选择」并把最可能的两项画成虚线框；你选的视角永远不会被覆盖。
- **同一刻，另一面**：两张卡的拍摄时间相差 3 分钟内算「同一刻」（有一张读不到时间时，退回两人选的同一「时刻」）；同一刻而视角不同的卡标为「同一刻的另一面」，并写出理由，如「同一刻 · 21:47，相差 1 分钟；你拍舞台，TA 拍人海」。理由与排序按规则计算，AI 只负责视角建议。
- **私藏 / 展示**：只有主动展示的卡，同场的人才看得到。
- **申请交换**：申请指向两张确定的卡，由对方本人同意；发起者不能代替对方同意。
- **双联票根**：对方同意后，全屏首映两人署名的双联，可保存 1600×1800 的夜场票根 PNG。改卡不改写已同意的快照。
- **纪念册**：双联自动收进各自的「收藏」；删除只删自己那一份，不影响对方。
- **那晚的歌单**：看得到的卡上写下的歌，按拍摄时间排成一份歌单，每首带「在 QQ 音乐搜索《X》」和「复制歌名」。链接只是按歌名搜索，不保证是当晚唱的版本；QQ 音乐的手机页会丢掉搜索词，所以才有复制。示例场次里虚构的曲目标「示例」，没有链接。

画面是一个常驻的三渲二夜场小院「樱下放映 · 夜场」，小院 / 照片墙 / 工作桌 / 收藏是四个镜头。美术方向已冻结，只做打磨。

## 静态版与房间版

| | 静态版 | 房间版 |
| --- | --- | --- |
| 是什么 | 整个 `dist/` 目录，无后端：`index.html`（脚本与样式内联，约 1.7 MB）加 `ai/`（端侧模型与运行时，约 23 MB）；任意静态托管（含 GitHub Pages）可打开，必须发布整个目录；`file://` 能打开但没有 AI | Node.js 24 + 内置 SQLite 服务，同一进程提供页面（含 `ai/`）与 `/api/live` 接口 |
| 能体验 | 本地双角色示例（Lin / 阿遥）：制卡 → 申请 → 同意 → 双联票根。可换成自己的照片，缩小并去掉定位信息后只存在这台设备上 | 真实房间：匿名身份、6 位邀请码与二维码、每房最多 24 人、每人一卡，两台设备各自申请与同意；本人跨场次的卡片与双联可回访 |
| 首页 | 「体验示例」为主，「用我的照片」为辅；房间入口隐藏，并用同一句话说明「真实房间需要完整版服务；线上可先用示例体验完整流程」 | 「记录我的现场」「邀请朋友」，另有「继续本场」「我有邀请码」「体验示例」 |

怎么选模式：房间服务在它自己提供的页面里写入 `<meta name="space-rooms" content="1">`，页面据此立刻按房间版显示，再在后台用 `/api/live/health` 确认（失败会再试一次，仍失败就退回静态版并提示，不重载页面）。没有这个标记的页面——GitHub Pages、`file://`、`npm run preview`、任意静态托管——按静态版，不发任何探测请求；只有 `npm run dev` 里 Vite 会把 `/api/live` 代理给本机服务，所以那里仍会问一次。GitHub Pages 上只会是静态版；真实房间与交换用房间版，在局域网或录屏中演示。

## 运行

需要 Node.js 24 或更新版本（见 `.nvmrc`）。

```sh
npm ci
npm run dev      # 开发服务器（127.0.0.1）；真实房间需另开终端运行 npm run server
npm run build    # 生成 dist/：index.html（脚本与样式内联）+ ai/（端侧模型与 onnxruntime-web 运行时）
npm test         # 「同一刻」规则与房间卡片接口的检查（只用 node:assert，无测试框架）
npm start        # 房间版：先 build；同一服务提供页面与接口，打开 http://127.0.0.1:8787/
```

`npm run preview` 只预览静态页面。`npm start` 默认只监听本机，支持 `HOST`、`PORT`、`DATA_DIR`；朋友的手机需要同一网络下可访问的服务地址，`127.0.0.1` 发不出去。对外部署需要 HTTPS 与持久磁盘，容器构建见 `Dockerfile`（本轮未运行）。数据库默认在 `data/music-map.sqlite`（沿用 0.15 的文件名），已排除 Git，不得打进分享包。`.github/workflows/build.yml` 构建、检查并上传 `music-space-demo`（整个 `dist/`）与 `music-space-runtime`（`dist/`、`server/` 与说明）两份产物，新仓库上的实际运行结果另记。

`npm run dev` 与 `npm run build` 会先运行 `npm run ai:ort`：把固定版本 onnxruntime-web 1.30.0 的三个运行时文件从 `node_modules` 复制到 `web/public/ai/ort/`（不入 Git，版本、哈希不对就拒绝）；`npm run ai:check` 检查 `dist/ai/` 的文件与大小，CI 会跑。模型 `web/public/ai/tc8/` 已入 Git，来源、许可与复现方法见 [scripts/ai/README.md](scripts/ai/README.md) 和 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。容器构建需要 `scripts/`（`Dockerfile` 已复制）。

## 边界

- 先服务散场后邀请的同场小圈，不做全城匹配。示例角色、场次与歌曲为虚构，预置照片由 AI 生成；自填场次、视角和照片不构成到场认证。
- 没有内置音频。产品里唯一的模型是视角建议：TinyCLIP-ViT-8M/16 的图像塔（MIT，int8，8.8 MB），由 onnxruntime-web（WebAssembly，单线程）在你的浏览器里运行，照片不上传；模型、运行时和标签向量都从本站同源加载，运行时不访问 huggingface.co 或 CDN。它是很小的零样本模型，会判错，所以只在有把握时才预选，选什么始终由你定。配对、排序与理由不含 AI。
- AI 的代价与准确率：第一次要下载约 23 MB，服务器压缩 `.wasm` / `.onnx` 时约 10 MB（本机 gzip 算得 10.3 MB；房间服务已压缩；2026-09-30 用 curl 看到 GitHub.com 对别人 Pages 站点上的 `.wasm` 与 `.onnx` 返回 gzip，本站尚未部署，没有实测）。之后文件放在浏览器的 Cache Storage；纯 http 的局域网页面没有 Cache Storage，每次都要重新下载。准确率只在 75 张维基共享资源的 CC 授权照片上量过：top-1 92%，判为「有把握」的 59 张全对，另 16 张没把握的有 62.5% 猜对；没有用真实观众的手机照片测过，不当作产品准确率。浏览器不支持（没有 WebAssembly SIMD、`file://`、下载失败）时界面里不出现任何 AI 字样，视角自己选。
- 示例照片的拍摄时间也是虚构的（Lin 21:47、阿遥 21:48，一开始就是一对「同一刻」）。「同一刻」只看拍摄时间与两人选的时刻，不构成到场认证。
- 身份只保存在当前浏览器，清除网站数据后无法找回，暂无账号找回。
- 浏览器存储只用 `localStorage` 的 `music-space:v1`、`music-space-live:v1`、`music-space-duet-seen:v1`，和 Cache Storage 的 `music-space-ai-v1`（AI 文件）。Music Map 与本产品同在 github.io 源，共享这些存储，所以只在首次启动时从 0.15 的旧键复制一次，不改动旧键（细则见 [AGENTS.md](AGENTS.md)）。写入被浏览器拒绝时（存储已满或被禁用），页面会说清原因，不再说「已保存」。

## Music Map 在哪

Music Map（从一位华语歌手出发，沿真实的合唱录音走向下一位）保持原样，独立在 [musicMapTeam/musicMap](https://github.com/musicMapTeam/musicMap)（MVP 0.16.0），线上 <https://musicmapteam.github.io/musicMap/>。本仓库不含 Map 的代码、数据或入口；0.15 里的 Map 部分留在 Git 提交 `3dd102c`。

## 状态与下一步

- 起点是 MVP 0.15.0（`3dd102c`），版本号尚未重定。拆分改动（移除 Map、静态版 / 房间版双模式、独立存储键）与 2026-09-30 一轮改动（拍摄时间、端侧视角识别、同一刻配对、那晚的歌单、外壳打磨）的构建与检查记录见[项目状态](docs/PROJECT_STATUS.md)；改动都在工作树，未提交、未推送、未部署。
- 2026-09-30 已在本机 Chrome 152 上走过：静态版（`python3 -m http.server` 托管 `dist/`）的首页、示例、上传带 EXIF 的照片、AI 建议、歌单；房间版的创建房间、两个身份加入、制卡、同一刻配对、申请、同意、双联页。`npm test` 与 `npm run build` 通过。
- 未做：线上部署；iOS Safari、微信内置浏览器、Android 与实体手机（AI 的耗时与内存都只在桌面 Chrome 上量过）；读屏软件；真实观众照片上的 AI 准确率；目标用户试用；新文档、介绍、封面与视频（现有封面与演示视频仍是含 Map 内容的旧版）。
- 参赛：每支队伍限定提交一份作品，提交 Music Space 还是 Music Map 尚未决定，需与队友商定。

## 项目导航

| 入口 | 内容 |
| --- | --- |
| [项目状态](docs/PROJECT_STATUS.md) | Todo / Doing / Done 与证据；Done 各节是 Map × Space 共享项目的历史 |
| [协作约定](AGENTS.md) · [协作指南](CONTRIBUTING.md) | 产品拆分、静态版 / 房间版规则、存储键；分工、小步提交、必要检查 |
| [视觉规范](docs/VISUAL_THEMES.md) | 樱下放映 · 夜场；仍含唱片店与寻声段落，待改写 |
| [产品方案](product/docs/01-product-plan.md) · [交付计划](product/docs/02-delivery-plan.md) · [实施规格](product/docs/03-build-guide.md) | 仍是 0.15 的 Map × Space 版（文档 2.6），待改写 |
| [参赛材料](docs/competition/README.md) · [交付清单](delivery/README.md) · [运行说明](RUN-ME.md) | 同上，待改写 |
| [更新记录](CHANGELOG.md) · [来源说明](THIRD_PARTY_NOTICES.md) | 版本与许可；含 Map 时期的条目 |
| [官方资料档案](references/official/2026-09-26/README.md) · [原始创意](references/original-ideas/README.md) | 官网与六张官方表原文 / 截图；早期双 App 方案 |

入口 `web/index.html`；前端 `web/js/`、`web/css/`；后端 `server/`。Vite + 原生 ES 模块，后端使用 Node 自带 HTTP、加密和 SQLite，无运行时 npm 依赖。`product/prototype/` 与 `archive/` 为历史参考。
