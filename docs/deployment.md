# 场次房间的持久部署

本文前面各节讲 Node 发行包的部署与备份；最后一节「静态托管：GitHub Pages 示例站」讲不需要服务器的静态版（路线 B）。

## 发布完成 · 2026-10-02

[PR #3](https://github.com/musicMapTeam/musicSpace/pull/3) 已于 00:10:44 UTC 合并，发行源码提交 `217f14424253b8e6adf6781f40bdce9d33da3663`。[main CI](https://github.com/musicMapTeam/musicSpace/actions/runs/36944672561) 的全入口构建、AI 检查、旧功能测试、621 项完整测试、角色几何检查、运行包、Docker 构建与发行步骤通过。

[0.17.0-rc.1 Release](https://github.com/musicMapTeam/musicSpace/releases/tag/v0.17.0-rc.1) 于 00:12:15 UTC 发布，明确标注为预发布，标签指向上述提交。资产包括运行包与 SHA256SUMS.txt；运行包 12,960,122 字节、43 个文件，SHA256 `3751e97d87ce7408115433bab48759feb7e6de73213ca6f7cea86f1f96c3d24b`，manifest 绑定发行源码提交。没有新建公网服务，旧 gh-pages 保持原样；这不代表生产上线。

源码集成与 CI 记录：[PR #3](https://github.com/musicMapTeam/musicSpace/pull/3)。发行资产和最终发行状态以 [0.17.0-rc.1 预发布](https://github.com/musicMapTeam/musicSpace/releases/tag/v0.17.0-rc.1) 为准；这里的预发布不表示生产上线，旧 GitHub Pages 保持原样。

0.17.0-rc.1 是预发布，没有新建公网服务。旧 GitHub Pages 只承载静态演示。支持 Node 24+ 同源服务与单节点 SQLite；runtime-preview/src 是共享处理器，并不是已部署的云项目。

从预发布页面下载运行包与 SHA256SUMS.txt，先校验归档哈希再解包。运行包不含用户数据；解包目录中的 manifest.json 记录对应源码提交与文件哈希。

源码先运行 `npm ci`、`npm run build:all`；运行包直接 `node server/index.js`，不需要安装依赖。必须同时保留 dist/、server/、runtime-preview/src/、runtime-preview/drizzle/ 和 package.json。

```sh
HOST=127.0.0.1 PORT=8787 DATA_DIR=/absolute/private/musicspace-data node server/index.js
```

PowerShell：

```powershell
$env:HOST='127.0.0.1'
$env:PORT='8787'
$env:DATA_DIR='C:\private\musicspace-data'
node server/index.js
```

入口 http://127.0.0.1:8787/event-room/ ，健康接口 /api/event/health 。默认只监听本机；端口冲突改用空闲端口，不停止其他服务。使用现有进程管理器保持运行，正常停止用 SIGTERM/Ctrl+C。

已有 Docker 环境可以在源码目录执行 `docker compose up -d --build`。compose 端口只绑定本机，musicspace-data 命名卷保存数据，容器非 root 运行。不要执行 `docker compose down -v`。本次未安装或启动用户 Docker。

## 公网条件

需要经授权的服务器/容器平台、持久卷、HTTPS 域名/证书与同源反向代理。代理保留 /api/ 与 /event-room/ 完整路径、鉴权头及上传请求体；允许约 1 MB 请求体，不缓存私有 API 响应。服务保持 loopback，照片不能另行公开。SQLite 单节点，不支持多个服务副本共享数据库。

新账号、域名、凭据、付费服务尚未申请。GitHub Actions 内置 GITHUB_TOKEN 只用于授权的预发布，无新用户凭据。未修改 gh-pages 或 Music Map。Cloudflare D1/R2 尚需绑定、迁移与端到端验收，不是本次已部署路径。

## 数据、备份与升级

DATA_DIR 包含 `music-map.sqlite` 和 `avatar-space.sqlite`。当前 Node 实现把原图、交换预览及旧现场照片存为 SQLite BLOB；不存在要另行公开的照片目录。人物、房间、聊天、交换、撤销/拉黑/成员排除、幂等回执与持久签名密钥必须一起保留。目录及备份都必须私有，不能放入源码、静态托管或公开云盘。

仓库提供 `scripts/ops/data-backup.mjs`（Node 24+，无 npm 依赖）。工具是后续运维补充，**不包含在已冻结的 0.17.0-rc.1 运行包中**；请从包含该文件的官方源码提交运行它，不修改已有 Release 资产。

### 停服备份

先通过现有服务管理器正常停止**所有**共享 DATA_DIR 的进程，并确认退出。Docker 使用 `docker compose stop`，不要删除卷。工具不会停止进程，也不能仅凭文件检查证明服务器已停；`--service-stopped` 表示操作者已确认停服。发现 WAL、SHM 或 rollback journal 会拒绝备份；若异常退出遗留 journal，先用原服务完成恢复并正常退出，不要手工删 journal。

```sh
node scripts/ops/data-backup.mjs backup --data-dir /srv/musicspace-data --output /private/backups/musicspace-2026-10-02 --service-stopped
```

PowerShell 同样使用参数，路径带空格时加引号：

```powershell
node scripts/ops/data-backup.mjs backup --data-dir 'C:\private\musicspace-data' --output 'C:\private\backups\musicspace-2026-10-02' --service-stopped
```

输出父目录必须事先存在，输出目录必须是新目录，且与 DATA_DIR 互不嵌套。工具分块复制全部常规文件，包括可能的私有照片附属文件；拒绝符号链接，核验两个 SQLite 的 integrity/foreign-key 检查、签名密钥存在性、照片与活跃交换预览引用，再比对备份前后源数据及每个副本的 SHA256。只在全部检查通过后写入 `.musicspace-backup.json` 完成标记。缺少该标记的目录不是可恢复备份。Windows 必须使用已有受控 ACL 的目录；Unix 文件/新目录权限分别为 0600/0700。

备份目录含能够恢复身份的服务端密钥与私人照片。应使用既有受控备份存储及访问权限。SHA256 检测损坏，不证明备份来源可信，也不加密内容。不要把清单或日志当作公开附件。

### 恢复到新目录并验证

先正常停服，保留原 DATA_DIR 和原运行包。**恢复目标必须不存在**，不能直接覆盖原数据：

```sh
node scripts/ops/data-backup.mjs restore --input /private/backups/musicspace-2026-10-02 --data-dir /srv/musicspace-restored-2026-10-02 --service-stopped
```

工具先验证清单、路径与全部文件哈希，再复制到独占的新目录，检查 SQLite/照片引用及最终哈希。损坏文件、路径穿越、额外文件或已有目标都会失败；失败只清理本次新建的目标，不修改备份或原 DATA_DIR。突发断电可能留下未完成的新目录，改用另一个新目标即可，原目录仍保留。

通过后，在现有管理器中把 DATA_DIR 指向恢复目录，以**同一发行版本、同一浏览器来源**启动。检查 `/api/event/health`，使用原浏览器身份确认房间、照片和明确同意的交换可读，撤销、拉黑、成员排除仍生效；不得把未授权照片变成公开静态资源。如果启动/验收失败，停止新实例，将 DATA_DIR 指回未被覆盖的原目录，使用原运行包恢复。不要并行运行两个共享 SQLite 目录的实例。

自动验证已用隔离合成数据执行真实 CLI 备份/恢复及 Node HTTP API 复验，覆盖照片字节、原身份/签名回执、房间、联系人、私聊、接受/撤销交换、拉黑和成员排除；详见 [备份恢复验证记录](ops/backup-restore-qa.md)。这不等于在用户真实服务器完成灾难演练。

升级前保留旧运行包与完整备份。加法迁移不保证任意版本回滚；回滚应恢复升级前运行包与对应备份到新目录。换域名、清浏览器存储或丢失身份凭证不会因数据库恢复而自动找回身份。

## 当前可用托管与最小上线条件

2026-10-02 只读核查：现有 GitHub Pages 仍为静态展示；现有 Music Space Avatar Studio 的 Sites 项目为 active，公开版本为 v4，本轮未改动它。未发现已授权、可直接运行此 Node 发行包的远端服务器或持久磁盘。

| 路径 | 能否直接运行当前发行包 | 持久化与下一步 |
| --- | --- | --- |
| 旧 GitHub Pages | 不能；[官方说明为静态托管](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages) | 无 Node 服务或 SQLite 数据磁盘，保持现有演示 |
| 现有 Sites / Cloudflare Workers | 不能直接运行 Node + 本地 SQLite 发行包 | 支持 Worker + D1/R2；[Workers 文件系统为内存且临时文件逐请求销毁](https://developers.cloudflare.com/workers/runtime-apis/nodejs/fs/)。需授权新的场次入口、核验现有 DB/PHOTOS 绑定、逐条迁移与端到端验证；此工具只适用于 Node 磁盘数据，不替代 D1/R2 备份 |
| 已有 Node/Docker 服务器 | 可以在具备条件后使用 | 用户需指明平台/主机、经授权的部署方式、私有持久目录或卷、HTTPS 同源入口与现有备份位置；不应在聊天中粘贴密码或新建凭据 |

2026-10-05 补充：上表「旧 GitHub Pages」一行是 2026-10-02 的核查结果。其中「不能运行这个 Node 发行包」仍然成立；「保持现有演示」只到路线 B 的切换之前成立。路线 B 之后，Pages 另外承载一个静态示例站（见下一节）：房间服务在访问者的浏览器里运行，没有服务器端数据，也没有真正的跨设备房间。

原发行包的最小功能条件是 Node 24+（或支持 Docker）、一个持续运行的单节点实例、可写且重启不丢失的私有 DATA_DIR、同源 HTTPS 反向代理与正常停启权限。磁盘至少容纳当前数据、备份及新恢复副本；如果都在同一磁盘，约需三份数据空间，另留增长与运行包空间。CPU/内存容量未做生产负载验收，不能将本地测试数量当作并发能力。

上线前需要用户决定：使用已有符合条件的服务器，或授权在现有 Sites 上新增独立场次入口并配置/复核 D1/R2；本轮未购买资源、未新增 OAuth/凭据、未改网络安全或任何在线服务。真机/微信、大陆网络和生产负载仍需外部设备与真实部署条件，手机模拟不算真机验收。

## 静态托管：GitHub Pages 示例站（路线 B，2026-10-05 起）

这一节讲的是静态站，也就是源码里 `npm run build:pages` 的产物，不是上面的 Node 发行包，两者互不代替。运行包不含 `scripts/pages/`，下面的命令在源码仓库里执行。路线 B 要让评委只用一个链接、一个人就走完整个流程，而 Pages 不能运行 Node 服务，所以房间服务搬进了浏览器页面里。

### 它是什么，不是什么

- 页面里运行的是同一份房间服务代码（`runtime-preview/src/event-worker.js` 与 `avatar-worker.js`，一行没改）：页面替换全局 `fetch`，把发往 `/api/event`、`/api/avatar` 的请求交给页面内的运行时。数据库是 sql.js（SQLite 的 WebAssembly 版），照片存在 IndexedDB。其他网址（模型、wasm、图片）走原生 `fetch`，都是同源文件，不访问第三方。
- **没有服务器端接口。** Pages 上 `/api/event/health` 是 404，这是预期；页面发出的请求里没有 `/api`。不要把它当成「部署了房间服务」：没有账号，没有服务端数据，没有跨设备的房间。
- 同场的人是编出来的角色（0.22.0-rc.2 起界面上不再标「·示例」，只在「关于 Music Space」里用一句话说明），由页面里的程序用普通的带令牌请求自动回应；没有二维码、NFC 或邀请链接。这是单设备的浏览器内模拟，不是已上线的多人产品。真机、微信和大陆网络尚未验证，没有用户的报告就不写成通过。
- 浏览器里的数据是一次性的：快照读不出、迁移或示例世界的版本变了、播种失败，页面清掉示例数据后重来一次；第二个标签页只读，不写数据。

### 站点树与子路径

站点在 `https://musicmapteam.github.io/musicSpace/`（子路径 `/musicSpace/`），测试用的预览在 `/musicSpace/preview/`。`npm run build:pages` 生成 `dist-pages/`（Git 忽略，不提交）：

| 路径 | 内容 |
| --- | --- |
| `index.html` | 事件房间页（静态版，脚本与样式内联，约 2.2 MB），作为站点根 |
| `music-map/` | 音乐探索（原版 Music Map 的页面，0.22.0-rc.2 起是手绘涂鸦风），链接相对站点根，带返回条；字体链接站点根的 `fonts/doodle/` |
| `classic/` | 0.16 的旧首页，界面上没有入口（0.22.0-rc.2 起页面启动失败的救援提示也不再链到它）；它的模型文件指向共享的 `ai/` |
| `ai/` | 端侧模型与 onnxruntime-web 文件，整个站点一份（约 23 MB，传输约 10 MB） |
| `shared/three-0.186.1/` | 房间页与 Map 共用的 three.js 模块 |
| `fonts/doodle/` | Doodle 字体切片、`fonts.css` 和许可文本 `LICENSES.txt`，房间页和音乐探索共用 |
| `sql/` | sql.js 的 `sql-wasm.wasm` 和许可文本，从本站同源取 |
| `demo/` | 六张示例照片和 `manifest.json` |
| `build.json` | `{version, commit, builtAt, files: [{path, bytes, sha256}]}`，这份字节的身份；没有渠道字段 |
| `.nojekyll` | 让 Pages 原样提供文件 |

`/musicSpace/avatar-preview/`（指向第三方托管的 Avatar Studio 的跳转页）不属于这棵树，不改、不删，发布工具也拒绝改动它。所有链接都是页面相对的，不写根绝对网址：`web/shared/site-base.js` 读取 `space-site-root` 等 meta，没有这些 meta 时（Node 服务）行为不变。本地用 `npm run preview:pages` 在 `http://127.0.0.1:4783/musicSpace/` 预览，和 github.io 一样，前缀之外一律 404。

### 同源共享与浏览器存储

`musicmapteam.github.io` 是一个源：`/musicSpace/`、`/musicSpace/preview/`、`/musicSpace/classic/`、`/musicSpace/music-map/`、独立 Map 的 `/musicMap/` 和 `/musicSpace/avatar-preview/` 共享 `localStorage` 与 Cache Storage，不按路径隔离。

- IndexedDB 按渠道分库：`music-space-static:pages:v1`（根）和 `music-space-static:preview:v1`（预览）。渠道由页面网址在运行时判断，路径以 `/preview/` 结尾是预览，其余是根。
- `localStorage` 的键分两类，列表写在 `web/static-runtime/storage-guard.js`，救援提示里内联了同一份，`tests/static-prefix-sync.test.js` 保证两份相等：
  - **清除**（事件房间客户端的身份、草稿、待发操作和路线卡，随示例数据一起清）：`music-space-avatar`、`music-space-event-`、`music-space-worldcup-`、`music-space-topic-`、`music-space-organization`、`music-space-game-`、`music-space-corner-`、`music-space-community-`、`music-space-tour:`。
  - **保留**（其他页面的数据，永不触碰）：`music-space-map-*`、`music-space:v1`、`music-space-live:v1`、`music-space-duet-seen:v1`、`music-map-*`；Cache Storage 的 `music-space-ai-v1`（模型与 wasm，所有页面共享）也从不清除。
- 根和预览共用这些 `localStorage` 键：在两者之间切换时，浏览器里不属于当前数据库的身份会被清掉重来，访问者得到一个新的示例身份。这是接受的代价，预览在切换时就删除了。

### 预览、切换、冻结

根和预览是**同一份字节**，构建里没有渠道开关，所以切换不重新构建，而是把测过的预览树复制到根：

1. 最终 PR 合并到 `main`，CI 在这个提交上通过；从 `main` 构建：`npm run build:pages`。
2. 发布预览，只改 `preview/`：`node scripts/pages/publish.mjs --channel preview` 是 dry run，读差异统计，确认后加 `--push`。再校验：`node scripts/pages/verify-tree.mjs https://musicmapteam.github.io/musicSpace/preview/`。Pages 推送后有延迟，响应带 `max-age=600`，所以它会轮询到部署生效，并打印 `index.html` 与 `build.json` 的 sha256，把它们记进证据文档。
3. 真机检查在预览上做。预览测过之后只要有改动，先重发预览、重跑冒烟。
4. **只在用户明确同意之后**切换：`node scripts/pages/publish.mjs --channel pages --from-preview` 是 dry run，确认后加 `--push`。它把预览树原样复制到根，保留 `avatar-preview/`，并在同一个提交里删除 `preview/`。发布前先校验这棵树；发布后用 `node scripts/pages/verify-tree.mjs https://musicmapteam.github.io/musicSpace/ --index-sha256 <预览时记录的值>` 核对线上字节，并确认 `/api/event/health` 是 404。
5. 切换之后冻结，直到评审结束，只做用户批准的热修。

发布工具在 `origin/gh-pages` 的临时 worktree 里工作，不动当前工作区；它从不 force push，不是快进的推送会被拒绝。没有 CI 部署步骤：CI 只构建并上传产物 `music-space-pages`，发布是手动的。更新 `gh-pages` 属于 `AGENTS.md` 里记录的长期授权（做完告知用户），但那一次切换要用户明确同意。

### 回滚

回滚是一个**新提交**，还原 `192ad9e`（0.16 的根页面，含 `avatar-preview/`）的树，不改写历史：

```sh
git fetch origin gh-pages
git worktree add --detach /tmp/pages-rollback origin/gh-pages
cd /tmp/pages-rollback
git read-tree -u --reset 192ad9e                 # 索引和文件变成恰好这一棵树，不在其中的文件被移除
git commit -m "pages: rollback to 192ad9e"
git rev-parse 'HEAD^{tree}' '192ad9e^{tree}'     # 两个哈希必须相同
git push origin HEAD:gh-pages                    # 普通的快进推送，不 force
cd - && git worktree remove --force /tmp/pages-rollback
```

回滚本身就是第二次切换，要用户决定。Pages 的缓存最长十分钟；访问过新根的浏览器里还留着 IndexedDB 数据，旧页面不会读它。

### 校验

- `node scripts/pages/verify-tree.mjs dist-pages` 检查本地的树；`npm run test:static` 跑静态运行时的测试和构建检查。
- 带 `--same-as <目录或网址>` 可以要求两棵树的 `index.html` 逐字节相同（预览对根）。
- 工具与选项的完整说明在源码里的 `scripts/pages/README.md`。
