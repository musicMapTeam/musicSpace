# Music Space · 0.22.0-rc.1 预发布

> ## 参赛演示：路线 B
>
> **同一晚，你拍了舞台，TA 拍了人海。**
>
> **AI 在本机给你一个视角建议，规则按拍摄时间帮你找到「同一刻的另一面」。**
>
> **双方同意才交换。**
>
> - **评审链接是什么。** <https://musicmapteam.github.io/musicSpace/> 的根路径，在「切换」之后是这个应用的静态示例站：事件房间页，加上在浏览器页面里运行的房间服务。**在切换之前，根路径仍是 0.16 页面**；测试用的预览副本放在 `/preview/`。现在走到哪一步，以[项目状态](docs/PROJECT_STATUS.md)为准。
> - **真的。** 房间规则（同一份房间服务代码，不是演示脚本）、照片拍摄时间的 EXIF 读取、「同一刻」（拍摄时间相差不超过 3 分钟）的规则判断、存在你浏览器里的数据，以及浏览器支持时在本机运行的 AI 视角建议。AI 只建议视角，选择由你；配对、分组、排序和理由是规则，不是 AI。
> - **模拟的。** 同场的人。阿遥·示例、小满·示例、北屿·示例、林间·示例是虚构角色，由页面里的程序通过和真人相同的接口自动回应，不是真人，也不学习；示例照片是仓库里两张 AI 生成图的裁切，场次、场地和歌曲都是虚构的。
> - **单设备。** 房间服务就在你的浏览器页面里运行（sql.js，即 SQLite 的 WebAssembly 版；照片放在 IndexedDB），没有服务器，什么都不会上传。换一台设备或另一个浏览器，看到的是各自独立的一份示例，不互通，也没有二维码、NFC 或邀请链接。这是单设备的模拟，不是跨设备的真实房间，也不是已上线的多人产品。
> - **没有验证过。** 真机（iPhone Safari、Android Chrome）、微信内置浏览器、大陆网络和真实用户都还没有验证；有了结果才写。
> - **Map 与旧首页在哪里。** 页内的「音乐探索」进入原版 Music Map，路径 `/musicSpace/music-map/`，带返回条回到房间。0.16 的旧首页在 `/musicSpace/classic/`，没有常驻入口，只在页面启动失败的提示里提供「打开早期原型」。独立的 Music Map（<https://musicmapteam.github.io/musicMap/>）和 `/musicSpace/avatar-preview/` 没有改动。
>
> 构建、预览与发布：`npm run build:pages`、`npm run preview:pages`、`npm run test:static`，详见 [scripts/pages/README.md](scripts/pages/README.md) 和[部署说明](docs/deployment.md)的「静态托管」一节。

以下各段是 0.21.0-rc.4 及更早各版的记录，保留原文；其中「旧 Pages 保持原样」「不修改网站部署」之类的话只在当时成立。

