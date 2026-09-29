# Music Space

**同一刻，另一面。演唱会散场以后，同场观众交换彼此没有的视角。**

你拍到了舞台，朋友记住了人海。各自留下现场卡，向对方申请交换；对方同意后，两张卡合成一张两人署名的双联票根，收进各自的纪念册。Music Space（暂定名）从 Music Map × Music Space 0.15（`3dd102c`）拆出，是移除了 Map 的独立产品；Music Map 留在[自己的仓库](#music-map-在哪)。

线上演示：<https://musicmapteam.github.io/musicSpace/>（**待部署，当前未上线**）。

## 主线

现场卡 → 私藏 / 展示 → 申请交换 → 对方同意 → 两人署名的双联票根 → 纪念册

- **现场卡**：选一张自己的现场照片，选时刻和视角（舞台 / 人海 / 身边 / 细节），留一句话。默认私藏。
- **私藏 / 展示**：只有主动展示的卡，同场的人才看得到。
- **申请交换**：申请指向两张确定的卡，由对方本人同意；发起者不能代替对方同意。
- **双联票根**：对方同意后，全屏首映两人署名的双联，可保存 1600×1800 的夜场票根 PNG。改卡不改写已同意的快照。
- **纪念册**：双联自动收进各自的「收藏」；删除只删自己那一份，不影响对方。

画面是一个常驻的三渲二夜场小院「樱下放映 · 夜场」，小院 / 照片墙 / 工作桌 / 收藏是四个镜头。美术方向已冻结，只做打磨。

## 静态版与房间版

| | 静态版 | 房间版 |
| --- | --- | --- |
| 是什么 | 单个 `dist/index.html`，无后端；`file://` 或任意静态托管（含 GitHub Pages）可打开 | Node.js 24 + 内置 SQLite 服务，同一进程提供页面与 `/api/live` 接口 |
| 能体验 | 本地双角色示例（Lin / 阿遥）：制卡 → 申请 → 同意 → 双联票根。可换成自己的照片，缩小并去掉定位信息后只存在这台设备上 | 真实房间：匿名身份、6 位邀请码与二维码、每房最多 24 人、每人一卡，两台设备各自申请与同意；本人跨场次的卡片与双联可回访 |
| 首页 | 「体验示例」为主，「用我的照片」为辅；房间入口隐藏，并用同一句话说明「真实房间需要完整版服务；线上可先用示例体验完整流程」 | 「记录我的现场」「邀请朋友」，另有「继续本场」「我有邀请码」「体验示例」 |

页面启动时探测一次 `/api/live/health` 来选择模式；`file://` 与 `*.github.io` 不探测，直接按静态版。GitHub Pages 上只会是静态版；真实房间与交换用房间版，在局域网或录屏中演示。

## 运行

需要 Node.js 24 或更新版本（见 `.nvmrc`）。

```sh
npm ci
npm run dev      # 开发服务器（127.0.0.1）；真实房间需另开终端运行 npm run server
npm run build    # 生成单文件 dist/index.html
npm start        # 房间版：先 build；同一服务提供页面与接口，打开 http://127.0.0.1:8787/
```

`npm run preview` 只预览静态页面。`npm start` 默认只监听本机，支持 `HOST`、`PORT`、`DATA_DIR`；朋友的手机需要同一网络下可访问的服务地址，`127.0.0.1` 发不出去。对外部署需要 HTTPS 与持久磁盘，容器构建见 `Dockerfile`（本轮未运行）。数据库默认在 `data/music-map.sqlite`（沿用 0.15 的文件名），已排除 Git，不得打进分享包。`.github/workflows/build.yml` 构建单文件与运行包两份产物（`music-space-demo`、`music-space-runtime`），新仓库上的实际运行结果另记。

## 边界

- 先服务散场后邀请的同场小圈，不做全城匹配。示例角色、场次与歌曲为虚构，预置照片由 AI 生成；自填场次、视角和照片不构成到场认证。
- 没有内置音频，没有模型推理或 AI 匹配：视角由用户自选，排序与推荐理由按规则计算。
- 身份只保存在当前浏览器，清除网站数据后无法找回，暂无账号找回。
- 浏览器存储只用 `music-space:v1`、`music-space-live:v1`、`music-space-duet-seen:v1`。Music Map 与本产品同在 github.io 源，共享 `localStorage`，所以只在首次启动时从 0.15 的旧键复制一次，不改动旧键（细则见 [AGENTS.md](AGENTS.md)）。

## Music Map 在哪

Music Map（从一位华语歌手出发，沿真实的合唱录音走向下一位）保持原样，独立在 [musicMapTeam/musicMap](https://github.com/musicMapTeam/musicMap)（MVP 0.16.0），线上 <https://musicmapteam.github.io/musicMap/>。本仓库不含 Map 的代码、数据或入口；0.15 里的 Map 部分留在 Git 提交 `3dd102c`。

## 状态与下一步

- 起点是 MVP 0.15.0（`3dd102c`），版本号尚未重定。拆分改动（移除 Map、静态版 / 房间版双模式、独立存储键）的构建与检查记录见[项目状态](docs/PROJECT_STATUS.md)，记录之前不视为已验收。
- 未做：线上部署、实体手机与读屏软件验收、目标用户试用；现有封面与演示视频仍是含 Map 内容的旧版。
- 参赛：每支队伍限定提交一份作品，提交 Music Space 还是 Music Map 尚未决定，需与队友商定。
- 计划中、尚未开始：照片拍摄时间对齐进「同一刻」；端侧 AI 视角识别（舞台 / 人海 / 身边 / 细节），用来配对互补照片；「那晚的歌单」与 QQ 音乐链接；手机端打磨；新文档、介绍、封面与视频。

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
