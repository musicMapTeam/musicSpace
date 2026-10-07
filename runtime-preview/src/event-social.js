import {spaceWriteGuard} from './space-access.js';
import {openParticipationSQL} from './event-participation.js';
import { randomUUID } from 'node:crypto';

const ID = '[0-9a-f-]{36}';
const PAGE_SIZE = 100;
const COOLDOWN_MS = 10 * 60_000;
const pairIds = (a, b) => [a, b].sort();
const communityWillingnessSQL=()=>"EXISTS(SELECT 1 FROM event_conversation_members a JOIN event_conversation_members b ON b.kind=a.kind AND b.scope_id=a.scope_id WHERE a.kind='community' AND a.scope_id=? AND a.user_id=? AND b.user_id=? AND a.left_at IS NULL AND b.left_at IS NULL AND a.removed_at IS NULL AND b.removed_at IS NULL AND a.mode='open' AND b.mode='open')";
// All users of these predicates pass trusted SQL expressions, never request text.
export const socialAllowedSQL = (actor, peer) => `NOT EXISTS (SELECT 1 FROM event_social_blocks b WHERE b.unblocked_at IS NULL AND ((b.actor_id = ${actor} AND b.target_id = ${peer}) OR (b.actor_id = ${peer} AND b.target_id = ${actor})))`;

/** Event-only relationships. The authenticated worker owns HTTP parsing, errors,
 * idempotency, rates and the transactional mutation envelope. */
