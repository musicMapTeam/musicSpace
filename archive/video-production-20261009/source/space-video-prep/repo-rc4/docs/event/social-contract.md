# 同场招呼、双向好友与屏蔽

2026-09-30 · 独立 `/api/event` 后端增量；公开 v4 与旧 `/api/avatar` 合影权限不变。后端实现为 `runtime-preview/src/event-social.js`，Node HTTP 与 Worker 共用。这里的「全局」是同一分身身份在所有 event 房间中的关系，不是跨产品拉黑，也不改变旧合影的既有许可。

## 不变量

- 发送招呼需要两人已经明确加入同一场**尚未结束**的现场，且两人当时都未离场。自发招呼、伪造发起者、跨场猜成员 ID、只持邀请码都不行。
- 招呼是明确收件人的单个请求。只有收件人本人调用「接受」才会建立双向好友；发件人不能替对方同意。同时从相反方向发招呼，也只保留一个待回应请求，绝不自动接受。
- 同一身份对在不同场次也只有一个当前关系。好友可以在散场后保留；已有招呼允许在离场、房间关闭或自然过期后由收件人明确回应。这样不会逼迫观众在演出中马上决定。新的招呼仍要求同场在场。
- 收件人可拒绝，发件人可撤回。拒绝或撤回后，两边待办立即移除，10 分钟内双方都不能重发。冷却值独立保存，屏蔽再取消屏蔽不能绕过。每位发件人每小时最多 20 次、同一收件人每天最多 5 次发送尝试；服务器原有写入/IP 限流也继续生效。
- 删除好友是明确操作，任一方删除后双方列表一起移除。旧接受回执、重新加入房间、刷新、重启、取消屏蔽均不能恢复关系；重新结识需要新的招呼和接受。
- 任一方屏蔽会在同一事务中终止这对身份的待回应招呼和好友状态，立即禁止新的互动。两人互相看不到对方在 event 房间的名册条目与共享照片，直接猜图片地址也不能读。照片读取期间发生屏蔽，会在对象存储返回后再验权限，拒绝发出图片。
- 屏蔽不移除双方的历史现场元信息，不更改用户自己的照片、照片可见性或照片版本，也不影响第三位未被屏蔽成员原有的观看权限。本人仍可读取自己的照片。取消屏蔽后，尚有效的「本场成员」照片许可继续按原规则判断，不会因此新增好友、恢复招呼或赋予私藏照片权限。
- **好友从来不是照片授权条件。** 私藏、成员分享、离场撤回、拥有者删除沿用既有照片门禁；不增加定向交换或联系资料暴露。只返回应用昵称与 avatar，不返回手机号、邮箱、token、token hash、对象存储键。

## 身份、事务与重试

所有下列接口，即使列表为空，也要求已有 avatar session 的 `Authorization: Bearer …`。身份取自服务器 token hash，不接受请求体指定 actorId。

所有写入要求 `Idempotency-Key`（16–128 个字母、数字、`_`、`-`）；相同身份、相同 key、相同 method/path/JSON 的重试返回已提交的原回执，并带 `Idempotency-Replayed: true`。同 key 换操作得到 `409 IDEMPOTENCY_CONFLICT`。

回执表示**那次操作**的结果，可能已被后来拒绝、删除或屏蔽覆盖。客户端不能根据历史回执把好友、招呼或照片放回界面；写入/重试后应重新读取 `/social` 与当前房间，以当前服务器快照为准。客户端还必须使写入前发出的晚到列表失效。

一个无序身份对只有一条 `event_social_pairs`，revision 在重发、接受、拒绝、取消、删除、屏蔽时递增，不因状态重置而归零。招呼重发生成新的 greeting ID；好友 ID 是持续的关系对 ID。屏蔽表为单向 `(actor_id,target_id)`，有独立 revision；取消屏蔽不删除版本历史。

