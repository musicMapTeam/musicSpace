import { socialAllowedSQL } from './event-social.js';

const ID = '[0-9a-f-]{36}';
export const EVENT_RECAP_PAGE_SIZE = 24;

/** A recap is a current, permission-filtered view, never an attendee archive.
 * UUID cursors are ordering positions only, not proof of access to any row.
 */
export async function handleEventRecap(c) {
  const { request, path, method, user, db, stmt, get, roomJSON, photoJSON, fail, json } = c;
  const route = new RegExp(`^/rooms/(${ID})/recap$`).exec(path);
  if (method !== 'GET' || !route) return null;
  const roomId = route[1], query = [...new URL(request.url).searchParams];
  if (query.length > 2 || new Set(query.map(([key]) => key)).size !== query.length || query.some(([key, value]) => !['photosCursor', 'friendsCursor'].includes(key) || !new RegExp(`^${ID}$`).test(value))) {
    fail(400, 'INVALID_CURSOR', '请为每类内容提供一个有效的分页位置。');
  }
  const cursors = Object.fromEntries(query), collections = ['photos', 'friends'];
  const roomSQL = `SELECT r.*,EXISTS (SELECT 1 FROM event_members WHERE room_id = r.id AND user_id = ? AND left_at IS NULL) AS is_member
    FROM event_rooms r WHERE r.id = ? AND (r.host_id = ? OR EXISTS (SELECT 1 FROM event_members WHERE room_id = r.id AND user_id = ?))`;
  const roomArgs = [user.id, roomId, user.id, user.id];
  if (!await get(roomSQL, ...roomArgs)) fail(404, 'ROOM_NOT_FOUND', '现场不存在，或当前身份没有本场记录。');

  const queries = [stmt(roomSQL, ...roomArgs)];
  for (const kind of collections) {
    const cursor = cursors[`${kind}Cursor`];
    if (kind === 'photos') queries.push(stmt(`SELECT p.* FROM event_photos p WHERE p.room_id = ? AND p.deleted_at IS NULL
      AND (p.owner_id = ? OR (p.visibility = 'members'
        AND EXISTS (SELECT 1 FROM event_members WHERE room_id = p.room_id AND user_id = ? AND left_at IS NULL)
        AND EXISTS (SELECT 1 FROM event_members WHERE room_id = p.room_id AND user_id = p.owner_id AND left_at IS NULL)
        AND ${socialAllowedSQL('?', 'p.owner_id')}))${cursor ? ' AND p.id > ?' : ''}
      ORDER BY p.id LIMIT ${EVENT_RECAP_PAGE_SIZE + 1}`, roomId, user.id, user.id, user.id, user.id, ...(cursor ? [cursor] : [])));
    else queries.push(stmt(`SELECT s.*,u.id AS peer_id,u.name AS peer_name,u.avatar AS peer_avatar
      FROM event_social_pairs s JOIN avatar_users u ON u.id = CASE WHEN s.low_id = ? THEN s.high_id ELSE s.low_id END
      WHERE s.room_id = ? AND NOT EXISTS(SELECT 1 FROM event_community_greetings g WHERE g.pair_id=s.id AND g.greeting_id=s.greeting_id) AND (s.low_id = ? OR s.high_id = ?) AND s.status = 'accepted' AND ${socialAllowedSQL('?', 'u.id')}${cursor ? ' AND s.id > ?' : ''}
      ORDER BY s.id LIMIT ${EVENT_RECAP_PAGE_SIZE + 1}`, user.id, roomId, user.id, user.id, user.id, user.id, ...(cursor ? [cursor] : [])));
  }
  // Recheck room participation and all photo/friend permissions in one final
  // SQLite/D1 snapshot. A leave, withdrawal, removal or block committed after
  // the initial history check must govern this response as well.
  const results = await db.batch(queries), room = results[0].results[0];
  if (!room) fail(404, 'ROOM_NOT_FOUND', '现场不存在，或当前身份没有本场记录。');
  const body = { actorId: user.id, room: roomJSON(room, user.id, Boolean(room.is_member)) };
  for (const [index, kind] of collections.entries()) {
    const rows = results[index + 1].results;
    body[kind] = {
      items: rows.slice(0, EVENT_RECAP_PAGE_SIZE).map(row => kind === 'photos' ? photoJSON(row) : {
        id: row.id, userId: row.peer_id, roomId: row.room_id, revision: row.revision, since: row.friends_at,
        peer: { id: row.peer_id, name: row.peer_name, avatar: JSON.parse(row.peer_avatar) },
      }),
      nextCursor: rows.length > EVENT_RECAP_PAGE_SIZE ? rows[EVENT_RECAP_PAGE_SIZE - 1].id : null,
    };
  }
  return json(200, body);
}
