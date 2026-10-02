# 场次房间的持久部署

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

DATA_DIR 包含 music-map.sqlite 与 avatar-space.sqlite（人物、房间、聊天、交换、照片 BLOB、幂等记录及持久签名密钥），运行期间还有 WAL/SHM。目录必须在持久磁盘且不公开、不提交源码。运行包不含用户数据。

备份时先正常停止服务、确认进程退出，再复制**完整 DATA_DIR**到受控位置，随后启动。不要在写入期间只复制单个 sqlite。恢复先停止服务，再恢复整个目录，检查运行用户读写权限，启动并验证健康接口及原身份读取。容器先 `docker compose stop`，通过现有受控卷备份流程复制整个卷。尚未执行真实服务器备份恢复。

升级前保留旧运行包和完整数据备份。加法迁移不等于任意版本可回滚；回滚应停止服务并恢复升级前运行包和数据。保持原浏览器来源，身份凭证存在该来源存储；换域名/清存储不会自动恢复。身份备份不是账户密码找回，泄露凭证等同泄露身份。

未测手机/微信、大陆网络、生产负载、留存政策、全量身份恢复与实际云部署，详见 [有限检查记录](release/0.17.0-rc.1.md)。
