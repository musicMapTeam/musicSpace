# 一对一文字私聊

2026-09-30 · 只用于独立 `/api/event` 现场主线；复用 avatar bearer 身份、SQLite/D1 事务与幂等回执。实现 `runtime-preview/src/event-chat.js`。不增加照片/附件授权、服务、凭据或线上发布。

## 权限与记录

- 只有目前双向好友且双方都未屏蔽，才可发送新消息。不要求演出仍开放；离场不会自动取消好友。
- 删除好友或任一方屏蔽后，立即拒绝新的发送。发送前预读与事务内再次检查同一个 pair revision、accepted 状态、双向屏蔽。若发送先提交再屏蔽，已发送消息保留；若屏蔽/删除先提交，等待中的发送整体回滚。
- 双方仍能读取自己已有的对话历史。没有已有对话的非好友、第三者或猜测 peer ID，均不能读取。历史只显示最后一次获准发送时保存的应用昵称/avatar，不展示对方后来的 profile 或在线状态。
- 解除关系后 `canSend:false`、`receiptsAvailable:false`；发给对方的历史消息不再提供对方已读时间。本人仍可明确确认自己已展示的历史来减少自己的未读数，不恢复好友或发送权。取消屏蔽也不会自动恢复好友。
- 只存文字，正文 1–1000 个 Unicode 字符；保留换行/制表符，拒绝空白、控制字符、双向文本控制字符与孤立代理项。不渲染 HTML、自动抓链接或上传附件；前端用 textContent/等效转义显示。
- 新发送尝试限 20 次/分钟、500 次/天，持久保存；另受原单身份 40 次写/分钟与共享 IP 1800 次/分钟限制。相同幂等 key 的已成功重试不再消耗私聊发送配额，通用请求限额仍生效。
- 消息存在私有服务数据库，属于双身份接口访问控制，不宣称端到端加密。服务器接收成功只表示已保存，不能标为「对方已读」。

## 已读语义

读取列表或聊天页面绝不标记已读。消息页 GET 只记录「本次已返回给这个收件人的消息 ID」作为后续明确确认的资格；`GET /chats` 的末条预览没有这种资格。

客户端只能在可见聊天页真正显示收到的消息后，显式 POST 当前显示的 messageIds。隐藏页、收件箱轮询、服务器保存回执不发确认。每次最多 50 个 ID，只接受本对话、本人收到、消息页先前返回过的消息；发出去的消息、其他对话、未来/伪造 ID、未翻到的旧消息一律拒绝，混合合法非法 ID 不部分更新。

read ack 逐条落库，不使用「读到最高 ID 即以前都已读」的跳跃方案。最新页可确认而未翻到的旧页保持未读；再次确认不会改变首次已读时间。对方在可用关系期间才能看到已读时间。此机制验证明确确认及已返回资格，不声称能证明人类真的阅读了文字。

## 固定 API

所有路径前加 `/api/event`。全部需要 bearer 身份；写入还需要既有 `Idempotency-Key`。未知额外请求字段拒绝。

- `GET /chats?cursor=<pairId>` → `{actorId,chats:Chat[],nextCursor,totalUnreadCount}`
  - 只列实际已有消息的对话；每页最多 50，按稳定 pair ID 升序，不因新消息改变分页位置
  - totalUnreadCount 是当前身份全部对话中收到且未明确确认的消息总数，与当前分页无关；包含按既有策略保留的只读历史，排除本人发出的消息。总数与本页列表在同一事务快照读取
  - nextCursor 无后页时为 null。UI 可在已加载范围按 updatedAt 展示，但不能拿展示排序替代服务端游标
- `GET /chats/:peerUserId/messages[?before=<messageId>|?after=<messageId>]` → `{actorId,chat:Chat,messages:Message[],olderCursor,newerCursor}`
  - 好友尚未发送消息时返回空 messages 与 `canSend:true`，不会创建空线程
  - 默认取最新 50；before 取锚点以前最近 50；after 从锚点以后顺序追赶 50。不能同时传 before 与 after，锚点必须属于本人这段对话
  - 返回数组始终按提交发送顺序升序，即便时间戳完全相同。内部自增序号不暴露给客户端，游标只使用消息 UUID
  - 默认/before 尚有更旧消息时 olderCursor 是本页首条 ID，否则 null；after 尚有待追赶消息时 newerCursor 是本页末条 ID，否则 null
  - 增量更新不能用 after 响应的 olderCursor:null 清掉先前已知的历史分页入口；下一次追赶用最后实际收到的消息 ID