export async function handleEventSocial(c) {
  const { request, path, method, user, db, stmt, get, now, clock, rate, mutate, readJSON, keys, revision, fail, json, endExchanges } = c;
  const peerJSON = row => ({ id: row.peer_id, name: row.peer_name, avatar: JSON.parse(row.peer_avatar) });
  const greetingJSON = (row, peer) => ({ id: row.greeting_id, roomId: row.room_id, senderId: row.sender_id,
    recipientId: row.recipient_id, status: row.status, revision: row.revision, createdAt: row.created_at, updatedAt: row.updated_at, peer });
  const friendJSON = (row, peer) => ({ id: row.id, userId: peer.id, roomId: row.room_id, revision: row.revision, since: row.friends_at, peer });
  const blockJSON = (row, peer) => ({ userId: row.target_id, revision: row.revision, createdAt: row.created_at, peer });
  const peer = async id => {
    const row = await get('SELECT id,name,avatar FROM avatar_users WHERE id = ?', id);
    if (!row) fail(404, 'PERSON_UNAVAILABLE', '当前无法与这位成员互动。');
    return { id: row.id, name: row.name, avatar: JSON.parse(row.avatar) };
  };
  const unblocked = other => ({ sql: socialAllowedSQL('?', '?'), args: [user.id, other, other, user.id] });
  const allowed = async other => {
    const guard = unblocked(other);
    if (!await get(`SELECT 1 AS ok WHERE ${guard.sql}`, ...guard.args)) fail(404, 'PERSON_UNAVAILABLE', '当前无法与这位成员互动。');
    return guard;
  };
  const pair = other => get('SELECT * FROM event_social_pairs WHERE low_id = ? AND high_id = ?', ...pairIds(user.id, other));
  const pairGuard = (row, other) => row
    ? { sql: 'EXISTS (SELECT 1 FROM event_social_pairs WHERE id = ? AND revision = ?)', args: [row.id, row.revision] }
    : { sql: 'NOT EXISTS (SELECT 1 FROM event_social_pairs WHERE low_id = ? AND high_id = ?)', args: pairIds(user.id, other) };
  const combine = (...guards) => ({ sql: guards.map(g => `(${g.sql})`).join(' AND '), args: guards.flatMap(g => g.args) });
  function validPeer(id) {
    if (typeof id !== 'string' || !new RegExp(`^${ID}$`).test(id)) fail(400, 'INVALID_INPUT', '成员编号无效。');
    if (id === user.id) fail(400, 'SELF_INTERACTION', '不能向自己发送这项操作。');
  }

  const peerRoute = new RegExp(`^/social/peers/(${ID})$`).exec(path);
  if (method === 'GET' && peerRoute) {
    const other = peerRoute[1]; validPeer(other);
    const [low, high] = pairIds(user.id, other);
    const results = await db.batch([
      stmt(`SELECT u.id AS peer_id,u.name AS peer_name,u.avatar AS peer_avatar FROM avatar_users u WHERE u.id = ? AND
        (EXISTS (SELECT 1 FROM event_social_pairs WHERE low_id = ? AND high_id = ?) OR
         EXISTS (SELECT 1 FROM event_members a JOIN event_members b ON b.room_id = a.room_id WHERE a.user_id = ? AND b.user_id = ?) OR
         EXISTS (SELECT 1 FROM event_social_blocks WHERE actor_id = ? AND target_id = ?)) AND
        (EXISTS (SELECT 1 FROM event_social_blocks WHERE actor_id = ? AND target_id = ? AND unblocked_at IS NULL) OR ${socialAllowedSQL('?', 'u.id')})`,
        other, low, high, user.id, other, user.id, other, user.id, other, user.id, user.id),
      stmt(`SELECT * FROM event_social_pairs WHERE low_id = ? AND high_id = ? AND ${socialAllowedSQL('?', '?')}`, low, high, user.id, other, other, user.id),
      stmt('SELECT * FROM event_social_blocks WHERE actor_id = ? AND target_id = ? AND unblocked_at IS NULL', user.id, other),
    ]);
    const profileRow = results[0].results[0];
    if (!profileRow) fail(404, 'PERSON_UNAVAILABLE', '当前无法查看这位成员。');
    const profile = peerJSON(profileRow), relationship = results[1].results[0], blocked = results[2].results[0];
    const body = { actorId: user.id, peer: profile, incoming: [], outgoing: [], friends: [], blocks: [] };
    if (relationship?.status === 'pending') body[relationship.recipient_id === user.id ? 'incoming' : 'outgoing'].push(greetingJSON(relationship, profile));
    if (relationship?.status === 'accepted') body.friends.push(friendJSON(relationship, profile));
    if (blocked) body.blocks.push(blockJSON(blocked, profile));
    return json(200, body);
  }

  if (method === 'GET' && path === '/social') {
    const query = new URL(request.url).searchParams, cursors = {};
    for (const kind of ['incoming', 'outgoing', 'friends', 'blocks']) {
      cursors[kind] = query.get(`${kind}Cursor`);
      if (cursors[kind] && !new RegExp(`^${ID}$`).test(cursors[kind])) fail(400, 'INVALID_CURSOR', '分页位置无效。');
    }
    const columns = 's.*,u.id AS peer_id,u.name AS peer_name,u.avatar AS peer_avatar';
    const visibility = socialAllowedSQL('?', 'u.id');
    const requests = ['incoming', 'outgoing'].map(kind => {
      const column = kind === 'incoming' ? 'recipient_id' : 'sender_id';
      return stmt(`SELECT ${columns} FROM event_social_pairs s JOIN avatar_users u ON u.id = CASE WHEN s.low_id = ? THEN s.high_id ELSE s.low_id END
        WHERE s.${column} = ? AND s.status = 'pending' AND ${visibility}${cursors[kind] ? ' AND s.greeting_id > ?' : ''}
        ORDER BY s.greeting_id LIMIT 101`, user.id, user.id, user.id, user.id, ...(cursors[kind] ? [cursors[kind]] : []));
    });
    requests.push(stmt(`SELECT ${columns} FROM event_social_pairs s JOIN avatar_users u ON u.id = CASE WHEN s.low_id = ? THEN s.high_id ELSE s.low_id END
      WHERE (s.low_id = ? OR s.high_id = ?) AND s.status = 'accepted' AND ${visibility}${cursors.friends ? ' AND s.id > ?' : ''}
      ORDER BY s.id LIMIT 101`, user.id, user.id, user.id, user.id, user.id, ...(cursors.friends ? [cursors.friends] : [])));
    requests.push(stmt(`SELECT s.*,u.id AS peer_id,u.name AS peer_name,u.avatar AS peer_avatar FROM event_social_blocks s JOIN avatar_users u ON u.id = s.target_id
      WHERE s.actor_id = ? AND s.unblocked_at IS NULL${cursors.blocks ? ' AND s.target_id > ?' : ''} ORDER BY s.target_id LIMIT 101`, user.id, ...(cursors.blocks ? [cursors.blocks] : [])));
    // A single SQLite/D1 snapshot: a block or acceptance cannot split the four lists.
    const results = await db.batch(requests), body = { actorId: user.id, nextCursors: {} };
    for (const [index, kind] of ['incoming', 'outgoing', 'friends', 'blocks'].entries()) {
      const rows = results[index].results, idColumn = kind === 'friends' ? 'id' : kind === 'blocks' ? 'target_id' : 'greeting_id';
      body.nextCursors[kind] = rows.length > PAGE_SIZE ? rows[PAGE_SIZE - 1][idColumn] : null;
      body[kind] = rows.slice(0, PAGE_SIZE).map(row => kind === 'friends' ? friendJSON(row, peerJSON(row)) : kind === 'blocks' ? blockJSON(row, peerJSON(row)) : greetingJSON(row, peerJSON(row)));
    }
    return json(200, body);
  }

  const send = new RegExp(`^/(rooms|communities)/(${ID})/greetings$`).exec(path);
  if (method === 'POST' && send) {
    const data = await readJSON(request); keys(data, ['recipientId']); validPeer(data.recipientId);
    return mutate(data, async () => {
      const other=data.recipientId,communityId=send[1]==='communities'?send[2]:null,roomId=communityId?(await get('SELECT room_id FROM event_community_rooms WHERE community_id=? ORDER BY room_id LIMIT 1',communityId))?.room_id:send[2],privacy=await allowed(other);
      if(!roomId)fail(409,'COMMUNITY_EVENT_REQUIRED','主办方关联场次后，才能在乐迷社群里打招呼。');
      const writable=await spaceWriteGuard(get,fail,communityId?'community':'room',communityId||roomId);
      const roomGuard = communityId?{sql:`(${communityWillingnessSQL()}) AND (${writable.sql})`,args:[communityId,user.id,other,...writable.args]}:{ sql: `EXISTS (SELECT 1 FROM event_rooms r JOIN event_members a ON a.room_id = r.id JOIN event_members b ON b.room_id = r.id
        WHERE r.id = ? AND r.closed_at IS NULL AND r.expires_at > ? AND a.user_id = ? AND b.user_id = ? AND a.left_at IS NULL AND b.left_at IS NULL)`, args: [roomId, now(), user.id, other] };
      if (!await get(`SELECT 1 AS ok WHERE ${roomGuard.sql}`, ...roomGuard.args)) fail(communityId?409:404, communityId?'PARTICIPATION_QUIET':'PERSON_UNAVAILABLE', communityId?'双方都在社群里、都愿意打招呼，才能招手。':'请在同一场未结束的现场中打招呼。');
      const willingness=communityId?roomGuard:{sql:openParticipationSQL('?','?','?'),args:[roomId,user.id,other]};
      if(!await get(`SELECT 1 AS ok WHERE ${willingness.sql}`,...willingness.args))fail(409,'PARTICIPATION_QUIET','双方都愿意打招呼，才能招手。');
      const previous = await pair(other);
      if (previous?.status === 'pending') fail(409, 'GREETING_PENDING', '你们已有待回应的招呼，请先查看。');
      if (previous?.status === 'accepted') fail(409, 'ALREADY_FRIENDS', '你们已经互为好友。');
      if (previous?.cooldown_until) {
        const remaining = Date.parse(previous.cooldown_until) - clock();
        if (remaining > 0) fail(429, 'GREETING_COOLDOWN', '请给彼此一点时间，稍后再打招呼。', { retryAfter: Math.ceil(remaining / 1000) });
      }
      await rate(`greeting:${user.id}`, 20, 60 * 60_000);
      await rate(`greeting-pair:${user.id}:${other}`, 5, 24 * 60 * 60_000);
      const [low, high] = pairIds(user.id, other), timestamp = now();
      const row = { id: previous?.id || randomUUID(), low_id: low, high_id: high, status: 'pending', revision: (previous?.revision || 0) + 1,
        greeting_id: randomUUID(), sender_id: user.id, recipient_id: other, room_id: roomId, created_at: timestamp, updated_at: timestamp, friends_at: null };
      return { status: 201, body: { greeting: greetingJSON(row, await peer(other)) }, guard: combine(privacy, roomGuard, willingness, pairGuard(previous, other)), statements: [
        stmt(`INSERT INTO event_social_pairs (id,low_id,high_id,status,revision,greeting_id,sender_id,recipient_id,room_id,created_at,updated_at,friends_at)
          VALUES (?,?,?,?,?,?,?,?,?,?,?,NULL) ON CONFLICT(low_id,high_id) DO UPDATE SET status=excluded.status,revision=excluded.revision,greeting_id=excluded.greeting_id,
          sender_id=excluded.sender_id,recipient_id=excluded.recipient_id,room_id=excluded.room_id,created_at=excluded.created_at,updated_at=excluded.updated_at,friends_at=NULL,cooldown_until=NULL`,
          row.id, low, high, row.status, row.revision, row.greeting_id, user.id, other, roomId, timestamp, timestamp),
        stmt('DELETE FROM event_community_greetings WHERE pair_id=?',row.id),
        ...(communityId?[stmt('INSERT INTO event_community_greetings(pair_id,community_id,greeting_id) VALUES(?,?,?)',row.id,communityId,row.greeting_id)]:[]),
      ] };
    });
  }

  const respond = new RegExp(`^/greetings/(${ID})/(accept|reject|cancel)$`).exec(path);
  if (method === 'POST' && respond) {
    const data = await readJSON(request); keys(data, ['revision']);
    return mutate(data, async () => {
      const row = await get('SELECT * FROM event_social_pairs WHERE greeting_id = ? AND (low_id = ? OR high_id = ?)', respond[1], user.id, user.id);
      if (!row || !await get(`SELECT 1 AS ok WHERE ${socialAllowedSQL('?', '?')}`, user.id, row.low_id === user.id ? row.high_id : row.low_id, row.low_id === user.id ? row.high_id : row.low_id, user.id)) fail(404, 'GREETING_NOT_FOUND', '招呼不存在或已不可用。');
      const action = respond[2], other = row.low_id === user.id ? row.high_id : row.low_id;
      if (action === 'cancel' ? row.sender_id !== user.id : row.recipient_id !== user.id) fail(403, 'GREETING_ROLE_REQUIRED', '只有本人可以回应或撤回这条招呼。');
      revision(row, data.revision);
      if (row.status !== 'pending') fail(409, 'GREETING_RESOLVED', '这条招呼已经处理，请刷新。');
      const updated = { ...row, status: { accept: 'accepted', reject: 'rejected', cancel: 'cancelled' }[action], revision: row.revision + 1, updated_at: now(), friends_at: action === 'accept' ? now() : null, cooldown_until: action === 'accept' ? null : new Date(clock() + COOLDOWN_MS).toISOString() };
      const context=await get('SELECT community_id FROM event_community_greetings WHERE pair_id=? AND greeting_id=?',row.id,row.greeting_id);
      const willingness=context?{sql:communityWillingnessSQL(),args:[context.community_id,user.id,other]}:{sql:openParticipationSQL('?','?','?'),args:[row.room_id,user.id,other]};
      if(action==='accept'&&!await get(`SELECT 1 AS ok WHERE ${willingness.sql}`,...willingness.args))fail(409,'PARTICIPATION_QUIET','参与方式有变化，暂时不能接受。');
      const profile = await peer(other);
      return { body: { greeting: greetingJSON(updated, profile), ...(action === 'accept' ? { friend: friendJSON(updated, profile) } : {}) },
        guard: combine(pairGuard(row, other), unblocked(other), ...(action==='accept'?[willingness]:[])), statements: [
          stmt('UPDATE event_social_pairs SET status = ?,revision = revision + 1,updated_at = ?,friends_at = ?,cooldown_until = ? WHERE id = ? AND revision = ?', updated.status, updated.updated_at, updated.friends_at, updated.cooldown_until, row.id, row.revision),
        ] };
    });
  }

  const friendship = new RegExp(`^/friends/(${ID})$`).exec(path);
  if (method === 'DELETE' && friendship) {
    const data = await readJSON(request); keys(data, ['revision']); validPeer(friendship[1]);
    return mutate(data, async () => {
      const other = friendship[1], privacy = await allowed(other), row = await pair(other);
      if (!row || row.status !== 'accepted') fail(404, 'FRIEND_NOT_FOUND', '好友关系不存在。');
      revision(row, data.revision);
      return { body: { removed: true, userId: other }, guard: combine(pairGuard(row, other), privacy), statements: [
        stmt("UPDATE event_social_pairs SET status='removed',revision=revision+1,updated_at=?,friends_at=NULL WHERE id=? AND revision=?", now(), row.id, row.revision),
      ] };
    });
  }

  const blocking = new RegExp(`^/blocks/(${ID})$`).exec(path);
  if (blocking && ['POST', 'DELETE'].includes(method)) {
    const data = await readJSON(request); keys(data, method === 'POST' ? [] : ['revision']); validPeer(blocking[1]);
    return mutate(data, async () => {
      const other = blocking[1], previous = await get('SELECT * FROM event_social_blocks WHERE actor_id=? AND target_id=?', user.id, other);
      const guard = previous ? { sql: 'EXISTS (SELECT 1 FROM event_social_blocks WHERE actor_id=? AND target_id=? AND revision=?)', args: [user.id, other, previous.revision] }
        : { sql: 'NOT EXISTS (SELECT 1 FROM event_social_blocks WHERE actor_id=? AND target_id=?)', args: [user.id, other] };
      if (method === 'DELETE') {
        if (!previous || previous.unblocked_at) fail(404, 'BLOCK_NOT_FOUND', '这条屏蔽已不存在。');
        revision(previous, data.revision);
        return { body: { unblocked: true, userId: other }, guard, statements: [
          stmt('UPDATE event_social_blocks SET unblocked_at=?,revision=revision+1 WHERE actor_id=? AND target_id=? AND revision=?', now(), user.id, other, previous.revision),
        ] };
      }
      const known = { sql: `EXISTS (SELECT 1 FROM event_social_pairs WHERE low_id=? AND high_id=?) OR EXISTS
        (SELECT 1 FROM event_members a JOIN event_members b ON b.room_id=a.room_id WHERE a.user_id=? AND b.user_id=?)`, args: [...pairIds(user.id, other), user.id, other] };
      if (!await get(`SELECT 1 AS ok WHERE ${known.sql}`, ...known.args)) fail(404, 'PERSON_UNAVAILABLE', '当前无法与这位成员互动。');
      const timestamp = now(), row = { target_id: other, revision: (previous?.revision || 0) + 1, created_at: previous && !previous.unblocked_at ? previous.created_at : timestamp };
      const [low, high] = pairIds(user.id, other);
      return { body: { block: blockJSON(row, await peer(other)) }, guard: combine(guard, known), statements: [
        stmt(`INSERT INTO event_social_blocks (actor_id,target_id,revision,created_at,unblocked_at) VALUES (?,?,?,?,NULL)
          ON CONFLICT(actor_id,target_id) DO UPDATE SET revision=excluded.revision,created_at=excluded.created_at,unblocked_at=NULL`, user.id, other, row.revision, row.created_at),
        // Deliberately unconditional with respect to the pair revision: if a send
        // or accept commits just before this batch, blocking still neutralizes it.
        stmt(`INSERT INTO event_social_pairs (id,low_id,high_id,status,revision,created_at,updated_at) VALUES (?,?,?,'blocked',1,?,?)
          ON CONFLICT(low_id,high_id) DO UPDATE SET status='blocked',revision=event_social_pairs.revision+1,updated_at=excluded.updated_at,friends_at=NULL`, randomUUID(), low, high, timestamp, timestamp),
        ...endExchanges('low_id = ? AND high_id = ?', [low, high]),
      ] };
    });
  }
  return null;
}
