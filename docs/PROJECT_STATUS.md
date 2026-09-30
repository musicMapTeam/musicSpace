# 项目状态

更新日期：**2026-09-30** · Music Space **MVP 0.16.0** / 文档 **3.0**。工作分支 `feat/moment-ai`（起点 `a45ecbd`，4 个提交，只在本机：未推送、无 PR、未合并）；`main` 停在 `a45ecbd`。线上 <https://musicmapteam.github.io/musicSpace/> 是 `feat/moment-ai@7c962e2` 的静态版构建（带 `ai/`，`gh-pages` 分支 `2d8f1a3`，2026-09-30 11:18 +08:00 部署），不含它之后的改动；此前上线的是没有 AI 的 `a45ecbd`。推送、PR、合并，以及 `7c962e2` 之后改动的再部署，都在等用户批准，本文不把它们写成已发生。工作树里另有未提交的改动（本轮的代码修正与文档改写，见 Doing）。

**产品。** Music Space：演唱会散场以后，同场观众交换彼此没有的视角（「同一刻，另一面。」）。2026-09-30 从 Music Map × Music Space 0.15（`3dd102c`）拆出，独立仓库 [musicMapTeam/musicSpace](https://github.com/musicMapTeam/musicSpace)（公开，带完整历史），移除了 Map 一半。Music Map 保持原样，留在 [musicMapTeam/musicMap](https://github.com/musicMapTeam/musicMap)（main `61d0689`，线上 <https://musicmapteam.github.io/musicMap/>，2026-09-30 复查首页仍返回 200），没有删除。两个产品的版本号各自独立（Map 现在也是 0.16.0），互不代表对方。

**用户决定**（GitHub Alakazamc，开发侧）：2026-09-28 转向只做 Map；2026-09-29 恢复 Space 并打磨它，AI 放进核心（端侧视觉识别），线上做成静态演示；2026-09-29 保留 Map，为 Space 另开新仓库。

**参赛。** 官网规则：每支队伍限定提交一份作品（[原文](../references/official/2026-09-26/website/page-text.txt)；FAQ Q12：每人只能以团队或个人身份提交一个方案，选择一个赛道）。提交 Music Space 还是 Music Map、选哪条赛道，尚未决定，需要与队友（产品负责人 igohomealone216）商定；结论前不写成已定，队友的意见也没有记录在本仓库，本文不替队友表态。Map 仓库的项目状态另记有 2026-09-28 转向 Map 的决定，其细节尚待与产品负责人对齐，本仓库不据此判断提交哪一个。

依据：[产品方案](../product/docs/01-product-plan.md) · [交付计划](../product/docs/02-delivery-plan.md) · [实施规格](../product/docs/03-build-guide.md)，以及 [AGENTS.md](../AGENTS.md) 和 [README](../README.md)。本轮（文档 3.0）按独立 Music Space 改写当前文档，见 Doing；各文件的版本头以文件自己为准，与 AGENTS.md、README 和本文冲突时以后三者为准。

「Done · 0.15.0」及更早各节是 Map × Space 共享项目的历史，原文保留；其中的唱片店、寻声、完整图鉴、开放曲库等属于 Map，不是 Space 的功能。Map 0.16 的记录在 Map 仓库的项目状态里。

## Todo

以下都是待办，尚未完成；顺序不代表优先级。

| 任务 | 负责人 | 完成证据 |
| --- | --- | --- |
| 推送 `feat/moment-ai`、开 PR、合并到 main，并把 `7c962e2` 之后的改动再部署到 GitHub Pages | 用户（Alakazamc）批准；执行者待定 | 四件事各自先问用户，上一轮的授权不自动延续（AGENTS.md）。线上已经是 `7c962e2` 的构建，但它对应的分支没有远端（远端只有 `main` 与 `gh-pages`），所以线上版本的源码提交只在本机。推送后远端分支与提交号可见；PR 上「Build demo」通过（0.16 的工作流多了 `npm run ai:check` 与 `npm test`，还没在 GitHub 上跑过）；合并后记下合并提交号。再部署后，线上 `index.html` 与新构建逐字节一致（比对方法见 Done「含 AI 的静态版上线」），首页仍是静态版（无 `space-rooms` 标记、不发探测请求），发布的是整个 `dist/`（含 `ai/`）；该源与 Map 共用，部署前后各检查一次两个产品的浏览器存储（`localStorage` 与 Cache Storage）互不影响；不把 Pages 写成支持跨设备交换 |
| 真机、微信内置浏览器与大陆网络检查（含 AI 加载耗时与内存） | 未认领 | iOS Safari、微信内置浏览器、Android Chrome 各选两张照片：记录机型与系统、能否加载（WebAssembly SIMD、内存）、首次下载耗时、每张的判断耗时与页面停顿、不支持时的回退；在浏览器里确认 Pages 上 `ai/` 的实际传输编码与大小（2026-09-30 用 curl 带 `Accept-Encoding: gzip` 测过，五个文件共 10,344,436 B，浏览器实际协商的编码没测）、Cache Storage 命中和大陆网络下的加载；QQ 音乐搜索链接在手机上是否带出歌名；用至少 30 张真实手机现场照片（注明来源与同意）量视角建议的准确率与「有把握」的比例，不虚报；评估把推理放进 Worker（`env.wasm.proxy`，桌面 Chrome 上主线程停顿从约 340 ms 降到 40 ms，加载慢约 1 s，见 `web/js/ai/space-ai.js` 的注释）。没量到的项写「未测」 |
| 小规模目标用户试用 | 团队 | 6 对同场观众（规模可调），比较群相册与双联的实际选择，先验证是否愿意主动交换；只记真实数字，不编造招募或结果 |
| 演示视频（≤ 3 分钟） | 未认领 | 按[参赛材料](competition/README.md)第 3 节的脚本，在含 AI 的 0.16 构建上从真实页面录屏（静态版全流程；两台手机的房间版为可选），语音讲解或字幕，≤ 500 MB，无水印杂音；不用截图或接口改状态代替操作。成片时长、大小与来源记入 `delivery/README.md`。现有 0.4 视频含约 20 秒 Map 片段，不能用于 Space |
| 封面（16:9） | 未认领；用户签收 | 重做 `delivery/cover.png`：现存的是 0.15 的 Map × Space 封面（含唱片店寻声截图），不能用于 Space。1920×1080，主体用实际导出的双联票根，注明示例照片由 AI 生成；用户看过并签收 |
| 确定提交 Music Space 还是 Music Map，以及赛道 | 用户与队友（产品负责人 igohomealone216），待商定 | 决定与日期记入本文与 AGENTS.md，报名材料同步；此前不写成已定，也不替队友表态。赛道一是 TME 产品创新功能，需要指明落在哪个 TME 平台上；赛道二是创新音乐产品（官方赛题说明见[留档](../references/official/2026-09-26/spreadsheet/03-topics-cells.md)） |
| 参赛合规核对 | 团队 | 官方 FAQ Q4 要求作品「目前还没有上线」，Q10 把「对外发布至公开平台，任何人均可访问、体验使用」算作上线；Q8 建议入选前尽量不要开源代码，风险自担。本仓库和 Pages 站点都是公开的（2026-09-30 查 GitHub API 与 curl），这是否影响参赛，本文不作判断，需向组委会或赛事交流群确认，把结论与日期记在这里。素材边界（Q11）：产品没有内置音频、歌词或专辑封面，QQ 音乐链接只是搜索 |
| 核对独立验证的 14 条轻微发现 | 开发侧 | 最近一轮独立验证的 14 条轻微发现，逐条处置情况没有记在仓库里；把每条标为已修 / 不修 / 待修，摘要写进本文，已修的注明提交号 |
| `package.json` 版本号 | 开发侧 | 文档已按 0.16.0 写，`package.json` 与构建日志里仍是 `music-space@0.15.0`；升到 0.16.0 后，本行删除 |
| 最终报名与提交 | 团队 | 核对报名信息、上传材料、提交回执；截止 2026-10-09 23:59 |

## Doing

本轮：代码修正、文档改写与截图。

| 任务 | 负责人 | 文件范围 | 状态 |
| --- | --- | --- | --- |
| 本轮代码修正 | 并行的 Claude 子代理（文件范围互斥；本文只记录 2026-09-30 12:10 前后 `git diff` 里看到的范围，不代为验证） | `web/js/moment.js`、`photo-insight.js`、`ai/space-ai.js`、`space.js`、`live.js`、`duet-facts.js`、`ticket-export.js`，`web/css/` 的 7 份（`night-shell.css`、`space-studio.css`、`live-compose.css`、`courtyard-ui.css`、`duet-ceremony.css`、`spatial-objects.css`、`theme-sakura.css`），`server/index.js`、`server/db.js`，`scripts/test/` 三份，共 19 个文件 | 进行中，改动在工作树，未提交，线上（`7c962e2`）不含这些。看到的内容：文件修改时间（`file`）不再发给房间服务（服务端收到也丢掉，旧客户端不被拒绝）；理由里的时长不再四舍五入（「相差 3 分钟」至多 3 分整，稍多写「3 分多钟」，不算同一刻）；AI 线一交出照片就显示「判断中」，下载文字改为「首次需下载模型（约 10–23 MB）」；填了用不了的拍摄时间时字段旁给出提示；票根 PNG 的页脚区分虚构内容与使用者提供的内容；`aria-expanded`、建议句只在有建议时才在页面里等可访问性细节；建议态文字改用更深的玫红以保证对比度；申请 / 回应对话框与卡片编辑窗的布局微调。这些改动本文没有逐项核对，构建与 `npm test` 在 12:10 的工作树上通过（见下） |
| 按独立 Music Space 改写当前文档（文档 3.0） | 开发侧 + Claude 子代理（并行，文件范围互斥） | 本任务：本文、`docs/VISUAL_THEMES.md`、`docs/competition/README.md`、`delivery/README.md`；同轮的其余文档（`README.md`、`AGENTS.md`、`CHANGELOG.md`、`RUN-ME.md`、`CONTRIBUTING.md`、`THIRD_PARTY_NOTICES.md`、`product/` 下的文档等）由并行任务改写，各自记录 | 进行中：改动在工作树，未提交（以 `git status` 为准）。Map 时期的历史条目原文保留并标注 |
| 补拍 0.16 截图并登记 | 开发侧（后续一轮） | `docs/assets/themes/space-<页>-<desktop 或 mobile>-v016.png`，页为 home、demo-wall、editor-ai、pairing、setlist、duet、records，另有 `space-ticket-v016.png`（实际导出的双联 PNG），共 15 个文件 | 路径已在[视觉规范](VISUAL_THEMES.md)登记；**图片尚未拍摄，这些文件现在还不存在**；补拍后逐个核对路径与内容 |

工作树在 2026-09-30 12:10（含上面未提交的代码改动）上重跑：`npm run build` 通过，`dist/index.html` 1,752,910 B（Vite 估 gzip 604.38 kB；11:51 时是 1,752,035 B），`dist/ai/` 仍是 23,141,982 B；`npm run ai:check` 通过；`npm test` 三份全部通过。这只是那一刻的工作树，代码还在改，提交前要重跑。

## Done · 0.16.0

分支 `feat/moment-ai`（起点 `a45ecbd`，4 个提交，只在本机）。这里的 Done 指：代码已提交到本地分支，`npm run build` 与 `npm test` 通过，静态版与房间版的主流程在桌面 Chrome（模拟视口）里走过。它**不含**真机、大陆网络、真实照片上的准确率与目标用户试用，见本节末尾的「未验证与边界」。含 AI 的 `7c962e2` 已部署到 Pages（见下表），`7c962e2` 之后的改动没有。

| 任务 | 文件 / 提交 | 证据 |
| --- | --- | --- |
| 建仓与拆分：以 0.15 为起点移除 Map 一半 | 仓库 `musicMapTeam/musicSpace`；`3dd102c` 之后的提交：`e18b9f2`（归档 2026-09-29 的提交表单字段）、`c455279`（独立应用）、`6f8ff2c`（去掉唱片桌）、`d774325`（移除 Map 样式）、`1f5a405`（包名改为 `music-space`）、`a45ecbd`（记录拆分与新仓库的规则） | GitHub API（2026-09-30 查）：仓库公开，创建于 2026-09-29 16:10 UTC（北京时间 2026-09-30 00:10），main 为 `a45ecbd`，历史保留 0.15 及以前的全部提交；「Build demo」[run 36595874461](https://github.com/musicMapTeam/musicSpace/actions/runs/36595874461)（main@`a45ecbd`）成功。Map 仓库没有动：main `61d0689`（2026-09-29 合并 PR #6），线上首页返回 200。代码里没有 Map 残留的搜索见下 |
| 静态版首次上线（GitHub Pages，AI 之前的构建 `a45ecbd`） | `gh-pages` 分支 `f0ad219`「Deploy Music Space static build from main@a45ecbd」（2026-09-29 16:18 UTC，北京时间 2026-09-30 00:18） | 分支只有 `index.html`（1,683,279 B）与 `.nojekyll`；Pages 构建 [run 36596764084](https://github.com/musicMapTeam/musicSpace/actions/runs/36596764084) 成功。2026-09-30 11:17 用 curl 复查（那时线上还是这一版）：首页 200，HTML 带 `content-encoding: gzip`，页面没有 `space-rooms` 标记（静态版），`ai/tc8/labels.json` 返回 404，即当时线上没有 AI，也没有拍摄时间读取、按拍摄时间的「同一刻」配对和「那晚的歌单」。这一版在 11:18 被下一行的部署取代 |
| 含 AI 的静态版上线（GitHub Pages，`7c962e2`） | `gh-pages` 分支 `2d8f1a3`「Deploy Music Space static build from feat/moment-ai@7c962e2 (index.html + ai/)」（2026-09-30 03:18 UTC，北京时间 11:18，作者 Alakazamc，父提交 `f0ad219`） | 分支内容：`.nojekyll`、`index.html`（1,747,253 B）、`ai/` 的 8 个文件；Pages 构建 [run 36663862233](https://github.com/musicMapTeam/musicSpace/actions/runs/36663862233) 成功。本文 11:55 前后核对：首页 200，`ai/tc8/labels.json` 200，页面没有 `space-rooms` 标记；线上 `index.html` 的 SHA-256（`54ed3146…f0d178`）与在临时目录里用 `git archive HEAD` 重新构建 `7c962e2` 得到的完全一致，`ai/` 的 5 个文件（模型、labels、wasm、两个 mjs）也逐个一致；带 `Accept-Encoding: gzip` 时这 5 个文件都返回 `Content-Encoding: gzip`，共 10,344,436 B（`vision.onnx` 6,590,919、`.wasm` 3,722,335、labels 5,849、两个 mjs 9,095 与 16,238）。分支 `feat/moment-ai` 没有远端，线上版本的源码提交只在本机；线上**不含** `7c962e2` 之后的改动（见 Doing）。这次部署的授权，本文没有记录 |
| 端侧视角 AI 与拍摄时间读取 | `348fe02`：`web/js/ai/space-ai.js`、`web/js/ai/exif-time.js`、`web/public/ai/tc8/`（模型与标签）、`scripts/ai/`（来源、复现、检查）、`package.json`（onnxruntime-web 1.30.0）、`vite.config.js`、`.github/workflows/build.yml`、`Dockerfile`、`THIRD_PARTY_NOTICES.md` | TinyCLIP-ViT-8M/16 图像塔（MIT，int8）`vision.onnx` 8,807,127 B，加 onnxruntime-web 1.30.0（WASM 单线程），同源自托管在 `ai/`，不访问 huggingface.co 或 CDN；Cache Storage 名 `music-space-ai-v1`；预选门槛为余弦差 ≥ 0.02 且概率 ≥ 0.5。来源提交与各文件 SHA-256 记在 `scripts/ai/README.md`，该文件自述 2026-09-30 在新装的临时目录里从头复现过；本文没有重跑。EXIF 读取对 spike 的 96 个样本，94 个与 ExifTool 清单一致，另 2 个是清单里记为已知上限的（超过 64 个段 / 块，读取器返回空） |
| 「同一刻，另一面」配对与「那晚的歌单」 | `f9a2d75`：`web/js/moment.js`、`photo-insight.js`、`setlist-ui.js`、`space.js`、`live.js`、`live-library.js`、`duet-facts.js`、`duet-ceremony.js`、`ticket-export.js`、`server/`（`cards` 增 `taken_at`、`taken_source`、`song`，叠加式迁移）、`scripts/test/`、相关样式 | 拍摄时间相差 ≤ 3 分钟（`SAME_MOMENT_MS`）算同一刻，任一方没有可信时间时退回两人选的同一时刻；同一刻而视角不同的卡标「同一刻的另一面」并写出理由；文件修改时间（`file`）只作预填的猜测，不参与判断。歌单按拍摄时间排序，链接只是 QQ 音乐的按歌名搜索。`npm test`（三份检查）通过；接口检查覆盖拍摄时间、歌名与视角的校验（见下「集成阶段的检查记录」） |
| 外壳与模式检测 | `df8c8cd`：`app.js`、`home.js`、`storage.js`、`night-shell.css`、`scene-panels.css`、`index.html` 等 | 品牌「Music Space」加「樱下放映 · 散场以后」；模式由页面来源决定（房间服务写入 `space-rooms` 标记，静态页不发探测请求）；浏览器拒绝写入时提示改口，不再说「已保存」；可点区域按 ≥ 44px 整理。检查见下 |
| 当前文档同步（第一轮） | `7c962e2`：`AGENTS.md`、`README.md`、`RUN-ME.md`、`CONTRIBUTING.md`、`CHANGELOG.md`、本文 | 记录上面三个提交的改动。其中「改动都在工作树、未提交」的说法写于提交之前，已过时，以 `git log` 为准；本轮（文档 3.0）的改写见 Doing |
| 构建与检查（提交 `7c962e2`） | `package.json` 的脚本；本文 2026-09-30 约 11:20 重跑，当时代码文件都没有未提交改动（`git status` 干净，最早的代码改动是 11:35），即与 `7c962e2` 一致；Node 24.19.0 / npm 11.17.0 | `npm run build`：62 个模块；`dist/index.html` 1,747,253 B（Vite 估 gzip 603.07 kB，本机 `gzip -9` 596,533 B）；`dist/ai/` 共 23,141,982 B：`tc8/vision.onnx` 8,807,127、`ort/ort-wasm-simd-threaded.wasm` 14,239,897、`ort/ort-wasm-simd-threaded.mjs` 24,381、`ort/ort.wasm.min.mjs` 50,126、`tc8/labels.json` 17,609、两份 MIT 许可文本 1,769 与 1,073；`dist/` 合计 24,889,235 B。`npm run ai:check`：通过（模型、wasm、`index.html` 的大小与预期一致，`ai/ort` 恰好 3 个文件）。`npm test`：`moment.test.mjs`、`insight.test.mjs`、`api.test.mjs` 三份全部通过（只用 `node:assert`）。`web/js`（不含 vendor）、`server/`、`scripts/ai/*.mjs`、`scripts/test/*.mjs` 共 36 个文件 `node --check` 通过。本机 `gzip -9` 后 `ai/` 里较大的几个文件合计 10,259,278 B（模型 6,575,442、wasm 3,652,793、两个 mjs 共 25,255、labels 5,788，不含许可文本），这是换算，不是 Pages 上的实测传输大小。GitHub 上的 CI 还没跑过 0.16 的工作流（分支未推送） |
| 独立验证 | 多轮，Tabbit（Chrome 152），模拟视口；回报由本轮工作流给出，原文没有存进仓库 | 最近一轮：12/12 项通过、0 个页面错误、14 条轻微发现；覆盖 1440×900 与 390×844，另有 `file://`、无 WebGL、两个来源的房间流程。逐项内容与 14 条发现的处置本文没有记录（见 Todo） |
| 视频脚本的操作路径核对 | 本文 2026-09-30 约 12:00–12:10，Tabbit（Chrome 152）1440×900；页面是 `git archive HEAD` 在临时目录重建的 `7c962e2` 构建（与线上逐字节相同），由本机静态服务器在全新的 `127.0.0.1` 来源上打开；房间版只在同一构建上另起 Node 服务看了首页 | 按[参赛材料](competition/README.md)第 3 节的顺序在静态版走了一遍：首页文字与按钮；「用我的照片」→「制作现场卡」；传入手工写入 EXIF（2026-09-26 21:47:30）的 JPEG，卡上写「拍摄于 21:47 · 来自照片自带的信息」；AI 线先是「AI 在本机判断视角…」，随后是「不确定，请选择」（这张 AI 生成的示例舞台图，前两名是人海与舞台，虚线落在「舞台」「人海」上，没有预选）；点「舞台」后 AI 线清空；保存后阿遥的卡下出现「同一刻的另一面」与「同一刻 · 21:47，相差不到 1 分钟；你拍舞台，TA 拍人海」；「申请换卡」对话框（理由、「再看看」「发送申请」）；发送后「切到阿遥」→「查看申请」→「同意交换」；仪式页的按钮是「保存双联图片」「返回现场」「查看我的记忆」；点「保存双联图片」得到 1600×1800 的预览（按钮「下载图片」「关闭预览」「分享图片」），票根上两半写着「舞台 · 返场」「人海 · 返场」、「拍摄于 21:47 · ♪ 晴天」，存根写「同一刻 · 21:47，相差不到 1 分钟」；切回 Lin 后「那晚的歌单」两首（21:47《晴天》带「在 QQ 音乐搜索《晴天》」与「复制歌名」，21:48 的虚构曲目标「示例」），链接是 `https://y.qq.com/n/ryqq/search?w=%E6%99%B4%E5%A4%A9&t=song`，`target="_blank"`、`rel="noopener noreferrer"`。房间版首页的按钮是「记录我的现场」「邀请朋友」「我有邀请码」「体验示例」。**没有做**：点开 QQ 音乐的搜索页、手机、房间版的建房 / 加入 / 交换流程、`7c962e2` 之后的改动。这一遍只是核对脚本里的路径与文字，不算独立验证 |
| 代码里没有 Map 残留 | `web/js`、`web/css`、`web/index.html`、`server/`（不含 `web/js/vendor/`） | 本轮用 grep 检查（Map、music-map、寻声、图鉴、唱片店、explore 等）：界面代码里没有 Map 产品的入口、数据和文案；只剩三类有意保留的：`storage.js` / `app.js` 里读取 0.15 旧键（`music-map-space:v1`、`music-map-live:v1`，只读一次、不写不删）和剔除旧存档里 Map 字段（`map`、`mapReturnId`）的代码与注释、数据库文件名 `data/music-map.sqlite`、Three.js 材质的 `map:` 选项（与 Map 产品无关） |

AI 视角建议：量过什么、没量什么。

- **spike**（`scripts/ai/README.md`）：浏览器里跑同一个 int8 模型和同一组视角向量，输入是 75 张维基共享资源的 CC 授权照片（图片不在仓库里）：top-1 92.0%（69/75），top-2 100%。
- **应用自己的路径**（照片先经 `compressPhoto` 再 `classify`；数字记在 `web/js/ai/space-ai.js` 里 `SURE_MARGIN` 上方的注释）：75 张原图里 57 张判为「有把握」，57 张全对；另 18 张「不确定」，它们的前两名里都含正确答案。再对每张原图做六种退化（变暗、裁切、模糊、缩小、倾斜、微信压缩），共 525 个输入：402 个「有把握」，其中 400 个正确；错的 2 个都是舞台照被判成「身边」（变暗、裁切各一，余差 0.0203 与 0.0241，刚过门槛）。
- 这些是公开 CC 照片上的数字，不是真实观众手机照片上的，不能当产品准确率；「有把握」只表示够格替你预选一个可以改的选项，不表示答对。旧文档里「59 张有把握、全对；另 16 张没把握、62.5% 猜对」是 spike 直接跑原图的结果，与应用路径的 57 / 18 量的是不同输入，两组不互相替代。

### 拆分明细（原 Doing 记录，原文保留）

下面两小节原在 Doing 里，写于拆分与 AI 一轮进行中，文字原样搬来。其中「本文没有收到本轮的构建或浏览器操作记录」「改动都在工作树」这类状态是当时的，已被上面的表和提交取代；「其余文档见 Todo」现在对应上面的 Doing。

文件范围明细：

- **外壳与路由**：重写 `app.js`、`home.js`；修改 `space.js`、`live.js`、`live-library.js`、`space-data.js`、`themes.js`、`ticket-export.js`、`index.html`、`vite.config.js`、`package.json`、`package-lock.json`、`build.yml`、`.gitignore`、`gsap-notice.txt`；新增 `storage.js`；删除 `map.js`、`map-catalogue.js`、`map-data.js`、`map-network.js`、`open-catalogue.js`、`music-library.js`、`web/assets/data/`、`scripts/datasets/download_hf_catalogue.py`。
- **场景**：修改 `sakura-scene.js`、`sakura-world.js`、`sakura-camera.js`、`sakura-framing.js`；删除 `sakura-music.js`。
- **样式**：修改 13 份样式（裁掉 Map 选择器，个别只改注释），删除 6 份 Map 样式（`map.css`、`map-credits.css`、`map-round.css`、`map-spatial.css`、`map-studio.css`、`open-catalogue.css`）。
- **文档**：`AGENTS.md`、`README.md`、本文；其余文档见 Todo，稍后另行改写。

已改（对工作树代码与改动清单的核对；本文没有收到本轮的构建或浏览器操作记录，不据此写成通过）：

- 路由只剩小院（首页）、`live`（照片墙）、`records`（收藏），另有本地示例 `#/space/demo`；旧 `#/explore` 书签落回首页。
- 模式由页面来源决定（2026-09-30 起，规则见 AGENTS.md「静态版与房间版」）：房间服务在它提供的页面里写 `<meta name="space-rooms" content="1">`，页面立刻按房间版显示并在后台确认；没有标记就是静态版，不发探测请求；只有 Vite 开发服务器仍探测。结果为 `api.backend = { available, note }`。无服务时首页以「体验示例」为主、「用我的照片」为辅，房间专属入口隐藏或转到示例，并统一用「真实房间需要完整版服务；线上可先用示例体验完整流程」这一句说明；有服务时房间版行为不变。
- 存储键改为 `music-space:v1`、`music-space-live:v1`（`music-space-duet-seen:v1` 沿用）。自有键不存在时，从 0.15 的 `music-map-space:v1`、`music-map-live:v1` 各复制一次；旧键不改不删，因为 Map 与 Space 同在 github.io 源。
- 场景接口为 `setView`、`setContent`、`focus`、`restore`、`dispose`；罗盘为小院 / 照片墙 / 工作桌 / 收藏，镜头为 home / live / editor / records / photo；唱片店保留为布景、没有动作；常驻灯从 8 盏减为 7 盏（唱片桌桌灯随唱片店移除）。
- 包名改为 `music-space`，构建产物名改为 `music-space-demo` / `music-space-runtime`；单文件不再附带 HF 元数据许可注释；PNG 页脚改为「MUSIC SPACE」。
- 样式子代理报告：非 Map 元素的计算样式与拆分前一致；本文未复核。

### 集成阶段的检查记录（原 Doing 记录，原文保留）

写于提交与部署之前：其中「本站尚未部署」「GitHub Pages 上 `ai/` 的实际传输大小没测」是当时的状态，11:18 部署之后见上表「含 AI 的静态版上线」。构建大小是当时某次构建（`dist/index.html` 1,739,325 B）的，之后代码又有改动，最终构建的大小见上表「构建与检查」，两组数字不要混用；`npm test` 当时是两份检查，现在是三份（多了 `insight.test.mjs`）；AI 准确率当时沿用 spike 直接跑原图的数字（59 张有把握），应用路径上量到的 57 / 18 见上面「AI 视角建议」的说明。

改动清单见 `CHANGELOG.md` 的「未发布」一条。下面只记实际执行过的检查（本机 macOS，Node 24.19.0 / npm 11.17.0，Chrome 152 经 Tabbit，模拟视口 1280×800 与 390×844，无触屏）和没有做的。

- **构建与静态检查**：`npm ci` 后 `npm run build`，62 个模块，`dist/index.html` 1,739,325 字节（Vite 估 gzip 600.87 kB），`dist/ai/` 里模型 8,807,127 字节、wasm 14,239,897 字节；`npm run ai:check` 与 `npm test`（`scripts/test/` 的规则与接口两份检查，前者约 100 条断言）通过；`web/js`（不含 vendor）、`server/*.js`、`scripts/` 下脚本 `node --check` 通过；用 Vite 的 `parseAst` 扫 27 个文件，没有未用的 import 与顶层声明。把将要提交的文件（已跟踪加未忽略的未跟踪，245 个）复制到临时目录，`npm ci`、`npm run build`、`npm run ai:check`、`npm test` 通过，得到的 `dist/` 与工作树逐字节相同（8 个文件）。
- **Docker**：没有构建成镜像——拉取 `node:24-alpine` 的元数据 7 分钟没有返回，已中止，没有留下镜像或容器。改用 `Dockerfile` 的同一文件集（`package.json`、锁文件、`web/`、`scripts/`、`vite.config.js`）在临时目录里做了构建阶段，再把 `dist/`、`server/`、`package.json` 放成运行阶段的布局启动服务：页面带房间标记，`/ai/tc8/vision.onnx` 返回 200。没有 `scripts/` 时 `prebuild` 会 `MODULE_NOT_FOUND`（AI 核心的记录），`Dockerfile` 已补上复制。
- **EXIF**：对 spike 的 96 个样本，94 个与清单（ExifTool）一致，另 2 个是清单里记为已知上限的（超过 64 个段 / 块，读取器返回空）。
- **静态版**（`python3 -m http.server --directory dist`，端口 4361）：
  - 首页只发出一个请求（`/`），没有 `/api/live/health`；导航为小院 / 示例 / 收藏；`?room=…#/live` 落到 `#/space/demo` 并给出统一说明，`?room` 被去掉；`#/explore` 与乱写的哈希落回首页。
  - 「用我的照片」上传 `real-canon6d-concert.jpg`（2014 年的 EXIF，无时区）：卡上写「拍摄于 2014年10月2日 20:59」；模型从空缓存冷加载，约 0.7 s 时出现「AI 在本机判断视角…」，约 1.0 s 时「AI 判断：舞台」并预选；发出的请求只有同源的 `ai/` 文件与 `blob:`。
  - 把时间改成 9月26日 21:50 后，与阿遥的 21:48 成为「同一刻的另一面」，理由「同一刻 · 21:48，相差 2 分钟；你拍舞台，TA 拍人海」；歌单里 Lin 的《晴天》带 QQ 搜索链接（`target="_blank"`、`rel="noopener noreferrer"`），示例曲目标「示例」、没有链接。
  - 无 EXIF 的 `wechat-like-iphone15pm.jpg`：显示「没读到拍摄时间…」，时间框预填文件时间并标「大约的时间」，存为 `file` 来源，配对退回「按你们都选的「返场」算同一刻」。
  - 申请、切到阿遥同意、双联页正常。
  - 模拟写入失败（`Storage.prototype.setItem` 抛 `QuotaExceededError` 与 `SecurityError`）：顶部提示、toast 与「卡片已保存」对话框都改口，恢复后重试成功、提示消失。
  - 键盘：Tab 到得了视角按钮，空格 / 回车切换，焦点环 2 px。
- **房间版**（`PORT=8861 DATA_DIR=/tmp/space-int2-data node server/index.js`）：
  - 把 `/api/live/health` 人为拖到 4 s，首页在 207 ms 时已是房间版（记录我的现场 / 邀请朋友 / 我有邀请码 / 体验示例，导航为小院 / 照片墙 / 收藏）；创建房间；第二个身份（`localhost` 源）用邀请码加入。
  - 两人各传带 EXIF 的照片（21:47:30 与 21:48:50），AI 分别判「舞台」与「人海」；照片墙出现「同一刻的另一面」与「同一刻 · 9月26日 21:47，相差 1 分钟；你拍人海，TA 拍舞台；都写下了《晴天》」；申请、同意后双联页写出两边的视角、时间与共同的歌；歌单合并成一首《晴天》。
  - 服务端：带 `Accept-Encoding: gzip` 时模型传 6,501,770 字节，解压后 SHA-256 与原文件一致；`If-None-Match` 返回 304；路径穿越与向静态路径 POST 被拒；`.mjs`、`.wasm` 的类型正确。
  - 接口检查（`api.test.mjs`）覆盖拍摄时间、歌名与视角的校验，交换快照、记录与收藏里带这些字段。
- **点击目标**：用「元素能否在 44×44 范围内接收指针」的脚本，在 1280×800 与 390×844 下查了示例页、制卡、展示设置、重置、票根、收藏、房间页（含折叠展开）、房间制卡两步、邀请与收藏，找到并修了 1 处（示例页「交换申请」条里的按钮 38 px，改为不可见的 45 px 命中层）；其余只剩相邻控件命中层互相重叠 1–6 px，和折叠里没有显示的内容。
- **集成时改的**：示例页「卡片已保存」对话框与 toast 接上 `api.storageState()`；「关于」里的 AI 一行按浏览器是否支持改口，「3 分钟」取自 `SAME_MOMENT_MS`；示例制卡里 AI 有把握时提示去哪里改视角；删掉指向已不存在元素的两条命中层选择器和没用的 `VENUE_ZONE`；补上 `Dockerfile` 的 `COPY scripts`、`.dockerignore`、`.gitattributes`；把两份检查收进 `scripts/test/` 并接进 CI；重写 `RUN-ME.md`，改 `README.md`、`AGENTS.md`、`CONTRIBUTING.md`、`CHANGELOG.md`。
- **没有验证**：iOS Safari、微信内置浏览器、Android 与实体手机（AI 每张约 0.3–0.4 s 的耗时与其间的页面停顿只在桌面 Chrome 上量过）；触屏与其他视口尺寸；GitHub Pages 上 `ai/` 的实际传输大小（README 的「约 10 MB」是本机 gzip 算得的 10.3 MB，另见 GitHub.com 对别人 Pages 站点上的 `.wasm` / `.onnx` 返回 gzip，本站尚未部署）；真实观众照片上的 AI 准确率（只有 75 张 CC 图：top-1 92%，应用路径上「有把握」的 57 张全对，spike 直接跑原图的 59 / 16 不同输入、不互相替代）；QQ 音乐搜索链接在手机上会丢掉搜索词（2026-09-30 用 iPhone UA 的 curl 复查：桌面 UA 落到 `y.qq.com/n/ryqq_v2/search?w=晴天&t=song`，iPhone UA 被转到 `i2.y.qq.com/n3/other/pages/myqq/index.html`；试过的另外几个手机版地址都打不开搜索），所以另给了复制歌名，也没有更好的手机链接可换；读屏软件；减少动态与无 WebGL 只在外壳与功能各自的检查里看过，本轮集成没有重跑。

### 当时定的「移到 Done 需要」与现状

下面引用的是开工时写在「Doing」里的条件（原文保留），右表逐项写现状。

> 移到 Done 需要：生产构建（记录模块数与大小，2026-09-30 已记）；静态版（无服务）与房间版（Node + SQLite）各走一遍首页、制卡、申请、同意、双联页、PNG 与收藏（2026-09-30 走过两边的首页、制卡、申请、同意与双联页，收藏页只做了点击目标检查；PNG 导出由功能子代理另查，本文未复核）；`#/space/demo` 与无服务提示（已走）；从 0.15 存档迁移到新键且旧键不变；1440×900 与 390×844 目视，含无 WebGL 与减少动态；搜索确认代码中已无 Map 残留；`README.md`、`AGENTS.md` 与本文同步（2026-09-30 已同步）；上面「没有验证」一节的真机、Pages 部署与真实照片项。

| 当时的条件 | 现状 |
| --- | --- |
| 生产构建（记录模块数与大小） | 已记：见上表「构建与检查」，本文重跑 |
| 静态版与房间版各走一遍首页、制卡、申请、同意、双联页、PNG 与收藏 | 首页、制卡、申请、同意、双联页在两边都走过（集成阶段的记录，另有独立验证 12/12 通过，逐项内容没有存进仓库）；收藏页只做了点击目标检查；PNG 导出没有导出文件的字节数与目视记录，待 `space-ticket-v016.png` 一并留证 |
| `#/space/demo` 与无服务提示 | 已走 |
| 从 0.15 存档迁移到新键且旧键不变 | 记录里没有这一项的操作证据，待补 |
| 1440×900 与 390×844 目视，含无 WebGL 与减少动态 | 独立验证覆盖两个视口与无 WebGL；减少动态没有独立验证记录 |
| 搜索确认代码中已无 Map 残留 | 已做，见上表「代码里没有 Map 残留」 |
| `README.md`、`AGENTS.md` 与本文同步 | 2026-09-30 同步过一次（`7c962e2`）；文档 3.0 的改写见 Doing |
| 「没有验证」一节的真机、Pages 部署与真实照片项 | Pages 部署已在 11:18 完成（见上表「含 AI 的静态版上线」），传输大小只用 curl 测过；真机、大陆网络与真实照片没做，已转入 Todo；本节的 Done 不含这些 |

### 未验证与边界

- **部署**：线上是 `7c962e2` 的构建（带 AI），不含之后的工作树改动；`feat/moment-ai` 没有推送、没有 PR、没有合并，线上版本的源码提交只在本机；0.16 的 CI 没有在 GitHub 上跑过；再部署要用户批准。
- **手机与其他浏览器**：iOS Safari、微信内置浏览器、Android 与实体手机都没测；触屏、其他视口尺寸和读屏软件没测；AI 每张约 0.3–0.4 s 的耗时和其间的页面停顿只在桌面 Chrome 上量过（推理期间页面不响应），手机上的耗时、内存、是否支持 WebAssembly SIMD 都不知道。
- **网络**：没有从大陆网络实测；Pages 上 `ai/` 只用 curl 带 `Accept-Encoding: gzip` 测过传输大小（五个文件共 10,344,436 B，均为 `Content-Encoding: gzip`），浏览器实际协商的编码和 Cache Storage 命中没测；纯 http 的局域网页面没有 Cache Storage，每次都要重新下载约 23 MB。
- **AI 准确率**：只在 75 张公开 CC 图（及其六种退化）上量过，没有在真实观众的手机照片上量过，不当作产品指标。
- **用户**：没有目标用户试用，没有「愿意主动交换」的证据；示例角色、场次、歌曲和示例照片的拍摄时间都是虚构的（Lin 21:47、阿遥 21:48，一开始就是一对「同一刻」）；自填的场次、视角、拍摄时间和照片不构成到场认证。
- **QQ 音乐**：链接只是按歌名的搜索，不是核实过的同一录音的直达页；2026-09-30 用 curl 复查：桌面 UA 落到 `y.qq.com/n/ryqq_v2/search?w=晴天&t=song`，iPhone UA 被转到 `i2.y.qq.com/n3/other/pages/myqq/index.html`（搜索词丢失），所以另给了「复制歌名」；没有内置音频，不称站内播放。
- **PNG 导出**：新增的拍摄时间与歌名行没有导出文件的字节数与目视记录，待 `space-ticket-v016.png` 一并留证。
- **房间版**：只在同一台电脑的两个来源（`127.0.0.1` 与 `localhost`）之间走过，没有两台设备，也没有 HTTPS；Docker 没有构建成镜像（拉取 `node:24-alpine` 的元数据 7 分钟没有返回，已中止），只在临时目录里用 `Dockerfile` 的同一文件集模拟了构建阶段与运行阶段。
- **其他**：减少动态没有独立验证记录；14 条轻微发现的处置没记；`package.json` 版本号仍是 0.15.0；视频、封面没做，报名介绍待团队核对，没有队友评审这些材料的记录。

## 历史 · Map × Space 共享项目（0.15.0 及更早）

以下是 Map × Space 共享项目时期的记录，原文保留，不代表 Music Space 的当前状态；其中的唱片店、寻声、完整图鉴、开放曲库等属于 Map。

## Done · 0.15.0

分支 `feat/night-courtyard-polish`，负责人 Claude（多代理并行，文件范围互斥）。用户要求：视觉包装为成败根本、全部完成并细致打磨、找关系改为探索式而不是直接给出结果。

| 任务 | 文件 | 本轮证据 |
| --- | --- | --- |
| 夜场小院 | `sakura-scene.js`、`sakura-world.js` | 夜空与地平线暖辉、月光唯一投影、店内暖光、两组串灯与光晕、舞台 par 灯与光束、亮窗远屋、夜樱；8 盏灯常驻、按机位只补间强度；唱片桌由 tableSpot 照亮。vendor/sakura 未改。实现者在开发服务器 1440×900、1280×720、390×844、320×568 目视首页、唱片店、照片墙、工作桌、收藏与照片抬起；减少动态下灯光即时切换；禁用 WebGL 模拟降级为浅纸深字 |
| 首屏与外壳 | `home.js`、`app.js`、`index.html`、`night-shell.css` 等 | 「同一刻，／另一面。」价值主张、三步与首访纸卡；深色玻璃导航、夜间纸件阴影、琥珀焦点环；首页不再显示照片投影标签。最终构建 1440×900 首页已目视：[截图](assets/themes/night-home-desktop-v015.png) |
| 寻声一局 | `map.js`、`map-network.js`、`map-data.js`、`sakura-music.js`、`map-round.css` 等 | 默认题「费玉清 → 邓紫棋，隔着几首歌？」，迷雾唱片、翻开/前往、三级提示、揭晓、抵达仪式与连线歌单；完整网络退到「完整图鉴」。实现者完整玩过默认题、提示①②③、揭晓、换一组、自选起终点、图鉴「和 TA 隔几首？」、刷新继续、旧存档迁移、减少动态、无 WebGL、1280/390/320。泄题审计（页面文字、aria/title/alt、场景标签、完整 HTML）在入口、局中、死胡同与新题均无未认识艺人名；最终构建入口另查 body HTML 不含 10 位未认识艺人名：[截图](assets/themes/night-round-desktop-v015.png)。局中署名表关闭、到连线歌单才开放（署名会带出未认识的人名） |
| 双联仪式页与 PNG | `duet-ceremony.js`、`duet-facts.js`、`duet-ceremony.css`、`ticket-export.js`、`live.js`、`live-library.js`、`space.js` | 三个入口共用全屏仪式页，首映/回看分开，减少动态直接终态。实现者用私有后端与两个隔离来源完成真实房间接受→首映→收藏回看→PNG→删除确认，另跑本地示例；最终构建本地示例接受后仪式页已目视：[截图](assets/themes/night-duet-desktop-v015.png)，并实际导出 1600×1800 PNG（3,155,122 B），两张照片带「AI 生成示例照片」、页脚为本地虚构声明 |
| 集成审查与修复 | 上述文件 | 5 个镜头独立审查、每条发现由怀疑者复核：27 条确认（1 高、11 中、15 低）、5 条被驳回；27 条均已修复并按原复现步骤复测（含降级桌面导航不可点、翻开抬起动画被自杀、示例歌单注脚误称“已核实”、多处焦点环与对比度、减少动态进唱片店长时间同步重绘、短屏保存失败无可见提示）。另修 4 个小尾巴：统计行不换行、死选择器、导出错误改 role=alert、降级手机收藏页 4px 横向溢出（后两项仅代码核对，未重新截图） |
| 封面 | `delivery/cover.png`、`delivery/recording-source/cover-v015.html` | 1920×1080、1,284,063 B；右侧为上述实际导出票根、左下为寻声题签截图，页内注明演示照片由 AI 生成；已目视，截图前移除浏览器扩展注入的节点 |
| 构建与运行包 | Vite、`delivery/music-map-space-runtime.zip` | `npm run build` 成功，69 模块；HTML 1,984,681 B / gzip 658.03 kB。全部 `web/js` 与 `server` 文件 `node --check` 通过。ZIP 678,862 B，6 文件（页面、两个后端文件、package、运行说明、许可），无数据库、用户照片或 HF 原始 CSV。无新依赖、无后端或数据库改动 |
| 文档与版本 | 产品三文档、README、视觉规范、AGENTS、CHANGELOG、交付与参赛说明 | MVP 0.15.0 / 文档 2.6；美术方向冻结为「樱下放映 · 夜场」。0.15 画面登记在[视觉规范](VISUAL_THEMES.md) |
| GitHub | [PR #5](https://github.com/musicMapTeam/musicMap/pull/5) | 按用户授权推送分支并开 PR；Build demo 检查通过（11 秒，[run 36318023130](https://github.com/musicMapTeam/musicMap/actions/runs/36318023130)），2026-09-27 12:10 UTC 合并到 main，合并提交 `e3a36ca` |

未验证与边界：本机 CPU 被无关进程长期占满（页面常低于 10fps），动画节奏、仪式时长（设计 ≤1.8s）与帧率未能在正常硬件上确认；手机均为 Tabbit 模拟视口，未做实体手机、双指与读屏软件验收；未重录视频、未部署、未推送。没有新增或运行测试套件。连线歌单 1440 与三张 390 画面来自实现阶段开发服务器，其余三张来自最终构建。

## Done · 0.14.0

| 任务 | 负责人 / 文件 | 本轮证据 |
| --- | --- | --- |
| UI 与场景共同构图 | spatial_music、root：`sakura-framing.js`、`sakura-camera.js`、`sakura-scene.js` | 测量可见纸件与弹窗，按主体边界适配剩余区域；展开、收起、切页、缩放窗口时重构图。透明容器不占整屏；修正可用空间不足时的投影尺寸更新 |
| 纸件收合 | spatial_docs、root：`home.js`、`live.js`、`map.js`、`scene-panels.css` | 最近现场、本人卡、连接与路线按需展开；主动作、私藏状态、申请与错误保留。实际打开/收起首页最近现场、现场本人卡和探索索引，未保存或公开既有照片 |
| 探索桌与点击区域 | root：Tabbit 生产页面 | 1280×720 查看完整唱片桌及展开索引；360×640 露出全部 12 个名字。320×568 实际点击放大到 1.28、全图回到 1.00，12 个名字可见；修正透明标题容器拦截缩放按钮。展开索引时优先名字避碰，完整目录仍可操作 |
| 小屏场景 | root：Tabbit 生产页面 | 320×568 首页保留完整小院；360×640 照片墙默认纸件间留出舞台与照片，展开本人卡后镜头同步；390×844 和 1440×900 收藏页保留收藏架。截图见[视觉规范](VISUAL_THEMES.md) |
| 弹窗与短屏表单 | spatial_docs、root：`scene-layout.css`、票根样式 | 1440×900 Map 作品内页旁仍露出唱片桌；双联详情照片并列、说明在下，去掉大段英文口号。360×640 双联已目视，保存图片按钮可滚到；320×568 编辑已有卡，隐私与保存现场卡按钮可滚到，未点击保存 |
| 静态审阅 | paper_language、root | 检查 details 状态、测量观察器与清理、弹窗动画收尾；修复短屏外层滚动、确认弹窗位移及 blocked 时投影更新。未新增依赖、接口或数据库迁移 |
| 构建与运行包 | root：Vite、`delivery/music-map-space-runtime.zip` | 最终构建成功，64 模块；HTML 1,857,914 B / gzip 626.63 kB。ZIP 647,080 B，6 文件：页面、两个后端文件、package、运行说明与许可；无数据库、用户照片或 HF 原始 CSV |
| 文档与版本 | paper_language、root | MVP 0.14.0 / 文档 2.5，产品、实施、交付、视觉与变更记录同步；历史证据保留原版本 |
| GitHub | 分支 `fix/scene-ui-framing` | 提交 PR，沿用既有 Build demo 检查，按用户授权在通过后合并；实际结果和时间以 PR 记录为准 |

本轮只做构建、改动路径的浏览器操作与静态审阅，没有新增或运行测试套件。上述手机尺寸为模拟视口；实体手机键盘、双指与帧率未在本轮实测。未重跑交换全流程、改既有卡片或将本机服务写作公网部署。空间索引展开或缩放后会优先展示不碰撞的名字，未显示的名字仍可通过唱片、查找和目录访问。

## Done · 0.13.0

| 任务 | 负责人 / 文件 | 本轮证据 |
| --- | --- | --- |
| 完整关系网 | root、spatial_music：`map-network.js`、`map.js`、`sakura-music.js` | 展示数据集全部节点与边；按数据集 / 关系类型缓存固定布局，选择不重排。12 人 / 13 条作品边，不再只显示当前艺人的一圈邻居 |
| 真实回路 | spatial_docs：`map-catalogue.js`、[来源记录](../references/research/2026-09-27/vocal-network-expansion.md) | 增加《黑暗骑士》、2020 周杰伦与林俊杰联唱、英文《Stay With You》，新节点孙燕姿，形成 2 个独立回路；旧 ID 保留。官方署名按录音版本核实；HF 共同署名没有冒充共同演唱 |
| 查询与行走 | root：生产页面；paper_language：只读约束审阅 | 实际查询费玉清→周杰伦→林俊杰→孙燕姿，显示 3 次合作、4 个高亮节点及 3 条高亮边，原探索路线不变。点联唱打开版本、署名和人民网来源；袁咏琳沿《画沙》前往周杰伦只追加 1 步，返回恢复原路线。切 session 清理旧选中和查询 |
| 视野与交互 | 场景控件与 Map 共用动作 | 实操按钮缩放到 1.28，拖动节点标签移动约 85px / -20px，未误开面板、路线未变；全图恢复 12 个可见艺人。搜索选中与缩放不记步，默认倍率拖离后搜索回全图；双指与无 WebGL 全图仅静态核对，未声称真机 / 降级实测 |
| 纸面 UI | root、spatial_music：`map-spatial.css`、机位与模型 | 桌面镜头留出整网边界，连线缩细贴纸；印刷封套、短标签、合作索引、查询链与路线同属纸桌。已目视 1440×900 整网和 390×844 查询，12 个艺人可见；修复动作换行、手机标题堆叠、底部挡节点与字体覆盖。图见[视觉规范](VISUAL_THEMES.md) |
| 数据集切换 | root：生产页面 | 切至情景示例的策展标签，显示「标签图谱」「9 人 · 8 条标签连接」，旧查询清空；返回真实合作可选择林俊杰。最终 canvas 为 1，桌面 scrollWidth / clientWidth 为 1440 / 1440 |
| 构建与运行包 | root：Vite、`delivery/music-map-space-runtime.zip` | 最终构建成功，61 模块；HTML 1,824,072 B / gzip 619.80 kB。ZIP 640,234 B，6 文件：页面、两个后端文件、package、运行说明与来源许可；无数据库、用户照片或 HF 原始 CSV。无新依赖或后端迁移 |
| 版本与文档 | spatial_docs、root | MVP 0.13.0 / 文档 2.4；README、三份产品文档、视觉、比赛当前介绍、交付和变更记录同步。旧图、0.4 视频和历史验收保持原版本边界 |
| GitHub | [PR #3](https://github.com/musicMapTeam/musicMap/pull/3) | 实现从 `feat/music-network` 提交；沿用既有 Build demo 工作流，按用户授权在检查通过后合并。检查结果及合并时间以 PR 为准 |

本轮只做生产构建、上述 UI 路径与静态审阅，没有新增或运行测试套件。390×844 是模拟视口；实体手机双指 / 帧率、公网部署、正式比赛视频与目标用户试用仍未完成。完整图指当前已收录数据集，不是完整华语音乐百科。

## Done · 0.12.0

| 任务 | 负责人 / 文件 | 本轮证据 |
| --- | --- | --- |
| 场景内音乐探索 | spatial_music、root：`sakura-music.js`、场景与机位、`map.js`、空间 API | 同一个 canvas 中的唱片桌、封套、黑胶和关系细线；投影标签接既有探索动作。实际点击邻居继续探索及中心唱片打开作品；周杰伦的 5 条合作在桌面和 390×844 中均可辨认，原 2D 图保留作 WebGL 降级。当前数据最大邻居数为 5，没有截断 |
| 纸件界面 | paper_language、root：`spatial-objects.css`、`map-spatial.css`、`live.js` | 场次票签、照片托盘、可展开目录、装订纪念册、封套内页；修复旧 CSS 覆盖、手机票签遮照片、门梁挡唱片与强墙影。实际目视桌面关系桌、纪念册，手机关系桌、作品内页、照片墙及纪念册；图片见视觉规范 |
| 操作接续 | root：生产页面 | 手机墙上小舟照片 → 原有已接受双联 → 我的记录，canvas 数为 1；原私藏状态、作者、两卡快照保持。已有卡编辑器的照片、短句、私藏与保存操作均可见，本轮未保存或改写旧卡；未重新发起交换 |
| 布局与动作 | 场景、镜头、纸件 CSS | 手机照片标签放到票签和托盘之间，两张照片标签可见；纪念册 `scrollWidth/clientWidth=390/390`。减少动态使用完整 yoyo 进度收尾；资源释放与路由清理为代码审阅，未做 GPU 性能或 WebGL 降级专项实测 |
| 构建与交付 | root：Vite、`delivery/` | 构建成功，60 模块；HTML 1,804,738 B / gzip 613.75 kB。完整 ZIP 634,057 B，6 文件：页面、两个后端文件、package、运行说明与来源许可；无数据库、用户照片或 HF 原始 CSV。无新依赖、后端接口或数据库迁移 |
| 文档与版本 | spatial_docs、root | MVP 0.12.0 / 文档 2.3；README、三份产品文档、视觉规范、交付说明和变更记录同步。旧图与视频保留原版本范围 |
| GitHub | [PR #2](https://github.com/musicMapTeam/musicMap/pull/2) | 实现与本地证据从 `feat/spatial-interface` 提交；按用户授权，在现有 CI 通过后合并，检查与合并时间以 PR 记录为准 |

本轮仅做生产构建、上述改动路径的浏览器操作及静态审阅，没有新增或运行测试套件。390×844 是模拟视口；实体手机、公网部署、正式视频和用户试用仍在 Todo。截图为内部示例，非目标用户验证。

## Done · 0.11.0

| 任务 | 负责人 / 文件 | 本轮证据 |
| --- | --- | --- |
| 唯一樱花艺术方向 | sakura_only：主题控制器、HTML、PNG 与旧主题 CSS；root 整合 | 页面、入口和导出固定为樱下放映，移除外观选择与另外两套 PNG 分支；历史偏好不再读取，不改业务存储 |
| 小院美术与纸面界面 | sakura_art：场景、原创建模与 `sakura-printwork.js`；root：首页、导航、`courtyard-ui.css` | 雨篷、木招牌、原创唱片封套、花树与宽叶花丛；背景山墙、门窗、阳台和远丘。已目视 1440×900 首页及 390×844 首页、制卡与 PNG 预览；画面见视觉规范。全屏小院常驻，照片沿用原授权 |
| 首页与唱片店 | root：`app.js`、`home.js`、`map.js` | 无 hash 固定回首页；本人纸卡入口、四项手机导航、桌面空间导航。已有房间点击顶部邀请码能进入加入表单。手机唱片架默认收起，展开后可打开《被风吹过的夏天》的逐人署名；未改原音乐收藏 |
| 邀请与草稿 | user_journey：`live.js`；root 整合与隐私修正 | 全新本机来源 8791：昵称 Enter → 创建内部场次 716244 → 自动展示邀请码和二维码。明确选 AI 示例图、填写短句 → 关闭编辑器 → 重开，短句与照片保留、默认私藏。保存后展示卡片，重开编辑器正确显示展示状态，随后已撤回私藏。草稿只保留当前挂载页面，切页或刷新不承诺恢复 |
| 精简与回访 | user_journey：`live.js`、`live-library.js` | 换房和离开收入“本场”；去掉常驻版本号及正常同步时间。已实际从「双联 0」空态回到内部场次，收藏中的新卡显示私藏；失效身份清理授权照片并指向重新入场；身份失效分支仅静态审阅，本轮未人为使旧身份失效 |
| 导出成品 | `ticket-export.js` | 单一樱花绘制成功生成实际 PNG 预览，图片自然尺寸 1600×1800；已目视照片、AI 示例标记、昵称、场次和短句。下载按钮已触发生成入口，本轮未获取系统下载文件，不记作下载文件验收；未主动发送图片 |
| 构建与运行包 | root：生产构建、`delivery/` | Vite 构建成功，57 模块；HTML 1,754,288 B / gzip 605.76 kB。ZIP 625,816 B，共 6 文件：页面、两个后端文件、package、运行说明与来源许可；无数据库、用户照片或原始 HF CSV。无新依赖或数据库迁移；临时 8791 服务已停止，日常 8787 及新版首页保留 |
| 文档与版本 | user_journey 与 root | MVP 0.11.0 / 文档 2.2，README、三份产品文档、视觉规范、运行与交付说明、变更记录同步；旧版本证据保持原范围 |
| GitHub | [PR #1](https://github.com/musicMapTeam/musicMap/pull/1) | 独立分支提交；实际 CI 与合并状态以 PR 为准，按用户授权在检查通过后合并 |

本轮使用内部 AI 示例照片和独立本机来源，不是目标观众试用。只做构建、改动路径的必要浏览器操作与静态审阅，没有新增或运行测试套件，未重跑既有双人交换全部路径。当前移动端为 390×844 模拟视口，不代表实体手机帧率或跨设备验收。评审部署、新版视频、真实用户试用与正式提交仍在 Todo。

## Done · 0.10.0

| 任务 | 负责人 / 文件 | 本轮证据 |
| --- | --- | --- |
| 首次进入与首页动作 | root：`home.js`、`app.js`、主题入口 | 全新本机来源 8790 首开为樱花；从空 hash 首页进入记录再返回，正确回到首页。8787 声浪主题切换两张本人卡后，原照片节点仍连接、选中状态正确；随后恢复原樱花偏好 |
| 两步制卡与创建场次 | spatial_feasibility：`live.js`、`live-compose.css` | 新访客昵称 Enter 打开创建；内部场次 349028 明确选择 AI 示例图→下一步→填写短句→上一步→下一步，输入保留、默认私藏。保存并刷新后旧卡直接进入详情步；390×844 下照片、短句、隐私与保存同时可见，无横向溢出。场次选填折叠后弹窗可视 / 内容均为 369px，带入歌名仍保留 |
| 成品预览与保存 | catalogue_roles：`ticket-export.js`、`memory-export.css`；root 整合 | 从新卡导出，实际 PNG 预览 `naturalWidth=1600`、`naturalHeight=1800`，已目视照片、作者、场次、短句与主题排版；关闭返回原保存结果。文件分享按钮可见，未发送。下载沿用原入口，但本轮未获取系统下载文件，不将页面预览写成下载文件验收 |
| 音乐收藏保位与数量 | hf_catalogue：`map.js` | 手机 Map 收藏 / 取消《千里之外》前后内容滚动均为 443px，焦点回到对应按钮；取消变为 0 首。再次收藏后，从音乐收藏取消，再回 Map 为 0 首；历史路线保留。此操作仅在独立内部来源进行，未改原 8787 音乐收藏 |
| 排版、说明与交付 | root 与协作代理 | 保存结果排版收紧；三份产品文档、视觉规范、README、运行说明与更新记录同步。三张 0.10 手机画面见视觉规范；没有新增依赖、后端接口或数据库迁移 |
| 构建与运行包 | `dist/index.html`、`delivery/music-map-space-runtime.zip` | Vite 构建成功：1,773,731 B / gzip 606.89 kB；完整 ZIP 626,525 B，6 个文件。包内无数据库、用户照片或原始 HF CSV；临时 8790 服务已停止，日常 8787 服务保留 |
| GitHub 与 CI | 应用提交 [289a2de](https://github.com/musicMapTeam/musicMap/commit/289a2decd216e32687ebdaf5d037aeec9f522c39) | 已推送 `origin/main`；原有工作流 [run 36275027831](https://github.com/musicMapTeam/musicMap/actions/runs/36275027831) 成功，Node24 构建、后端语法检查及单页 / 完整运行包两份产物上传完成；随后仅补本状态记录 |

本轮只做构建、上述改动路径的浏览器操作与静态审阅，没有新增或运行测试套件。新卡是 AI 图片的内部示例，未重跑既有双身份交换、全部主题导出或实体手机验收。视频、评审部署与用户试用仍见 Todo。

## Done · 0.9.0

| 任务 | 负责人 / 文件 | 本轮证据 |
| --- | --- | --- |
| 本人主页与独立示例 | root：`home.js`、`app.js`、`space.js` | 主页读取本人最近两张卡，主按钮进入真实制卡；实际恢复既有房 519159 的编辑器，未改旧卡。明确进入 Lin / 阿遥本地示例后可返回个人首页；三套1440×900首页已目视 |
| 跨场次私人收藏 | catalogue_roles：服务接口；spatial_feasibility：`live-library.js`、`library.css` | 新增本人 `/library` 与本人双联删除接口，不改数据库结构。实际打开本人卡、既有双联与已离场卡；离场回访只预填邀请码，未自动加入。删除路径只做静态核对，未删除旧双联 |
| 音乐到现场 | hf_catalogue：Map、开放曲库、`music-library.js` | 实际搜索 Sam Smith、收藏 Unholy、从音乐收藏带入新场次，歌名已预填且可编辑。刷新后歌曲仍在；旧 Map 收藏只导入一次，取消操作保留迁移标记。没有新音频或模型 |
| 保存与回访闭环 | catalogue_roles：`live.js`；root 整合 | 内部示例场次 853382：创建→自动编辑→明确选 AI 示例图→私藏保存→个人收藏→返回现场→打开邀请；离场后刷新仍可翻开该卡。邀请准确提示本机地址不可跨手机使用 |
| 排版与空间 | root 与 hf_catalogue：样式、场景标签 | 修正切页继承滚动位置、Map 作品和路线重叠；压缩制卡表单及房间空态，主页物件标签区分场次。查看390×844首页和双联页，无横向溢出；保留原常驻场景与镜头机制 |
| 导出入口 | 收藏页→既有双联 | 实际触发 PNG 生成，页面返回成功提示；Tabbit 不提供 download 事件，本轮未获取和目视新 PNG，不将提示写成文件验收。历史 PNG 证据仍见对应版本 |
| 文档与运行包 | 三份产品文档、README、`delivery/` | 0.9.0 / 文档2.0；Vite 构建1,752,477 B / gzip603.28 kB，ZIP622,801 B、6文件。包内无数据库、上传照片或原始HF CSV；六张当前预览在视觉规范中列明 |
| GitHub 与 CI | 应用提交 [1a10715](https://github.com/musicMapTeam/musicMap/commit/1a10715ec2041b7c8ae47a99fae870d49cb2f67f) | 已推送 `origin/main`；原有构建工作流 [run 36273789679](https://github.com/musicMapTeam/musicMap/actions/runs/36273789679) 成功，Ubuntu / Node24 构建、后端语法检查及两份构建产物上传完成。随后仅补本状态记录 |

本轮只做构建、上述改动路径的浏览器操作和静态审阅，没有新增或运行测试套件。新增场次与卡片均为内部示例，不是目标观众试用；没有重跑既有双身份交换全流程。0.4 视频与封面尚未重制，公网部署、真实用户反馈及正式赛事提交仍见 Todo。

## Done · 0.8.0

| 任务 | 文件 / 路径 | 本轮证据 |
| --- | --- | --- |
| 完整三维场馆 | `sakura-world.js`、`sakura-scene.js` | 原创建模：开放唱片店、树下舞台与乐器、六槽照片墙、工作桌、店内收藏架、灯串、花树与猫；全屏常驻画布，六类机位。实际查看桌面全景、唱片台、照片特写、工作桌和收藏；修正店内门板遮挡 |
| 镜头与物件动作 | `sakura-camera.js`、GSAP、场景拾取 | 点击照片后靠近并抬起，再打开真实预览；关闭返回基础机位。直接点击三维桌面打开编辑器；连续点照片再切收藏，最终 `records`、弹窗数 0、画布数 1；取消的行进没有打开旧卡。品牌和小院导航明确回全景 |
| 业务与权限 | `app.js`、`themes.js`、`space.js`、`live.js` | 本地卡接原有编辑 / 申请 / 双联；既有联网身份的两张授权照片出现在墙上，点击小舟卡打开已接受双联。未新发交换、未改服务器协议；未重跑后端权限或导出全流程 |
| 内容生命周期 | 场景贴图与页面生命周期 | 按卡 ID 保持槽位，防止自卡异步加载挤走正在查看的卡；选中卡撤下时复原机位。清缓存 / 退出前撤下照片，贴图只接已授权 blob 或项目示例；工作桌显示自己的可见卡图 |
| 手机与操作层 | `spatial-world.css`、390×844 模拟视口 | 独立竖屏镜头、下部操作层；压缩看卡预览和房间列表，编辑表单采用单列。手机看卡的内容和继续按钮可同时展示；减少动态下 photo 机位即时到达且无 travelling。保留长内容滚动；修正嵌套联网弹窗继承隐藏样式。截图按当前版本存于视觉规范 |
| 环境与资源 | `sakura-batch.js`、场景清理 | 20 片独立相位的卷曲落樱、慢转唱片与猫呼吸；重复静态几何按材质 / 动作分组实例化，动态对象与照片除外。切到独立刊物画布 0，切回樱花 1；调度与批处理不等于实体设备帧率保证 |
| 构建与运行包 | `dist/index.html`、`delivery/music-map-space-runtime.zip` | Vite 生产构建成功：1,706,477 B / gzip 592.41 kB；本地完整运行包 611,504 B，6 个文件。MVP 0.8.0 / 文档 1.9，无新依赖与数据库迁移 |
| GitHub 与 CI | 应用提交 [5706b8e](https://github.com/musicMapTeam/musicMap/commit/5706b8eabb83fc5850ff5a789969e1371f2d0329) | 已推送 `origin/main`；原有构建工作流 [run 36272173975](https://github.com/musicMapTeam/musicMap/actions/runs/36272173975) 成功，产出单页与完整运行包。随后仅补本状态记录 |

本轮只做构建、改动相关的浏览器画面与入口检查、静态代码审阅；没有新增或运行测试套件。场景使用的现场配图是项目内部 AI 示例，不代表真实观众试用。现有 0.4 视频和封面没有重制，公网评审链接、目标用户试用和正式提交仍在 Todo。

## Done · 0.7.0

| 任务 | 文件 / 路径 | 本轮证据 |
| --- | --- | --- |
| 逐人制作署名 | `map-catalogue.js`、`map.js`、`map-credits.css` | 10 首作品全部补词曲；9 首另有编曲、制作、录音、演奏等核实工种。《小酒窝》存在版本冲突，只收官方演唱、词曲。按姓名归并工种，每项有来源数字；实际打开《被风吹过的夏天》查看逐人表，来源和播放分开 |
| 音乐入口 | 10 首真实精选作品 | `listenLinks=[]`，撤下原 YouTube 去听按钮。QQ 同一录音直达未核实，未猜 songmid；证据链接仍可查看来源 |
| HF 完整元数据 | `data/external/spotify-tracks-dataset/`、`scripts/datasets/download_hf_catalogue.py` | 真正下载 20,118,244 B CSV；114,000 行 / 21 列 / 89,741 个 track_id。固定 revision 635b034f69257814eff850a5c2b3346fe458134f，下载脚本校验 SHA-256 与 HF LFS 对象一致。无音频、歌词或模型权重 |
| 开放曲库 | `web/assets/data/hf-collaborations.json`、`open-catalogue.js` / CSS | 120 首去重共同署名作品，前端可搜索。实际搜索 Sam Smith 返回 Unholy 与 Kim Petras；UI 明确制作分工未收录，保留原始出处。完整原始 CSV 忽略 Git，派生 JSON 与脚本入库 |
| 常驻三维小院 | `sakura-scene.js`、`themes.js`、`app.js`、`spatial-world.css` | Three 0.186.1 透视场景；全景、唱片台、照片墙、收藏架对应四路由，新增照片墙、收藏架与猫模型。实际查看四个桌面机位和转场中间画面；桌面场景与功能区并列，手机上部小院与卡叠 |
| GSAP 交互时序 | `motion.js`、场景控制器、GSAP 3.15.0 / Flip | 可打断曲线路径、卡片换位、弹窗与页面进入；实际手机切人海，连续切页后保留同一 canvas（计数 1）。切走樱花后 canvas 为 0，切回为 1。减少动态时 explore 机位立即到位，无 travelling 状态。修复中断弹窗的内联样式残留和存储重试区域的指针事件 |
| 构建与交付 | `dist/index.html`、`delivery/music-map-space-runtime.zip` | 最终生产构建 1,502,337 B / gzip 536.26 kB；本地完整运行包 555,179 B，原有 6 文件范围。樱花桌面与手机新截图已留在 `docs/assets/themes/`；无数据库、原始曲库或用户照片入包 |
| 手机与许可 | 390×844 模拟视口、Vite、NOTICES | 手机首页宽与滚动宽均 390；卡片、做卡 / 邀请按钮位于底导航上方。保留 Three / Sakura MIT；GSAP 为 Standard No Charge，原版权及许可引用随 HTML。HF 仅标 bsd、无独立 LICENSE 的事实单独记录 |
| GitHub 与 CI | 应用提交 [12a164f](https://github.com/musicMapTeam/musicMap/commit/12a164ffef39c3cc68504821bde59454194c2b97) | 已推送 `origin/main`，远端 HEAD 对应应用提交；原有 [run 36270083709](https://github.com/musicMapTeam/musicMap/actions/runs/36270083709) 成功。随后仅补这条交付记录 |

这里只做构建、针对本轮改动的界面查看与静态代码审阅，没有新增或运行测试套件，没有重跑后端交换、照片权限或 PNG 导出。调度的 30 / 60fps 与资源释放代码不等于实体手机性能实测。现有 106 秒视频和封面仍为 0.4，评审部署与外部用户试用仍待团队处理。

## Done · 0.6.0

| 任务 | 文件 / 路径 | 本轮证据 |
| --- | --- | --- |
| 应用构图重做 | `app.js`、`app-studio.css` | 桌面悬浮导轨、手机底部胶囊导航、右上外观工具；取消海报页眉及整块分隔。实际查看记录收藏和已存在的内部演示房间 |
| 同场照片工作台 | `space.js`、`space-studio.css` | 首页照片卡叠、舞台 / 人海切换、制卡与邀请入口；实际点「做一张卡」进入工作台并打开编辑器，未提交改卡。手机场景移至卡叠后方，最终390×844页面尺寸390×844，按钮在底导航上方 |
| 唱片关系图 | `map.js`、`map-studio.css` | 无框唱片图、作品短浮卡和路线控制；实际切换真实曲库，390px点金莎唱片打开入选作品弹窗并关闭，官方外链可见。最终手机页面尺寸390×844；未重跑挑战或收藏全流程 |
| 真正的三渲二管线 | `sakura-scene.js`、`vendor/sakura/` | MIT cel彩色阴影 → 深度描线 → 调色 → FXAA；适配Three0.186.1、正交相机和小景尺度。实际查看桌面/手机GPU输出，完整唱片店、树、街面可见；保留30fps、DPR≤1.5、像素预算和生命周期限制，未做设备性能剖析 |
| 房间与收藏细节 | `live.js`、`app-studio.css`、记录模板 | 房间小照片卡、收藏网格与胶囊角色切换；修复整合中同场卡片flex压缩。最终查看森森 / 小舟旧房两张照片与既有共同记忆，没有新增房间、发送申请或改动旧照片 |
| 三套当前预览 | `docs/assets/themes/` | 最终1440×900声浪/樱花/刊物首页截图均已目视并覆盖预览；三主题即时切换。手机最终目视樱花首页与地图，地图最后缩短21px后只读回尺寸，不宣称三主题所有手机分支均验收 |
| 源码与许可 | NOTICES、`SOURCE.json`、完整MIT、研究记录 | 固定上游提交与逐文件改动留档，完整许可进入单HTML；没有搬入原作世界、人物或音频 |
| 构建与运行包 | `dist/index.html`、`delivery/music-map-space-runtime.zip` | 最终Vite构建成功；HTML1,349,206 B / gzip约480.01KB，ZIP497,925 B，原6文件范围；没有数据库、上传照片或凭据 |
| GitHub 与 CI | 应用提交 [06796f7](https://github.com/musicMapTeam/musicMap/commit/06796f74f5d1fdb30677e16c7f2491ebd010c18e) | 已推送 `origin/main`；原有 [run 36268172621](https://github.com/musicMapTeam/musicMap/actions/runs/36268172621) 成功。随后仅更新本状态记录 |

本轮以重构相关画面和入口为范围，未新增测试套件，后端与PNG导出未改也未重复验收。0.4视频与封面未重制；评审部署、外部用户反馈与正式提交仍见Todo。用户是否认可新的审美仍待反馈，不能由实现者的截图查看替代。

## Done · 0.5.1

| 任务 | 文件 / 路径 | 本轮证据 |
| --- | --- | --- |
| 界面减法 | `app.js`、`space.js`、`map.js`、`live.js`、`themes.js` | 删除导航副标题、重复页眉页脚、教程与口号；首页只留主视觉、一句介绍、两个入口；来源与详细连接按需打开 |
| 示例独立入口 | `space.js`、`space.css` | 实际点入示例，切换阿遥后仍留在示例，再切回 Lin、返回首页；旧卡片与交换结果继续展示，本轮未重复发送交换 |
| 布局与三主题 | `compact.css`、Map / Space CSS、`docs/assets/themes/` | 查看三套1440×900首页并更新预览；查看刊物地图、390px樱花首页/外观选择/长编辑弹窗。最终刷新后桌面Map文档高度900/视口900，手机樱花首页844/844，宽度分别1440/390，无横向溢出；短屏与长业务内容允许自然滚动 |
| 滚动与表单 | OverlayScrollbars 2.16.0、原生 dialog | body 使用6px自动隐藏浮动条；长制卡弹窗原生滚轮从0滚到540，内容高1354、视口814，未裁掉字段；现有房间可重新进入。编辑器未提交，不改已有卡片 |
| 开源与许可 | `interface-restraint.md`、NOTICES、完整MIT文件 | 比较OverlayScrollbars/SimpleBar，直接采用前者npm固定版本；Codrops只参考按需展开，未复制其代码或素材。单HTML附完整许可 |
| 构建与交付 | `dist/index.html`、`delivery/music-map-space-runtime.zip` | 最终构建1,274,445 B / gzip约465.28 KB；运行包482,838 B，原有6文件范围。README、三份产品文档与视觉规范同步 |
| GitHub 与 CI | 应用提交 [715a80a](https://github.com/musicMapTeam/musicMap/commit/715a80af4f944c6e804fb3492b960cd56d4067f0) | 已推送 `origin/main`；原有 [run 36266662842](https://github.com/musicMapTeam/musicMap/actions/runs/36266662842) 成功。随后仅更新本状态记录 |

检查限于改动相关界面。未新增测试套件，未重跑后端、PNG导出或交换全流程；视频/封面仍为0.4，公网部署与目标用户试用仍见Todo。最后将手机声浪缩略图字号从20减为18并重新构建，未再次截图。

## Done · 0.5.0

| 任务 | 文件 / 路径 | 本轮证据 |
| --- | --- | --- |
| 三套完整外观 | `themes.js`、三份主题 CSS、app 与入口 | 外观选择器可即时切换，主题独立存储；三套桌面首屏真实截图见 `docs/assets/themes/`，390px 樱花 / 刊物首屏与选择器已查看，无横向溢出 |
| 原创樱花音乐街角 | `sakura-scene.js`、`theme-sakura.css` | 桌面与 390px 实际渲染；切到刊物后 canvas 数从 1 到 0。Three 0.186.1；固定镜头、30fps上限、DPR≤1.5、减少动态静帧、隐藏 / 离屏暂停、退出释放均已实现并只读检查；未做低端设备性能实测 |
| 排版与浅色细节 | `themes.css`、主题 CSS | 修正刊物标题入场越界、地图暗色光团、侧栏内边距、输入框 / 图例 / 空态 / 角色切换的文字对比；查看两套浅色 Map、记录、制卡及实际房间双联弹窗，修正后重看相关画面 |
| 切换保留内容 | 实际生产页面 | 联网入口邀请码草稿 `246810` 在切换后保留，随后清空；旧房间身份、私卡与共同记忆仍可打开。只改变外观，不重新跑交换，也未增加新房间 |
| 外观持久化 | localhost 生产页面 | 选择刊物后刷新仍为 `zine`，最后保留樱下放映预览；记录页中的角色、计数与探索记录保持可读 |
| 三主题 PNG | `ticket-export.js` | 新主题导出前固定所选风格，原声浪绘制保留；实际下载樱花双联 1,082,449 B、刊物双联 1,099,741 B，均 1600×1800 并已目视。此处使用 0.4 内部演示上传的项目 AI 图，不代表真实观众照片；没有逐项重跑单卡全部分支 |
| 参考与许可 | `references/research/2026-09-27/sakura-visual-reference.md`、NOTICES、Three MIT | 参考固定提交，借鉴美术原则；不复制 Sakura Crossing 源码 / 原图 / 音频。实际 Three 完整 MIT 副本及单 HTML 许可注释已保留 |
| 文档与构建 | README、设计规范、产品三文档、Vite | 文档 1.5；生产构建成功，单 HTML 1,226,498 B / gzip约451.69 KB。无新测试套件，不重复无关后端流程 |
| GitHub 与 CI | 实现提交 [135b136](https://github.com/musicMapTeam/musicMap/commit/135b1360772c08ce774e7a27218e10c95a773cb1) | 已推送 `origin/main`；[run 36265132031](https://github.com/musicMapTeam/musicMap/actions/runs/36265132031) 成功，原有构建工作流完成。随后文档收尾不改变已检查应用源码 |
| 本地运行包 | `delivery/music-map-space-runtime.zip` | 468,909 B，原有6文件范围；页面含完整第三方许可证，不含数据库、上传照片或凭据 |

边界：现有 106 秒视频与封面仍为 0.4 真实流程展示，不含三主题。未新增公网部署、实体手机或外部用户试用；内存释放为代码审阅和 canvas 移除观察，不等同于 GPU 性能剖析。

## Done · 0.4.0

| 任务 | 文件 / 路径 | 本轮证据 |
| --- | --- | --- |
| 赛事、竞品与开源研究 | `references/research/2026-09-27/` | 正常 UI 重读官方评分、FAQ 与提交关键格；竞品一手来源、开源具体文件、采用 / 舍弃表；不虚构评分权重或获奖案例 |
| 产品取舍 | 三份产品文档、Space 首页 | 收紧到散场后邀请小圈交换视角；Space 主线、Map 可选；明确相册替代风险、单人收益及待用户验证条件 |
| 真实合作精选 | `map-catalogue.js`、Map | 11 位艺人 / 10 首作品 / 10 条合作；官方署名与核对日期。实际周杰伦 → 张惠妹 → 依据面板；切换前的虚构路线仍保留，未重复旧挑战全流程 |
| 自定义活动与个人照片 | `server/`、`live.js`、`live-photo.js` | 新房名称、日期、地点、歌名真实保存；两张项目 AI 演示图片经文件选择器上传，浏览器压至 960px JPEG。旧身份和旧房列表在迁移后仍可读取 |
| 独立身份换卡 | Live 生产页面 | A 森森（127.0.0.1）私卡、B 小舟（localhost）展示卡；返场 / 舞台与人海解释 → A 确认两卡申请 → B 接受 → A 自动同步；双方各有共同记忆。两来源隔离存储身份，不是实体双手机或外部用户 |
| 导出与邀请 | `ticket-export.js`、QR | 实际下载单卡 1,041,477 B / 双联 1,097,920 B，均 1600×1800；目视双联文字与照片。QR 展示本机链接及不能跨手机访问的提示，不声称实体扫码已通过 |
| 显示与照片读取 | 桌面 / 390px | 桌面新制卡、QR、双联及 Map 来源；390px 编辑器、双联与真实合作列表无横向溢出。已授权双联两图均加载为 960px；无 Bearer 照片请求 401。修复缓存换代后弹窗重新取图，未做慢网专项验收 |
| 生产构建与运行包 | `dist/index.html`、`delivery/` | 最终构建 588,715 B；ZIP 310,088 B，6 文件，不含 SQLite 数据、用户照片或凭据；原服务器重启执行新增字段 / 表迁移 |
| 新封面 | `delivery/cover.png` | 1920×1080、385,709 B，实际导出票根为主体，标明 AI 演示照片；已目视 |
| 实际操作视频 | `delivery/music-map-space-demo.mp4`、`recording-source/` | 106秒、1920×1080、30fps、7,199,962 B、中文字幕、无音轨；全片解码通过。协作者查看多个关键帧，整合者另查看片头、70秒接受结果、98秒真实依据；原片剪点 / 定格 / 身份边界已留档 |

边界：没有新增测试套件；本轮只检查变更路径。官方外链并非站内音频播放，未实测全部平台播放；未部署公网、未跑容器、未做实体手机与外部用户研究、未正式提交。历史权限及删除记录仍按对应版本保留，不把代码阅读或老证据当作 0.4 全面验收。

## Done · 0.3.0

| 任务 | 负责人 / 文件 | 具体证据 |
| --- | --- | --- |
| 探索引导、收获与返回 | Map：`web/js/map.js`、`web/css/map.css`；壳层与 Space | 已操作第一跳到乔屿、保存“这一跳”的合作作品，进入 Space 后恢复林间 → 乔屿原路线；从现场艺人另开路线作为独立动作 |
| 本地制卡与交换 | Space：`web/js/space.js`、`web/css/space.css` | 390px 下完成输入前置 / 折叠预览 / 底部保存 → 申请 → 阿遥接受 → 双方自动各存记录；相同卡对打开已有双联，不重复申请；旧接受记录保留手动保存入口，自己的卡仍可单独收藏 |
| 真实房间细节 | Live：`web/js/live.js`、`web/css/live.css` | 独立 localhost 朋友会话入房后，主会话私卡空态准确；私卡保存可选择展示或保持私藏；离开后刷新，邀请码仍在且未自动入房。完成时间统一与纸质保存栏已实现 |
| 记录与导航 | 整合：`web/js/app.js`、`web/css/base.css`、入口 | 记录筛选 / 计数和 1440×1000 桌面画面已目视；实现邀请参数清理、焦点改进与 favicon |
| 产品文档 1.3 | `product/README.md`、三份产品文档 | 同步自动保存、旧记录兼容、Map 往返和本轮 Live 细节；历史证据保留版本，材料引用交付清单 |
| 生产构建 | Vite 单文件产物 | `dist/index.html` 为 531,809 字节，gzip 约 274.51 KB；最后手机细节修正后重新构建 |
| 0.3.0 视频与封面 | `delivery/` | 视频 94 秒、1920×1080、30fps、16,162,634 字节；封面 434,694 字节。抽看时间点 00:12 的 Map、00:25 的 Space 画面及封面；未变镜头复用 0.2.0 真实截图，来源已记录 |
| 0.3.0 完整运行包 | `delivery/music-map-space-runtime.zip` | 286,796 字节，共 6 个文件：`dist/index.html`、`server/index.js`、`server/db.js`、`package.json`、`RUN-ME.md`、`THIRD_PARTY_NOTICES.md`；不含数据或凭据 |
| 0.3.0 应用源码同步 | 应用与产品文档 | 已推送提交 [41e8853](https://github.com/musicMapTeam/musicMap/commit/41e88534898729e60d565c5879af98ce9cddc271)；[CI run 36260026902](https://github.com/musicMapTeam/musicMap/actions/runs/36260026902) 成功，Ubuntu / Node24 构建、后端语法检查和两份 artifacts 上传均通过 |

## 0.3.0 增量检查与边界（2026-09-27）

- 提交 `41e8853` 的 Ubuntu / Node24 CI 已成功，构建、后端语法与两份产物上传均完成；后续材料提交不改变已检查应用源码。
- Map 实操覆盖第一跳、合作作品保存、进入 Space 和恢复林间 → 乔屿原路线；没有重新跑无关的挑战全流程。
- 390px 本地制卡与接受流程已操作，双方自动记录、相同卡对打开已有双联已确认；记录筛选及 1440×1000 桌面已目视。
- 手机两处小字和标题孤行在上述查看后修正，修正后仅重新构建，**没有再次目视查看**，不将旧截图写成最后修正后的视觉验收。
- 真实房间增量实操覆盖独立 localhost 朋友入场、私卡空态、保存后的展示选择，以及离开后刷新保留邀请码而不自动重入；没有重复整套真实交换检查。
- 后端本轮未改，沿用下方 0.2.0 权限、快照与持久化证据；没有重跑整套 API 检查，也没有新增自动测试框架或套件。
- 视频本轮抽看 00:12 的 Map 和 00:25 的 Space 画面以及封面；其他未变截图复用 0.2.0 并记录来源，不宣称所有镜头重新拍摄或全部重新检查。
- 未部署公网、未运行容器镜像、未验证实体双手机、未取得真实用户反馈；源码同步、CI 和外部部署分别记实。

## 历史证据 · 0.2.0

以下保留 0.2.0 的实现与检查记录，不作为 0.3.0 新增交互已验收的依据。

| 任务 | 负责人 / 文件 | 具体证据 |
| --- | --- | --- |
| MVP 技术栈 | 整合者：package、Vite、产品文档 | 前端 Vite + ES 模块；后端 Node.js 24 自带 SQLite，无运行时 npm 依赖 |
| 音乐节视觉 | Map / Space：CSS、JS、壳层 | 动态中文排版、光学关系图、现场海报、纸质联票；查看桌面 Map / Space / 双联与390px票根 |
| Map / 本地情景 | `map.js`、`space.js` | 当时生产页走过制卡→两卡确认→切接收者→接受→手动保存双联；这是 0.2.0 保存规则 |
| 真实交换后端 | `server/index.js`、`db.js` | 匿名令牌哈希、邀请码、房间权限、可见性、事务交换、快照与独立记录 |
| 真实房间前端 | `live.js`、`live.css` | 小满 / 阿遥两个独立浏览器存储会话同房、A私卡/B展示、申请、B独立接受、A同步成功、刷新重开 |
| 权限和快照 | 后端+整合 | 未入房C读房403；发送者A接受403；接收者B接受200；双方快照一致；改卡不改旧快照；删自己的记录不影响另一人 |
| PNG 票根 | `ticket-export.js`、Space / Live | 实际下载1600×1800 PNG约1.62MB，目视署名、照片、短句、歌名正确 |
| 加载优化 | WebP、space-data、provenance | 原始PNG保留；两张运行图共203,308字节，源图约3.96MB；构建只内嵌WebP |
| 实施与交付文档 | 三份产品文档、README、CONTRIBUTING | 两模式保存语义、Node/Docker、持久卷、数据不提交、官方来源档案 |
| 演示视频与参赛封面 | `delivery/` | 94.000秒、1920×1080、30fps、H.264、15,930,421字节；静音中文字幕，已查看八镜抽帧与转场；独立封面1920×1080 |
| 完整运行包 | `delivery/music-map-space-runtime.zip`、`RUN-ME.md` | 280,880字节；页面、后端与说明共6个文件，不含数据库、凭据、node_modules；Node24+直接运行 |
| 0.2.0 GitHub 源码同步 | 主干实现提交 `2f4c860` | 当时已推送 `origin/main`，对应构建结果见下方；不代表 0.3.0 已同步 |

### 0.2.0 必要检查（2026-09-27）

- 生产构建508,772字节（约509KB），gzip约269KB；源码语法检查通过，未增加自动测试框架。
- GitHub 实现提交 `2f4c860` 在 Ubuntu / Node24 构建成功，后端语法检查成功，两份构建产物上传成功：[run 36258164286](https://github.com/musicMapTeam/musicMap/actions/runs/36258164286)。该 CI 记录仅对应 0.2.0。
- 浏览器使用本机8787的生产构建；127.0.0.1与localhost存储相互独立，代表两个真实会话。
- 真实换卡完整路径，以及一条有限权限 / 快照请求检查；没有负载测试或全量分支矩阵。
- 修复手机联票标题横向溢出、已打开申请面板不随轮询更新、错误重绘丢昵称草稿。
- 查看1440×900 Map、Space、交换面板与390×844联网票根；截图和实际导出票根用于影片。手机Map点击乔屿后正确更换中心和作品。
- 服务进程重启后，原身份房间、两张卡与共同记忆仍能读回。手机邀请栏进一步修正为网格，经布局读取无横向溢出，图片已加载。
- 未运行容器镜像、未验证实体双手机、未取得外部用户反馈、未部署公网。不能把本机双会话写成已公开运营。

### 0.1.0 历史检查

0.1.0 于 2026-09-26 完成 Map 挑战步数 0→1→0、恢复漫游，本地双角色申请→接受→手动保存→刷新重开；通过 Windows 与 GitHub Node24 Linux 构建（run 36251532290）。0.3.0 没有重复跑无关的全套检查。

官方网页和六张赛题表留在`references/official/2026-09-26/`，原档未改。2026-09-27用户确定视觉优先，并授权持续完成MVP。构建、浏览器操作、GitHub同步和外部部署分别记实。
