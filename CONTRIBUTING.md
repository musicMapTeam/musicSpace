# 协作指南

这是一个两人推进的比赛项目（Music Space，MVP 0.16.0）。以当前产品方案和可操作的演示为中心，不引入额外审批或复杂分支流程。仓库内更具体的约定见 [AGENTS.md](AGENTS.md)。

## 本地开发

使用 Node.js 24（见 `.nvmrc`；应用最低要求 `>=24.0.0`，后端使用内置 SQLite）。按锁文件安装后运行：

```sh
npm ci
npm run dev
```

开发真实房间时，在另一个终端运行 `npm run server`（`node --watch server/index.js`）；Vite 把 `/api/live` 代理到 `127.0.0.1:8787`，服务器默认只监听本机。只有开发服务器会去问本机有没有房间服务；`npm run preview` 和任何静态托管都是静态版，不发探测请求。

| 命令 | 做什么 |
| --- | --- |
| `npm run build` | 生成 `dist/`：`index.html`（脚本与样式内联，约 1.7 MB）加 `ai/`（端侧模型与运行时，约 23 MB，原样复制、不内联）。构建前自动运行 `ai:ort` |
| `npm run preview` | 预览 `dist/`，只是静态版（不代理 `/api/live`） |
| `npm start` | 房间版：同一个 Node 服务提供 `dist/`（含 `ai/`）与 `/api/live`。要先 `npm run build`；支持 `HOST`、`PORT`、`DATA_DIR` |
| `npm test` | 三份检查，只用 Node 自带的 `node:assert`：`scripts/test/moment.test.mjs`（「同一刻」规则、配对、歌单、票根事实）、`insight.test.mjs`（AI 文案与状态、拍摄时间提示）、`api.test.mjs`（房间卡片接口：在空闲端口上用临时数据目录启动 `server/index.js`） |
| `npm run ai:ort` | 把 onnxruntime-web 1.30.0 的三个运行时文件从 `node_modules` 复制到 `web/public/ai/ort/`（不入 Git；版本或哈希不对就拒绝）。`npm run dev` 与 `npm run build` 会先运行它 |
| `npm run ai:check` | 检查 `dist/ai/`：模型与 `.wasm` 的大小和 `labels.json` 一致，`ort/` 里恰好三个运行时文件，两份许可文本在，`index.html` 小于 5 MB。CI 会跑 |

构建工具固定为 Vite `8.3.1` 与 `vite-plugin-singlefile` `2.3.3`：只内联脚本与样式，`web/public/` 原样复制进 `dist/`，所以静态部署的单位是整个 `dist/`（`index.html` 加 `ai/`）。构建成功只说明产物生成；正式部署与在线可访问性需要分别记录证据。`dist/` 与 `web/public/ai/ort/` 是本地产物，不提交 Git。后端代码在 `server/`，本地数据库在忽略的 `data/`；不能把数据库或临时会话令牌放入 Git。容器构建见 `Dockerfile`（要复制 `scripts/`，因为构建前会运行 `ai:ort`）。

CI（`.github/workflows/build.yml`）依次运行：`npm ci`、`npm run build`、`npm run ai:check`、`node --check server/index.js` 与 `server/db.js`、`npm test`，再上传两份产物：`music-space-demo`（整个 `dist/`）与 `music-space-runtime`（`dist/`、`server/`、`package.json` 与三份说明）。

## 端侧模型（`scripts/ai/`）

`web/public/ai/tc8/`（`vision.onnx`、`labels.json`）已入 Git。`scripts/ai/` 记录它的来源（固定提交与 SHA-256）并能复现：`fetch-source.mjs`、`extract_tinyclip.py`、`text_embed.mjs`、`build-labels.mjs`。这些是开发工具，不在应用或 `npm run build` 里运行；需要 Python 与 `scripts/ai/` 自己的 `npm ci`，步骤见 [scripts/ai/README.md](scripts/ai/README.md)。

- 只想确认已提交的两份文件没被改坏：在仓库根目录 `npm ci` 一次，再运行 `node scripts/ai/build-labels.mjs --check`（不改任何文件，逐字节一致才返回 0）。
- 换模型、提示词或运行时：重跑对应步骤，提交新文件，更新该 README 里的哈希和 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)，并改 `web/js/ai/space-ai.js` 的 `CACHE_NAME`，回访者才不会留着旧文件。改「有把握」的门槛（`SURE_MARGIN`、`SURE_PROB`）要在照片上重新量，见 AGENTS.md。

## 一次改动怎么做

1. 在 [项目状态](docs/PROJECT_STATUS.md) 找到或添加一个小任务，写清负责人和文件范围，放到 Doing。
2. 在 `web/js/`、`web/css/`、`web/assets/` 中完成对应改动。共享入口由当前负责整合的人处理，避免同时覆盖同一文件。
3. 普通功能完成后构建，并检查直接受影响的操作路径；改「同一刻」规则或房间接口时再跑 `npm test`。只记录真正执行的步骤，不要每次重跑所有页面或新增测试框架。纯文档修改检查内容及链接即可。
4. 补齐来源与状态，将任务移到 Done 并附上证据；若仍有问题，保留 Doing 或拆出明确的 Todo。
5. 检查将要提交的文件，以一个小提交说明一个目的。需要 PR 时使用仓库模板；同伴可直接从改动说明和证据接手。

## 哪些文档随改动更新

| 改动 | 同步位置 |
| --- | --- |
| 产品定位、交换规则、范围或交付方式 | [产品方案](product/docs/01-product-plan.md)、[交付计划](product/docs/02-delivery-plan.md)、[实施规格](product/docs/03-build-guide.md)，保持三者一致 |
| 能力实现、已知限制、运行方式 | `README.md`、`RUN-ME.md`、`docs/PROJECT_STATUS.md` |
| 拍摄时间、配对、歌单、AI 或存储规则 | `AGENTS.md` 对应条目；规则代码在 `web/js/moment.js`，改动要连同 `scripts/test/` 里的检查一起改 |
| 端侧模型、提示词、运行时 | `scripts/ai/README.md`（哈希）、`THIRD_PARTY_NOTICES.md`、`CACHE_NAME` |
| 新引入的开源代码、图标或图片 | `THIRD_PARTY_NOTICES.md` 及相应许可证 / 来源记录 |
| 一个版本的变更说明 | `CHANGELOG.md` 只在最上面加新条目，旧条目保留原文；要说明旧内容已过时，另加标注，不改原文 |
| 官方材料或旧设计参考 | 按来源留档到 `references/`；不要改写原文或替代当前产品文档 |

## 提交约定

- `feat: 完成现场卡交换申请`：新增能力。
- `fix: 修正拒绝后的交换状态`：修复已有行为。
- `docs: 更新演示范围与完成证据`：文档与资料。
- `build: 调整构建配置`：依赖和构建。

不提交用户上传照片、`.env`、凭据、`node_modules/`、`dist/`；预置示例图片需有来源。不要把旧 `product/prototype/` 整包复制进新版来宣称迁移完成。

推送以用户当轮明确要求为准；本轮已经授权时直接按授权完成，不另加重复确认。未部署、未验证、只有单浏览器模拟的能力都应照实说明。
