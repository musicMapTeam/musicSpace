# Music Space · 0.18.0-rc.4 候选

围绕音乐现场的社交创作应用：观众带着可组合的二维手绘小人进入真实三维场馆，记录自己的照片，按参与意愿打招呼，经双方同意交换照片、成为朋友和私聊，散场后保留个人回顾。

## 已完成的产品能力

- 明确入场、安静或愿意打招呼；小人、作者、照片墙和聊天共同组成同一场馆体验。
- 照片私藏、房内展示和定向交换分别授权；撤回、删除、移除、屏蔽及双向同意按后端权限执行。
- 个人纪念卡由本人明确选择可用素材、署名和自己的小人，确认后生成PNG并预览；不自动公开私人数据。
- 独立选择加入长期音乐社群或散场聊天室，支持回复、未读、静音、退出与成员管理，照片权限不因加入社群扩大。
- 允许列表音乐卡和原创关系图，独立跳转Music Map；没有录音、歌词或来源不明封面。
- 四张明确虚构专辑的世界杯，二选一、真实票数、并发去重、明确平票决定和持久结果；不是品味评分或权威排行。

前三扩展阶段分别通过[PR9](https://github.com/musicMapTeam/musicSpace/pull/9)、[PR10](https://github.com/musicMapTeam/musicSpace/pull/10)、[PR11](https://github.com/musicMapTeam/musicSpace/pull/11)，最新已发行[0.18.0-rc.3预发布](https://github.com/musicMapTeam/musicSpace/releases/tag/v0.18.0-rc.3)，源提交`cb38ff3831737206e55450c6289a6e9d7a72f75c`。预发布不代表正式生产上线。

## 本阶段：统一入场协议

完整邀请链接和邀请码共用校验与预览流程。二维码、NDEF标签及原生GATT适配源码传输同一个不带身份凭据的邀请网址；每个人仍需明确加入。共享后端路由兼容旧邀请，保留关房、移除及照片权限。支持的HTTPS浏览器提供主动NFC标签写入入口，可取消，不自动请求无线电权限。

候选全量685项测试通过，最终协议及UI66项通过；31步浏览器入场与社群闭环、短屏、同身份多标签及重启验收通过。原生适配源码未编译、未签名，也没有BLE广播扫描或NFC标签硬件验收。还需实体手机、真实观众及目标用户验证。双人创作角仍待独立实施。

- [统一入场规则与原生边界](docs/event/ADMISSION-PROTOCOL.md)
- [本阶段验收说明](docs/event/evidence/admission-qa.md)
- [产品状态](docs/PROJECT_STATUS.md) · [分阶段实施](docs/event/COMMUNITY_ROADMAP.md)
- [部署说明](docs/deployment.md) · [预发布候选说明](docs/release/0.18.0-rc.4.md)
- [产品计划](product/docs/01-product-plan.md) · [交付计划](product/docs/02-delivery-plan.md) · [实施说明](product/docs/03-build-guide.md)
- [第三方许可](THIRD_PARTY_NOTICES.md)

Music Map是独立产品。本轮不修改Map、旧公开演示或旧站点部署，不使用新的外部素材、服务或凭据。