- `POST /chats/:peerUserId/messages`，JSON `{text}` → **201** `{message,canSend}`
  - message 是此次持久化的原回执；canSend 在返回时重新读取当前关系
  - block 后用旧 key 重放返回同一条旧 message 及 `canSend:false`，绝不再插入消息或重建关系
  - 当前权限重新读取失败则 503，保留原 key 重试；不能猜测前一步未保存
- `POST /chats/:peerUserId/read`，JSON `{messageIds:[…]}` → `{acknowledged:[…]}`
  - 1–50 个互不重复的消息 UUID，规则见已读语义；事务内再次检查资格，业务更新与幂等回执一起提交

```js
Message = { id, senderId, recipientId, text, createdAt, readAt }
Chat = {
  id, userId, peer: { id, name, avatar },
  canSend, receiptsAvailable, unreadCount, lastMessage, updatedAt
}
```

id 为关系 ID，userId 为对方身份；lastMessage 无内容时 null。readAt 仅明确确认后为 ISO 时间，未确认或当前不允许看到对方回执时为 null。updatedAt 来自最后获准消息，不是上线/页面查看时间。UI 状态和存储不得公开 bearer token。

关键错误：401 SESSION_REQUIRED/SESSION_INVALID；400 INVALID_MESSAGE/INVALID_READ_ACK/INVALID_CURSOR；404 CHAT_NOT_FOUND/CHAT_UNAVAILABLE；409 IDEMPOTENCY_CONFLICT/STATE_CONFLICT；429 RATE_LIMITED（带 Retry-After）；503 SERVICE_UNAVAILABLE。无身份的空列表也必须 401。好友/屏蔽状态是服务端当前真值，迟到或重放的旧成功结果不能把较新确认的只读状态反转。

## 事务、迁移与交付

一条 `event_chat_threads` 对应一个既有 canonical pair；`event_chat_messages` 保存仅文字消息，`event_chat_receipts` 分开记录返回资格与明确已读。消息插入、线程快照更新和幂等结果使用已有 event 原子 batch，失败一起回滚。read ack 也遵循同一事务。删除/屏蔽不会删除历史记录或授予照片读取能力。

新增 `0003_event_chat.sql`、Drizzle schema/snapshot/journal；0000/0001/0002 与既有数据不重写。Node event store 从相同 SQL 初始化叠加表；便携包必须带 0002、0003 SQL 与 event-social.js、event-chat.js。没有执行远端迁移或发布。

`node --test tests/event-chat.test.js`：24 项通过，含 Node HTTP 真 SQLite 与 Worker 真 SQLite 适配器的双独立身份。覆盖权限、输入、明示逐条 read ack、未读、跨页遗漏防护、猜测消息/对话 ID、重启、500/天与20/分钟频控、双击同 key、丢发送/ack 响应、事务回滚、双方向屏蔽与发送竞争、分页同时间戳、多对话分页、读取期间屏蔽、旧库升级与照片权限不变。此处不代替浏览器实操、真手机、云端 D1/R2 或部署验收。

## 独立浏览器控制器

`web/event-client/chat-controller.js` 导出 `createChatController({api?,storage?,getSession?,fetch?,baseUrl?})`。默认身份源读取既有 `music-space-avatar-session:v1`；控制器不建立新身份，不改写原身份存储，也不自行启动轮询。主 UI 身份变化时主动调用 `syncIdentity(session?)`，重连时清理旧错误；迟到响应还会重新核对当前存储身份。

方法固定为 `subscribe(listener)`（立即回调）、`getState()`、`syncIdentity(session?)`、`list({cursor?}={})`、`open(peerId或{id/userId})`、`older()`、`refresh()`、`setDraft(text)`、`send()`、`retry(operationId)`、`acknowledge(messageIds)`、`close()`、`dispose()`。另有 `discard(operationId)`，仅可移除已经确定失败的记录，不可丢弃 running/uncertain。

状态固定为：

```js
{
  actorId, identityStatus: 'ready' | 'missing' | 'invalid',
  list: { items: Chat[], nextCursor, loaded, totalUnreadCount },
  current: null | { peerId, chat: Chat | null, messages: Message[], olderCursor, newerCursor, loaded },
  draft, outbox: [{ id, type: 'send' | 'read', peerId, text?, messageIds?, status, error, durable }],
  error, loading, storage: { ok, refreshRecovery, message }, lastResult
}
```