0.21.0-rc.4（上一版，历史记录）完成实际浏览器排版收尾：修复横屏房间／社群聊天及私聊输入区被裁、短屏标题与人数重叠、纸面状态低对比、Map 艺人名字拆行，以及实际 RC3 包检查发现的长标题加分享草稿挤掉输入框；加载文字和中断状态条也已修正。原版 Three.js Map、既有照片／好友／私聊权限保持不变。721 项测试、六个入口构建、精确提交 CI 通过；RC4 实际下载包 75 文件核验一致、42 步独立身份与权限／持久化闭环通过，另有当前构建小游戏 19 步。8791 已在验证备份后升级并正常重启，原业务记录及全部私人照片一致。见 [排版验收](docs/event/evidence/layout-ui-qa.md) 和 [RC4 预发布](https://github.com/musicMapTeam/musicSpace/releases/tag/v0.21.0-rc.4)。

上一轮把 Music Map 0.16.0 的完整原版三维页面接入 `/music-map/`，保留唱片桌、小院、翻片寻声和收藏。页面往返释放渲染器，Three 模块共享缓存；返回恢复现场机位、聊天室与未发送草稿。当前隔离实现已通过 721 条测试、三身份真实浏览器的 9 步分享与接龙草稿闭环、320×568 场景往返及无 WebGL 降级。[PR22](https://github.com/musicMapTeam/musicSpace/pull/22) 与短屏修复 [PR23](https://github.com/musicMapTeam/musicSpace/pull/23) 已经精确提交 CI、自审、合并和 [RC.2 预发布](https://github.com/musicMapTeam/musicSpace/releases/tag/v0.21.0-rc.2)；实际下载包 75 个运行文件核验一致，8791 在两库及私人照片备份核对后升级并正常重启，见 [本轮证据](docs/event/evidence/original-map-qa.md)。

本轮统一为暖纸、深绿、暖木的独立音乐编辑式画面：真实三维场馆保留体积、灯光与镜头，二维手绘小人贯穿聊天室、音乐互动和个人空间。聊天阅读与输入分区，设置收进「本场与管理」；音乐互动先呈现本轮选项，参与者和退出操作仍可展开访问。

上一轮历史交付 [0.20.0-rc.2](https://github.com/musicMapTeam/musicSpace/releases/tag/v0.20.0-rc.2)：[PR19](https://github.com/musicMapTeam/musicSpace/pull/19) 与实包短屏修正 [PR20](https://github.com/musicMapTeam/musicSpace/pull/20) 合并，717 项适用测试、五项构建、AI／角色检查和精确提交 CI 通过。官方工作流产物经 Library 正规传输下载，其中运行压缩包与 Release SHA-256 一致，72 个运行文件逐项匹配；最终实包七条独立合成身份旅程共 120 步通过，包含实际 WebGL、PNG、320×568、断网、多标签、撤权和正常重启。现有本地预览已在两库及 16 个私人照片对象备份核对后恢复并正常重启，原业务记录和照片字节保持一致；环境恢复时旧进程已不存在，没有据此停止其他版本。过期速率窗口按既有逻辑清理。详见[本轮验收](docs/event/evidence/editorial-map-qa.md)。

应用内 Music Map 复用独立 Map 的 29 位真实音乐人、37 条演唱录音关系及原始来源，支持节点选择、关系详情、全图、目录内最短关系链和手机拖动/缩放。打开公共音乐目录无需创建身份；从聊天室进入后，可以准备音乐发现或接龙起点，仍需本人明确确认才发布。没有新增音频、外部素材或音乐服务，独立 Map 与旧 Pages 保持原样。当前检查与交付状态见[项目状态](docs/PROJECT_STATUS.md)。

2026-10-03 第三阶段：成员音乐话题可发布、署名、撤回并明确带回讨论；Worldcup 支持四个自填文字选项、真实票数、明确平票理由、历史结果与讨论。新增自愿「音乐默契局」和轮流「关系接龙」：至少两人明确参加，选择揭晓前保密，接龙区分已核实共同音乐人与成员自述。没有评分、自动好友或自动邀请；退出清理未公开答案，拉黑及解除不恢复旧参与资格，归档暂停新操作。


2026-10-03 第二阶段：长期社群增加空间介绍、开放／归档与活动预告。主办方明确发布预告、单独开现场、再明确关联邀请码；成员只预览元数据，入场及照片权限仍独立。归档保留历史阅读，阻止新的加入、发言、活动、招呼与投票，提交时核对空间版本。恢复开放和成员资格不代替本人同意。

围绕音乐现场的社交应用：观众带着可组合的二维手绘小人进入真实三维场馆，记录照片、自愿打招呼，双向同意后交换照片、成为朋友和私聊，散场后留下个人回顾。

新一轮完整旅程先交付「我的空间」：常驻回访入口汇聚本人小人、音乐社群、现场回顾、好友私聊、共同记忆与身份恢复，不要求先进入某场现场。主办方长期空间管理、持续音乐主题与小游戏已按[三阶段清单](docs/event/PRODUCT-COMPLETION.md)实施。

## 已实现的产品体验

- 明确入场和参与意愿，小人、场景、照片墙、聊天及回顾共用纸签与夜场视觉语言。
- 私藏、房内展示与定向交换分别授权；撤回、删除、移除和屏蔽按既有权限执行。
- 个人纪念卡由本人明确选择合法的本人照片、署名及小人，生成实际 PNG 预览后主动下载。
- 长期音乐社群、散场聊天室、带出处的音乐卡和原始关系图、明确虚构的四专辑世界杯分别经独立 PR 实现。Music Map 保持独立。
- 链接、二维码、NDEF 和原生 GATT 适配源码共用无身份凭据的邀请网址，先预览、再本人明确加入。原生适配器未编译、签名或通过设备验收。
- 双人创作角：双向朋友各自明确参与，选择本人已保存的小人、留言及本人照片。编辑保留本地草稿、检测版本冲突并撤回旧确认；双方确认同一版本后分别保存，另行选择生成署名 PNG。素材变化、关系失效或任一方撤销后，共同内容不能继续读取或导出。

最终交付 0.19.0-rc.4：全量 715 项适用测试、五项构建、AI 文件／角色结构与精确提交 CI 通过。官方产物下载的运行压缩包与 GitHub Release 公布的 SHA-256 完全一致，71 个运行文件与已验收构建逐项一致；实包六条独立身份浏览器旅程共 107 步通过（32／16／15／19／15／10），包含实际 PNG、短屏、减少动态、断网、原请求、多标签、撤回和正常重启。既有本地服务已在两库及私人照片备份逐项验证后更新并正常重启，原业务记录、身份与私人照片字节保留；过期速率窗口按既有逻辑清理，未将它写成用户数据丢失。旧版本、Pages 和 Music Map 保持原样。 真实手机、真实观众研究、BLE／NFC 设备与原生编译签名待外部验收。

## 开发与运行

需要 Node 24+。`npm ci`、`npm run build:all`、`npm run test:release`、`npm run start:local`。服务提供同源页面及 API，持久存储按[部署说明](docs/deployment.md)配置；`runtime-preview/src` 和 drizzle 是共享实现，发行包不能省略。

静态示例站（GitHub Pages）另有三条命令：`npm run build:pages` 生成 `dist-pages/`；`npm run preview:pages` 在 `http://127.0.0.1:4783/musicSpace/` 本地预览，和 github.io 一样，前缀之外一律 404；`npm run test:static` 跑静态运行时的测试，并在 sql.js 上重跑房间服务的测试套件。

- [阶段清单](docs/event/COMMUNITY_ROADMAP.md) · [当前状态](docs/PROJECT_STATUS.md)
- [静态站的构建、校验与发布](scripts/pages/README.md) · [部署说明：静态托管](docs/deployment.md) · [0.22.0-rc.1 发布说明](docs/release/0.22.0-rc.1.md)
- [共同创作规则与验收](docs/event/evidence/corner-qa.md)
- [统一入场协议与原生边界](docs/event/ADMISSION-PROTOCOL.md)
- [产品计划](product/docs/01-product-plan.md) · [交付计划](product/docs/02-delivery-plan.md) · [实施说明](product/docs/03-build-guide.md)
- [第三方许可](THIRD_PARTY_NOTICES.md)

本轮（0.22.0-rc.1）不修改独立的 Music Map 仓库和页面，不触碰 `/musicSpace/avatar-preview/`，不新增账号、主机、凭据或付费服务。网站部署只走 `scripts/pages/` 的流程：先发到 `/preview/`，经用户明确同意后一次性切换到根路径，之后冻结（见[部署说明](docs/deployment.md)）。新增的依赖只有 devDependency `sql.js` 1.14.2（MIT，见[第三方许可](THIRD_PARTY_NOTICES.md)）；示例照片是仓库里两张 AI 生成图的裁切，没有新的外部素材。