校验过的状态与权限会作为 `event_mutation_guard` 再放入 D1/SQLite 原子 batch，业务更新与幂等回执一起提交或回滚。两次接受/取消竞争只能一方提交。屏蔽更新关系时不依赖提前读到的 pair revision，因此接受/发送若先提交，随后完成的屏蔽仍会撤销关系；屏蔽若先提交，等待中的接受/发送因事务门禁失败。

## API

以下路径均加 `/api/event` 前缀；成功响应未另写时为 200。

- `GET /social`：`{actorId,incoming,outgoing,friends,blocks,nextCursors}`
  - `incoming` / `outgoing` 只返回当前待回应招呼
  - `friends` 返回双方接受后的当前好友
  - `blocks` 只返回本人主动屏蔽的人，不泄露谁屏蔽了本人
  - 每个数组最多 100 条；`nextCursors` 包含相同四个字段，下一页存在时为 ID，否则为 `null`
  - 分别使用 `?incomingCursor=…`、`?outgoingCursor=…`、`?friendsCursor=…`、`?blocksCursor=…`；也可一起传。没传 cursor 的数组返回第一页。招呼按 greeting ID、好友按关系 ID、屏蔽按 target user ID 升序，删除分页锚点不影响后页
  - 四个查询位于一个只读 batch 中，不拼接四个不同关系时刻的快照
- `GET /social/peers/:peerUserId`：`{actorId,peer,incoming:[],outgoing:[],friends:[],blocks:[]}`，只读取这一对身份，每组 0 或 1 条，无分页游标
  - 为从第 2 页等位置打开的成员提供独立、当前的版本；不能先读总列表第一页，再把「本页没有」误判为关系不存在
  - 必须有本人已有关系/招呼记录、共同现场历史或本人屏蔽记录；任意陌生人 ID 返回 `404 PERSON_UNAVAILABLE`
  - 本人主动屏蔽仍可读取以管理取消屏蔽，包括双方互相屏蔽。只有对方屏蔽本人时返回 404，不返回新的 profile 或可操作关系
  - 已删除/拒绝/撤回的旧关系可返回 peer 及空数组；读取不恢复关系、不赋予照片访问或现场成员资格
  - profile、关系、自己的屏蔽行在同一事务快照读取；列表与对象形状、revision 含义不变
- `POST /rooms/:roomId/greetings`，JSON `{recipientId}` → **201** `{greeting}`
- `POST /greetings/:greetingId/accept`，JSON `{revision}` → `{greeting,friend}`
- `POST /greetings/:greetingId/reject`，JSON `{revision}` → `{greeting}`
- `POST /greetings/:greetingId/cancel`，JSON `{revision}` → `{greeting}`
- `DELETE /friends/:peerUserId`，JSON `{revision}` → `{removed:true,userId}`。使用好友行的 revision，URL 使用对方 userId，不是关系 ID
- `POST /blocks/:peerUserId`，JSON `{}` → `{block}`。可屏蔽同场历史成员或有过招呼/关系的人，不能任意枚举陌生身份。再次屏蔽是新的显式操作，版本递增
- `DELETE /blocks/:peerUserId`，JSON `{revision}` → `{unblocked:true,userId}`。使用自己屏蔽行的 revision。双方都屏蔽时，只撤销自己的一侧，另一侧仍生效

对象形状：

```js
Peer = { id, name, avatar }
Greeting = {
  id, roomId, senderId, recipientId,
  status: 'pending' | 'accepted' | 'rejected' | 'cancelled',
  revision, createdAt, updatedAt, peer: Peer
}
Friend = { id, userId, roomId, revision, since, peer: Peer }
Block = { userId, revision, createdAt, peer: Peer }
```

列表中的 peer 永远是相对于当前调用者的另一人。接受响应中的 peer 是发起者；发起者后来读取好友列表时得到的是收件人。所有时间为 ISO 字符串。

主要错误：

