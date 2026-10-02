import { randomUUID } from 'node:crypto';
import { socialAllowedSQL } from './event-social.js';

const ID = '[0-9a-f-]{36}';
const PAGE_SIZE = 50;
const validID = value => typeof value === 'string' && new RegExp(`^${ID}$`).test(value);
const messageJSON = (row, userId, receiptsAvailable) => ({ id: row.id, senderId: row.sender_id, recipientId: row.recipient_id,
  text: row.text, createdAt: row.created_at, readAt: row.recipient_id === userId || receiptsAvailable ? row.read_at || null : null });

/** Text-only private history. Fetching persists delivery eligibility, never read
 * consent. All writes reuse the event worker's atomic/idempotent envelope. */
export async function handleEventChat(c) {
  const { request, path, method, user, db, stmt, get, now, rate, mutate, readJSON, keys, fail, json } = c;
  const route = new RegExp(`^/chats/(${ID})/(messages|read)$`).exec(path);
  if (path !== '/chats' && !route) return null;
  const other = route?.[1];
  if (other === user.id) fail(400, 'SELF_INTERACTION', '不能向自己发送私聊。');
  const pairIds = other && [user.id, other].sort();
  const allowedSQL = `(s.status = 'accepted' AND ${socialAllowedSQL('a.id', 'u.id')})`;
  // The caller always constrains s to its own pair(s). Stored profiles are from
  // the last permitted send, not presence/profile updates after removal/block.
  const selectChat = `WITH actor AS (SELECT ? AS id) SELECT s.id AS pair_id,s.low_id,s.high_id,s.revision,s.status,
    t.pair_id AS thread_id,t.low_profile,t.high_profile,COALESCE(t.updated_at,s.updated_at) AS chat_updated_at,
    u.id AS peer_id,u.name AS peer_name,u.avatar AS peer_avatar,${allowedSQL} AS can_send,
    m.id AS last_id,m.sender_id AS last_sender_id,m.recipient_id AS last_recipient_id,m.text AS last_text,m.created_at AS last_created_at,r.read_at AS last_read_at,
    (SELECT COUNT(*) FROM event_chat_messages unread LEFT JOIN event_chat_receipts seen ON seen.message_id=unread.id AND seen.viewer_id=a.id
      WHERE unread.pair_id=s.id AND unread.recipient_id=a.id AND seen.read_at IS NULL) AS unread_count
    FROM event_social_pairs s CROSS JOIN actor a JOIN avatar_users u ON u.id=CASE WHEN s.low_id=a.id THEN s.high_id ELSE s.low_id END
    LEFT JOIN event_chat_threads t ON t.pair_id=s.id
    LEFT JOIN event_chat_messages m ON m.seq=(SELECT MAX(latest.seq) FROM event_chat_messages latest WHERE latest.pair_id=s.id)
    LEFT JOIN event_chat_receipts r ON r.message_id=m.id AND r.viewer_id=m.recipient_id`;
  const chatJSON = row => {
    const canSend = Boolean(row.can_send);
    const peer = row.thread_id ? JSON.parse(row.low_id === user.id ? row.high_profile : row.low_profile)
      : { id: row.peer_id, name: row.peer_name, avatar: JSON.parse(row.peer_avatar) };
    return { id: row.pair_id, userId: row.peer_id, peer, canSend, receiptsAvailable: canSend, unreadCount: row.unread_count,
      lastMessage: row.last_id ? messageJSON({ id: row.last_id, sender_id: row.last_sender_id, recipient_id: row.last_recipient_id,
        text: row.last_text, created_at: row.last_created_at, read_at: row.last_read_at }, user.id, canSend) : null, updatedAt: row.chat_updated_at };
  };
  const stateStatement = () => stmt(`${selectChat} WHERE s.low_id=? AND s.high_id=?`, user.id, ...pairIds);
  function readable(row) { if (!row || (!row.thread_id && !row.can_send)) fail(404, 'CHAT_NOT_FOUND', '对话不存在，或当前身份无权查看。'); return row; }
  const sendGuard = row => ({ sql: `EXISTS (SELECT 1 FROM event_social_pairs s WHERE s.id=? AND s.revision=? AND s.status='accepted') AND ${socialAllowedSQL('?', '?')}`,
    args: [row.pair_id, row.revision, user.id, other, other, user.id] });

  if (path === '/chats' && method === 'GET') {
    const cursor = new URL(request.url).searchParams.get('cursor');
    if (cursor && !validID(cursor)) fail(400, 'INVALID_CURSOR', '分页位置无效。');
    const result = await db.batch([
      stmt(`${selectChat} WHERE (s.low_id=? OR s.high_id=?) AND t.pair_id IS NOT NULL AND m.id IS NOT NULL${cursor ? ' AND s.id > ?' : ''} ORDER BY s.id LIMIT 51`, user.id, user.id, user.id, ...(cursor ? [cursor] : [])),
      stmt(`SELECT COUNT(*) AS total FROM event_chat_messages m JOIN event_social_pairs s ON s.id=m.pair_id
        LEFT JOIN event_chat_receipts r ON r.message_id=m.id AND r.viewer_id=?
        WHERE m.recipient_id=? AND (s.low_id=? OR s.high_id=?) AND r.read_at IS NULL`, user.id, user.id, user.id, user.id),
    ]);
    const rows = result[0].results;
    return json(200, { actorId: user.id, chats: rows.slice(0, PAGE_SIZE).map(chatJSON), nextCursor: rows.length > PAGE_SIZE ? rows[PAGE_SIZE - 1].pair_id : null, totalUnreadCount: result[1].results[0].total });
  }
  if (!route) return null;

  if (method === 'GET' && route[2] === 'messages') {
    const query = new URL(request.url).searchParams, before = query.get('before'), after = query.get('after');
    if ((before && after) || (before && !validID(before)) || (after && !validID(after))) fail(400, 'INVALID_CURSOR', '消息分页位置无效。');
    const anchor = before || after;
    const results = await db.batch([
      stateStatement(),
      stmt(`SELECT m.*,r.read_at FROM event_chat_messages m JOIN event_social_pairs s ON s.id=m.pair_id
        LEFT JOIN event_chat_receipts r ON r.message_id=m.id AND r.viewer_id=m.recipient_id
        WHERE s.low_id=? AND s.high_id=?${anchor ? ` AND m.seq ${before ? '<' : '>'} (SELECT seq FROM event_chat_messages WHERE id=? AND pair_id=s.id)` : ''}
        ORDER BY m.seq ${after ? 'ASC' : 'DESC'} LIMIT 51`, ...pairIds, ...(anchor ? [anchor] : [])),
      ...(anchor ? [stmt('SELECT m.id FROM event_chat_messages m JOIN event_social_pairs s ON s.id=m.pair_id WHERE m.id=? AND s.low_id=? AND s.high_id=?', anchor, ...pairIds)] : []),
    ]);
    const row = readable(results[0].results[0]);
    if (anchor && !results[2].results[0]) fail(400, 'INVALID_CURSOR', '消息分页位置不属于这段对话。');
    let messages = results[1].results.slice(0, PAGE_SIZE); const hasMore = results[1].results.length > PAGE_SIZE;
    if (!after) messages = messages.reverse();
    const delivered = messages.filter(m => m.recipient_id === user.id);
    if (delivered.length) await db.batch(delivered.map(m => stmt('INSERT INTO event_chat_receipts (message_id,viewer_id,delivered_at,read_at) VALUES (?,?,?,NULL) ON CONFLICT(message_id,viewer_id) DO NOTHING', m.id, user.id, now())));
    // History remains readable, but relation revocation during delivery I/O must
    // not leak a newly observed profile or read receipt as current permission.
    const current = readable(await stateStatement().first());
    const chat = chatJSON(current);
    return json(200, { actorId: user.id, chat, messages: messages.map(m => messageJSON(m, user.id, chat.receiptsAvailable)),
      olderCursor: !after && hasMore ? messages[0].id : null, newerCursor: after && hasMore ? messages[messages.length - 1].id : null });
  }

  if (method === 'POST' && route[2] === 'messages') {
    const data = await readJSON(request); keys(data, ['text']);
    if (typeof data.text !== 'string' || /\p{Cs}/u.test(data.text) || !data.text.trim() || [...data.text].length > 1000 || /[\u0000-\u0008\u000b-\u001f\u007f-\u009f\u061c\u200e\u200f\u202a-\u202e\u2066-\u2069\ufeff]/u.test(data.text)) fail(400, 'INVALID_MESSAGE', '请输入1至1000个字的文字，可换行；不要包含控制字符。');
    const result = await mutate(data, async () => {
      const row = await stateStatement().first();
      if (!row?.can_send) fail(404, 'CHAT_UNAVAILABLE', '当前不能发送新消息，请查看好友状态。');
      await rate(`chat-send:${user.id}`, 20);
      await rate(`chat-day:${user.id}`, 500, 24 * 60 * 60_000);
      const profileRows = (await stmt('SELECT id,name,avatar FROM avatar_users WHERE id IN (?,?)', ...pairIds).all()).results;
      const profiles = Object.fromEntries(profileRows.map(p => [p.id, JSON.stringify({ id: p.id, name: p.name, avatar: JSON.parse(p.avatar) })]));
      const timestamp = now(), message = { id: randomUUID(), sender_id: user.id, recipient_id: other, text: data.text, created_at: timestamp };
      return { status: 201, body: { message: messageJSON(message, user.id, true) }, guard: sendGuard(row), statements: [
        stmt(`INSERT INTO event_chat_threads (pair_id,low_profile,high_profile,created_at,updated_at) VALUES (?,?,?,?,?)
          ON CONFLICT(pair_id) DO UPDATE SET low_profile=excluded.low_profile,high_profile=excluded.high_profile,updated_at=excluded.updated_at`, row.pair_id, profiles[pairIds[0]], profiles[pairIds[1]], timestamp, timestamp),
        stmt('INSERT INTO event_chat_messages (id,pair_id,sender_id,recipient_id,text,created_at) VALUES (?,?,?,?,?,?)', message.id, row.pair_id, user.id, other, message.text, timestamp),
      ] };
    });
    // Only the immutable message is replayed; permission is freshly evaluated.
    const body = await result.json(), current = await stateStatement().first();
    return json(result.status, { ...body, canSend: Boolean(current?.can_send) }, result.headers.get('Idempotency-Replayed') ? { 'Idempotency-Replayed': 'true' } : {});
  }

  if (method === 'POST' && route[2] === 'read') {
    const data = await readJSON(request); keys(data, ['messageIds']);
    if (!Array.isArray(data.messageIds) || data.messageIds.length < 1 || data.messageIds.length > PAGE_SIZE || data.messageIds.some(id => !validID(id)) || new Set(data.messageIds).size !== data.messageIds.length) fail(400, 'INVALID_READ_ACK', '请只确认这一页实际显示的消息。');
    return mutate(data, async () => {
      const row = readable(await stateStatement().first()), slots = data.messageIds.map(() => '?').join(',');
      const eligible = `SELECT m.id FROM event_chat_messages m JOIN event_chat_receipts r ON r.message_id=m.id AND r.viewer_id=?
        WHERE m.pair_id=? AND m.recipient_id=? AND m.id IN (${slots})`;
      const args = [user.id, row.pair_id, user.id, ...data.messageIds];
      if ((await stmt(eligible, ...args).all()).results.length !== data.messageIds.length) fail(400, 'INVALID_READ_ACK', '只能确认这段对话中已经向本人显示的收到消息。');
      return { body: { acknowledged: data.messageIds }, guard: { sql: `(SELECT COUNT(*) FROM (${eligible}))=?`, args: [...args, data.messageIds.length] }, statements: [
        stmt(`UPDATE event_chat_receipts SET read_at=COALESCE(read_at,?) WHERE viewer_id=? AND message_id IN (${slots})`, now(), user.id, ...data.messageIds),
      ] };
    });
  }
  return null;
}
