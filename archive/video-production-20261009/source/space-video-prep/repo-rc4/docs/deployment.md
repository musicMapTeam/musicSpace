# 场次房间的持久部署

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

原发行包的最小功能条件是 Node 24+（或支持 Docker）、一个持续运行的单节点实例、可写且重启不丢失的私有 DATA_DIR、同源 HTTPS 反向代理与正常停启权限。磁盘至少容纳当前数据、备份及新恢复副本；如果都在同一磁盘，约需三份数据空间，另留增长与运行包空间。CPU/内存容量未做生产负载验收，不能将本地测试数量当作并发能力。

上线前需要用户决定：使用已有符合条件的服务器，或授权在现有 Sites 上新增独立场次入口并配置/复核 D1/R2；本轮未购买资源、未新增 OAuth/凭据、未改网络安全或任何在线服务。真机/微信、大陆网络和生产负载仍需外部设备与真实部署条件，手机模拟不算真机验收。