- `401 SESSION_REQUIRED / SESSION_INVALID`：身份缺失/失效，不能伪装空列表
- `400 INVALID_INPUT / REVISION_REQUIRED / IDEMPOTENCY_KEY_REQUIRED / SELF_INTERACTION / INVALID_CURSOR`
- `403 GREETING_ROLE_REQUIRED`：调用者是关系一方，但不是这个动作的本人
- `404 PERSON_UNAVAILABLE / GREETING_NOT_FOUND / FRIEND_NOT_FOUND / BLOCK_NOT_FOUND`：不可访问或不存在；屏蔽方不会向对方泄露「谁屏蔽了你」
- `409 GREETING_PENDING / ALREADY_FRIENDS / GREETING_RESOLVED`：当前状态不接受该操作
- `409 REVISION_CONFLICT`：预读已经发现版本不符，响应含 `error.currentRevision`
- `409 STATE_CONFLICT`：预读以后状态/权限又变化，事务整体回滚
- `429 GREETING_COOLDOWN / RATE_LIMITED`：响应 `Retry-After` 秒数
- `503 SERVICE_UNAVAILABLE`：结果可能未定，保留原 key 重试，不凭错误猜测未提交

## 数据与升级

`runtime-preview/drizzle/0002_event_social.sql` 为叠加式迁移，配套 schema.ts、0002 snapshot 和 journal 新条目；0000/0001 SQL 与 snapshot 不重写。Node 的 event store 从这份 SQL 初始化 `IF NOT EXISTS` 表和索引，不复制另一份 schema。便携运行包必须包含这份 SQL 与 `runtime-preview/src/event-social.js`。无需新服务、凭据或公开存储。

旧身份、房间、照片、合影记录保持原数据。新表初始为空；旧合影同意与当前好友关系没有迁移映射。应用的普通启动不会对线上 D1 执行迁移；远端应用迁移/发布仍是单独的部署动作，本轮未执行。

## 验证证据与边界

`node --test tests/event-social.test.js`：38 项通过。Node HTTP + 真 SQLite 与 Worker + 真 SQLite/D1 适配器均走独立 bearer 身份；不是切换本地示例角色，也不是仅手写 mock 存储。

覆盖身份/陌生人/伪造 room 或 actor、接受角色、拒绝/撤回/冷却、交叉发送、双向好友删除、两个互相屏蔽与分别取消、跨房隐藏与私有图片直读、第三人权限不变、散场后接受而不增照片权限、重启持久化、原回执重放、提交后连接丢失且恢复读取失败、事务失败回滚、旧库无损升级、四组独立分页、第 2 页好友的独立当前读取/删除/屏蔽管理、未知 peer 隐私、peer 快照前提交屏蔽、存储读取中屏蔽、确定性顺序的接受/撤回与屏蔽/发送/接受竞争、发招呼期间离场或结束现场。

固定一分钟计数窗口里，24 个同 IP 身份各发 12 次房间读取、12 次社交读取、6 次照片读取（共 720 次读），加开场/加入/上传，未触发正常流量限额；另测单身份 180 次/分钟独立上限重启后仍有效。另测所有 24 人主动打开 24 张图片的照片网格：24 × (12 名册 + 12 社交 + 24 图片) = 1152 次读，加开场/加入 24、上传 24、健康探测 24、邀请预览 23，共 1247 次请求。先在原 1200/IP 上限真实复现 429，再将共享 IP 原型预算调为 1800/分钟，复测通过；每用户 180 次读/40 次写、每 IP 120 次预览均不提高，预览上限也单独回归。后台场景只应取 6 张墙面照片，24 张读取仅在用户明确展开网格时发生。这是限流预算回归，不是网络吞吐/压力或真实现场负载测试。

原有 event 后端 33 项仍通过。浏览器画面、UI 可用性、云端 D1/R2 实机、部署、真手机与目标用户试用不由这些后端测试证明；本文件不声称已经完成这些阶段。
