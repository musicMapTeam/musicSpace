# Music Space · 0.18.0-rc.5 候选

围绕音乐现场的社交应用：观众带着可组合的二维手绘小人进入真实三维场馆，记录照片、自愿打招呼，双向同意后交换照片、成为朋友和私聊，散场后留下个人回顾。

## 已实现的产品体验

- 明确入场和参与意愿，小人、场景、照片墙、聊天及回顾共用纸签与夜场视觉语言。
- 私藏、房内展示与定向交换分别授权；撤回、删除、移除和屏蔽按既有权限执行。
- 个人纪念卡由本人明确选择合法的本人照片、署名及小人，生成实际 PNG 预览后主动下载。
- 长期音乐社群、散场聊天室、带出处的音乐卡和原始关系图、明确虚构的四专辑世界杯分别经独立 PR 实现。Music Map 保持独立。
- 链接、二维码、NDEF 和原生 GATT 适配源码共用无身份凭据的邀请网址，先预览、再本人明确加入。原生适配器未编译、签名或通过设备验收。
- 双人创作角：双向朋友各自明确参与，选择本人已保存的小人、留言及本人照片。编辑保留本地草稿、检测版本冲突并撤回旧确认；双方确认同一版本后分别保存，另行选择生成署名 PNG。素材变化、关系失效或任一方撤销后，共同内容不能继续读取或导出。

候选全量 699 项测试、15 步双身份浏览器闭环和五项构建通过，含短屏、重启、断网重试、私藏素材及实际 PNG。最终发行状态以当前 PR、CI 和 Release 为准；预发布不代表正式生产上线。真实手机、真实观众与 BLE/NFC 设备验收仍待完成。

## 开发与运行

需要 Node 24+。`npm ci`、`npm run build:all`、`npm run test:release`、`npm run start:local`。服务提供同源页面及 API，持久存储按[部署说明](docs/deployment.md)配置；`runtime-preview/src` 和 drizzle 是共享实现，发行包不能省略。

- [阶段清单](docs/event/COMMUNITY_ROADMAP.md) · [当前状态](docs/PROJECT_STATUS.md)
- [共同创作规则与验收](docs/event/evidence/corner-qa.md) · [预发布候选说明](docs/release/0.18.0-rc.5.md)
- [统一入场协议与原生边界](docs/event/ADMISSION-PROTOCOL.md)
- [产品计划](product/docs/01-product-plan.md) · [交付计划](product/docs/02-delivery-plan.md) · [实施说明](product/docs/03-build-guide.md)
- [第三方许可](THIRD_PARTY_NOTICES.md)

本轮不修改 Music Map、旧公开演示或网站部署，不引入新外部素材、服务或凭据。