UI 状态为冻结副本，不包含 bearer token 或幂等 key。草稿与 outbox 用 `music-space-event-chat:v1` 按 actor+peer 隔离；发送前冻结 peer/text/key 并写入浏览器存储。同一 peer 同种操作只允许一个未确认项，重复点击复用运行中的 promise。存储不能写入时保留草稿并阻止新的未追踪发送；已有原操作仍可准确重试。成功保存不会删除用户在等待期间改过的下一条草稿。

对话导航 epoch、身份 epoch、读请求序号与当前权限序号一起阻止迟到结果切错人或把已确认的 `canSend:false` 改回 true。旧操作完成后不会跳回旧对话，也不会把旧文本放进另一个人的消息列表。关闭页面仅停止读，不假装取消已经发出的写入。

正常 `refresh()` 一次读取最新页，同时刷新回执；如果发现离线期间超过 50 条消息而最新页与原历史没有交叠，则用 after 游标追赶，不把中间消息静默跳过。保留已展开旧页与翻页游标；明确已确认过的旧页 incoming 不因最新页轮询没返回它而反复发送 read ack。UI 只在打开、可见且没有消息读取中时轮询，并自行按实际可见消息明确调用 acknowledge。

`node --test tests/event-chat-controller.test.js`：16 项真实 HTTP + SQLite 测试通过，含双击、丢响应跨刷新/服务重启、冻结重试、较新草稿保留、迟到导航与发送、屏蔽后只读、静默身份变化/401与重连、存储失败、超过50条追赶、空对话变为多页、旧页确认去重和失败记录清理。与私聊后端、既有 event/social/controller 相关回归一起运行为 **151/151**。这些是源代码/接口/状态验证，不等同于最新 UI 的浏览器验收。

未读总数回归：构造第51个未加载对话的新消息，首50项未读之和为0而totalUnreadCount仍正确增加；逐条read ack后控制器重新读取服务端总数，只更新计数、不折叠已经展开的51条对话。总数采用请求序号，较晚到达的旧计数不能覆盖新确认结果。


## 运行中身份替换防护（候选2修复）

浏览器 storage / focus / online 事件由主 UI 调用 `syncIdentity()`，读取此刻的身份来源；此方法不发网络请求，立即清理旧 current、list、totalUnreadCount、可见 draft/outbox、错误和权限缓存。明确 `syncIdentity(null)` 可隐藏已失效身份；迟到回调传入的非空旧 session 不可盖过当前凭据来源。

每次网络响应应用前，先核对实际 sourceSession token 和 user ID，再比较缓存 session/epoch。即使是更早身份 A 的请求，也会发现当前 C 已再次变化，不靠旧 epoch 提前退出而漏掉新的来源变化。

发送/已读写入在收到响应后、删除 outbox 或清草稿之前再次核对身份。A 请求期间合法切换到 C 后，旧完成结果不会回写 C 的 current/list/unread/draft，也不暴露消息回执给 C；A 的原 key、peer、text 保留为待原身份确认，不声称撤回，不用 C 的 token 重试 A。只有 A 恢复并主动以原 key 重试才能确认结果；已提交消息不会重复插入。迟到的失败也不向 C 推送 A 的错误。

本轮新增3项真实HTTP/SQLite测试：合法A→C替换期间并行列表/消息读取、延迟发送及原身份重试、离线无网络的即时syncIdentity与拒绝旧session覆盖。chat controller共 **19/19** 通过；这补充状态/存储的定点验证，不替代候选2浏览器重新验收。

## 浏览器会话边界（2026-09-30）

应用目前每个浏览器origin使用一份匿名身份，没有产品级多账户切换按钮。其他同源标签更换会话会触发storage事件；focus、online及认证响应应用前也核对当前凭据。发现外部变更后，主事件控制器停止写回，清空当前私有状态，应用重新加载后核验新会话。相同凭据的网络重连不会因此关闭对话。

迟到的session/profile/身份创建响应不能覆盖较新的SESSION_KEY。旧控制器的错误、pagehide/dispose也不能回写新身份的恢复数据。旧actor的未确认操作保留在其原身份范围内；新actor不看到、不取得旧运行中Promise、不用新token重试它。清空存储后的销毁不会复活旧草稿。测试用合法会话替换是存储协调测试，不等同于新增账户登录功能，也不自动构成服务端跨认证读取证据。
