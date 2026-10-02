// Initial migration generated 2026-09-30 with drizzle-kit 0.31.10 and drizzle-orm 0.45.2.
// Keep applied drizzle SQL and matching metadata immutable; append later migrations.
import { sql } from 'drizzle-orm';
import { sqliteTable, text, integer, index, uniqueIndex, check, primaryKey, foreignKey } from 'drizzle-orm/sqlite-core';

export const avatarMeta = sqliteTable('avatar_meta', {
  key: text('key').primaryKey(), value: text('value').notNull(),
});
export const avatarUsers = sqliteTable('avatar_users', {
  id: text('id').primaryKey(), name: text('name').notNull(), avatar: text('avatar').notNull(),
  tokenHash: text('token_hash').notNull().unique(), revision: integer('revision').notNull().default(1),
  createdAt: text('created_at').notNull(),
});
export const avatarCompositions = sqliteTable('avatar_compositions', {
  id: text('id').primaryKey(), hostId: text('host_id').notNull().references(() => avatarUsers.id),
  guestId: text('guest_id').references(() => avatarUsers.id), snapshot: text('snapshot').notNull(),
  revision: integer('revision').notNull(), contentRevision: integer('content_revision').notNull(),
  photoKey: text('photo_key'), inviteHash: text('invite_hash').unique(), inviteExpiresAt: text('invite_expires_at'),
  createdAt: text('created_at').notNull(), updatedAt: text('updated_at').notNull(),
}, table => [
  check('avatar_distinct_identities', sql`${table.guestId} IS NULL OR ${table.hostId} != ${table.guestId}`),
  index('avatar_host').on(table.hostId, table.updatedAt), index('avatar_guest').on(table.guestId, table.updatedAt),
  index('avatar_photo').on(table.photoKey).where(sql`${table.photoKey} IS NOT NULL`),
]);
export const avatarIdempotency = sqliteTable('avatar_idempotency', {
  actorId: text('actor_id').notNull(), keyHash: text('key_hash').notNull(), requestHash: text('request_hash').notNull(),
  status: integer('status').notNull(), response: text('response').notNull(), capabilityKind: text('capability_kind'),
  createdAt: text('created_at').notNull(),
}, table => [primaryKey({ columns: [table.actorId, table.keyHash] })]);
export const avatarMutationGuard = sqliteTable('avatar_mutation_guard', {
  id: text('id').primaryKey(), assertion: integer('assertion').notNull(),
}, table => [check('avatar_mutation_guard_assertion', sql`${table.assertion} = 1`)]);
export const avatarRateLimits = sqliteTable('avatar_rate_limits', {
  key: text('key').primaryKey(), count: integer('count').notNull(), resetAt: integer('reset_at').notNull(),
});

// Event rooms deliberately do not reference avatar composition invitations.
export const eventRooms = sqliteTable('event_rooms', {
  id: text('id').primaryKey(), code: text('code').notNull().unique(),
  hostId: text('host_id').notNull().references(() => avatarUsers.id),
  title: text('title').notNull(), venue: text('venue').notNull().default(''), songId: text('song_id').notNull(),
  revision: integer('revision').notNull().default(1), createdAt: text('created_at').notNull(),
  expiresAt: text('expires_at').notNull(), closedAt: text('closed_at'),
}, table => [index('event_room_host').on(table.hostId, table.createdAt)]);
export const eventMembers = sqliteTable('event_members', {
  roomId: text('room_id').notNull().references(() => eventRooms.id),
  userId: text('user_id').notNull().references(() => avatarUsers.id),
  joinedAt: text('joined_at').notNull(), leftAt: text('left_at'),
}, table => [primaryKey({ columns: [table.roomId, table.userId] }), index('event_member_user').on(table.userId, table.leftAt)]);
export const eventPhotos = sqliteTable('event_photos', {
  id: text('id').primaryKey(), roomId: text('room_id').notNull().references(() => eventRooms.id),
  ownerId: text('owner_id').notNull().references(() => avatarUsers.id), photoKey: text('photo_key'),
  visibility: text('visibility').notNull(), revision: integer('revision').notNull().default(1),
  createdAt: text('created_at').notNull(), updatedAt: text('updated_at').notNull(), deletedAt: text('deleted_at'),
}, table => [
  check('event_photo_visibility', sql`${table.visibility} IN ('private', 'members')`),
  check('event_photo_storage', sql`(${table.deletedAt} IS NULL AND ${table.photoKey} IS NOT NULL) OR (${table.deletedAt} IS NOT NULL AND ${table.photoKey} IS NULL)`),
  index('event_photo_room').on(table.roomId, table.deletedAt), index('event_photo_owner').on(table.ownerId, table.createdAt),
  index('event_photo_key').on(table.photoKey).where(sql`${table.photoKey} IS NOT NULL`),
]);
export const eventIdempotency = sqliteTable('event_idempotency', {
  actorId: text('actor_id').notNull(), keyHash: text('key_hash').notNull(), requestHash: text('request_hash').notNull(),
  status: integer('status').notNull(), response: text('response').notNull(), createdAt: text('created_at').notNull(),
}, table => [primaryKey({ columns: [table.actorId, table.keyHash] })]);
export const eventMutationGuard = sqliteTable('event_mutation_guard', {
  id: text('id').primaryKey(), assertion: integer('assertion').notNull(),
}, table => [check('event_mutation_guard_assertion', sql`${table.assertion} = 1`)]);
export const eventRateLimits = sqliteTable('event_rate_limits', {
  key: text('key').primaryKey(), count: integer('count').notNull(), resetAt: integer('reset_at').notNull(),
}, table => [index('event_rate_expiry').on(table.resetAt)]);


// The canonical pair serializes both directions. Friendships never grant photos.
export const eventSocialPairs = sqliteTable('event_social_pairs', {
  id: text('id').primaryKey(), lowId: text('low_id').notNull().references(() => avatarUsers.id),
  highId: text('high_id').notNull().references(() => avatarUsers.id), status: text('status').notNull(),
  revision: integer('revision').notNull().default(1), greetingId: text('greeting_id').unique(),
  senderId: text('sender_id').references(() => avatarUsers.id), recipientId: text('recipient_id').references(() => avatarUsers.id),
  roomId: text('room_id').references(() => eventRooms.id), createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(), friendsAt: text('friends_at'), cooldownUntil: text('cooldown_until'),
}, table => [
  uniqueIndex('event_social_pair_unique').on(table.lowId, table.highId),
  check('event_social_pair_order', sql`${table.lowId} < ${table.highId}`),
  check('event_social_revision', sql`${table.revision} >= 1`),
  check('event_social_status', sql`${table.status} IN ('pending','accepted','rejected','cancelled','removed','blocked')`),
  check('event_social_friend_time', sql`(${table.status} = 'accepted') = (${table.friendsAt} IS NOT NULL)`),
  check('event_social_participants', sql`${table.status} = 'blocked' OR (${table.greetingId} IS NOT NULL AND ${table.roomId} IS NOT NULL AND ${table.senderId} IS NOT NULL AND ${table.recipientId} IS NOT NULL AND ((${table.senderId} = ${table.lowId} AND ${table.recipientId} = ${table.highId}) OR (${table.senderId} = ${table.highId} AND ${table.recipientId} = ${table.lowId})))`),
  index('event_social_incoming').on(table.recipientId, table.status, table.greetingId),
  index('event_social_outgoing').on(table.senderId, table.status, table.greetingId),
  index('event_social_low').on(table.lowId, table.status, table.id),
  index('event_social_high').on(table.highId, table.status, table.id),
]);
export const eventSocialBlocks = sqliteTable('event_social_blocks', {
  actorId: text('actor_id').notNull().references(() => avatarUsers.id),
  targetId: text('target_id').notNull().references(() => avatarUsers.id), revision: integer('revision').notNull().default(1),
  createdAt: text('created_at').notNull(), unblockedAt: text('unblocked_at'),
}, table => [
  primaryKey({ columns: [table.actorId, table.targetId] }),
  check('event_social_block_distinct', sql`${table.actorId} != ${table.targetId}`),
  check('event_social_block_revision', sql`${table.revision} >= 1`),
  index('event_social_block_target').on(table.targetId, table.unblockedAt, table.actorId),
]);

// One text-only thread per canonical social pair; no attachment/photo capability.
export const eventChatThreads = sqliteTable('event_chat_threads', {
  pairId: text('pair_id').primaryKey().references(() => eventSocialPairs.id),
  lowProfile: text('low_profile').notNull(), highProfile: text('high_profile').notNull(),
  createdAt: text('created_at').notNull(), updatedAt: text('updated_at').notNull(),
});
export const eventChatMessages = sqliteTable('event_chat_messages', {
  seq: integer('seq').primaryKey({ autoIncrement: true }), id: text('id').notNull().unique(),
  pairId: text('pair_id').notNull().references(() => eventChatThreads.pairId),
  senderId: text('sender_id').notNull().references(() => avatarUsers.id),
  recipientId: text('recipient_id').notNull().references(() => avatarUsers.id),
  text: text('text').notNull(), createdAt: text('created_at').notNull(),
}, table => [
  check('event_chat_distinct', sql`${table.senderId} != ${table.recipientId}`),
  check('event_chat_text_length', sql`length(${table.text}) BETWEEN 1 AND 1000`),
  index('event_chat_pair_sequence').on(table.pairId, table.seq),
  index('event_chat_recipient').on(table.pairId, table.recipientId, table.seq),
]);
export const eventChatReceipts = sqliteTable('event_chat_receipts', {
  messageId: text('message_id').notNull().references(() => eventChatMessages.id),
  viewerId: text('viewer_id').notNull().references(() => avatarUsers.id),
  deliveredAt: text('delivered_at').notNull(), readAt: text('read_at'),
}, table => [primaryKey({ columns: [table.messageId, table.viewerId] })]);

// Exact-photo exchanges keep bounded previews separate from two directed grants.
export const eventExchanges = sqliteTable('event_exchanges', {
  id: text('id').primaryKey(), roomId: text('room_id').notNull().references(() => eventRooms.id),
  senderId: text('sender_id').notNull().references(() => avatarUsers.id), recipientId: text('recipient_id').notNull().references(() => avatarUsers.id),
  offeredPhotoId: text('offered_photo_id').notNull().references(() => eventPhotos.id), requestedPhotoId: text('requested_photo_id').notNull().references(() => eventPhotos.id),
  offeredRevision: integer('offered_revision').notNull(), requestedRevision: integer('requested_revision').notNull(),
  lowId: text('low_id').notNull().references(() => avatarUsers.id), highId: text('high_id').notNull().references(() => avatarUsers.id),
  lowPhotoId: text('low_photo_id').notNull().references(() => eventPhotos.id), highPhotoId: text('high_photo_id').notNull().references(() => eventPhotos.id),
  senderProfile: text('sender_profile').notNull(), recipientProfile: text('recipient_profile').notNull(), previewKey: text('preview_key').notNull(),
  status: text('status').notNull(), revision: integer('revision').notNull().default(1),
  createdAt: text('created_at').notNull(), updatedAt: text('updated_at').notNull(), expiresAt: text('expires_at').notNull(),
  acceptedAt: text('accepted_at'), endedAt: text('ended_at'), endReason: text('end_reason'),
}, table => [
  check('event_exchange_participants', sql`${table.lowId} < ${table.highId} AND ((${table.senderId} = ${table.lowId} AND ${table.recipientId} = ${table.highId}) OR (${table.senderId} = ${table.highId} AND ${table.recipientId} = ${table.lowId}))`),
  check('event_exchange_photos', sql`${table.lowPhotoId} < ${table.highPhotoId} AND ((${table.offeredPhotoId} = ${table.lowPhotoId} AND ${table.requestedPhotoId} = ${table.highPhotoId}) OR (${table.offeredPhotoId} = ${table.highPhotoId} AND ${table.requestedPhotoId} = ${table.lowPhotoId}))`),
  check('event_exchange_revision', sql`${table.revision} >= 1 AND ${table.offeredRevision} >= 1 AND ${table.requestedRevision} >= 1`),
  check('event_exchange_status', sql`${table.status} IN ('pending','accepted','declined','cancelled','revoked','expired')`),
  check('event_exchange_end', sql`(${table.status} IN ('pending','accepted') AND ${table.endedAt} IS NULL AND ${table.endReason} IS NULL) OR (${table.status} NOT IN ('pending','accepted') AND ${table.endedAt} IS NOT NULL AND ${table.endReason} IN ('declined','cancelled','revoked','expired','unavailable'))`),
  check('event_exchange_accept', sql`(${table.status} IN ('accepted','revoked')) = (${table.acceptedAt} IS NOT NULL)`),
  uniqueIndex('event_exchange_pending_pair').on(table.roomId, table.lowId, table.highId).where(sql`${table.status} = 'pending'`),
  uniqueIndex('event_exchange_live_photos').on(table.lowPhotoId, table.highPhotoId).where(sql`${table.status} IN ('pending','accepted')`),
  index('event_exchange_sender').on(table.senderId, table.createdAt, table.id), index('event_exchange_recipient').on(table.recipientId, table.createdAt, table.id),
  index('event_exchange_offered').on(table.offeredPhotoId, table.status), index('event_exchange_requested').on(table.requestedPhotoId, table.status),
  index('event_exchange_preview').on(table.previewKey),
]);
export const eventExchangeGrants = sqliteTable('event_exchange_grants', {
  exchangeId: text('exchange_id').notNull().references(() => eventExchanges.id), photoId: text('photo_id').notNull().references(() => eventPhotos.id),
  ownerId: text('owner_id').notNull().references(() => avatarUsers.id), viewerId: text('viewer_id').notNull().references(() => avatarUsers.id),
  createdAt: text('created_at').notNull(), revokedAt: text('revoked_at'),
}, table => [
  primaryKey({ columns: [table.exchangeId, table.photoId] }),
  check('event_exchange_grant_distinct', sql`${table.ownerId} != ${table.viewerId}`),
  index('event_exchange_grant_viewer').on(table.viewerId, table.photoId, table.revokedAt),
]);

// Local room feedback is handled only by its host; reports do not grant media.
export const eventReports = sqliteTable('event_reports', {
  id: text('id').primaryKey(), roomId: text('room_id').notNull().references(() => eventRooms.id),
  reporterId: text('reporter_id').notNull().references(() => avatarUsers.id), targetId: text('target_id').notNull().references(() => avatarUsers.id),
  photoId: text('photo_id').references(() => eventPhotos.id), targetName: text('target_name').notNull(),
  category: text('category').notNull(), details: text('details').notNull(), status: text('status').notNull().default('open'),
  revision: integer('revision').notNull().default(1), createdAt: text('created_at').notNull(), updatedAt: text('updated_at').notNull(), resolvedAt: text('resolved_at'),
}, table => [
  check('event_report_distinct', sql`${table.reporterId} != ${table.targetId}`),
  check('event_report_category', sql`${table.category} IN ('harassment','unwanted-content','privacy','spam','other')`),
  check('event_report_details', sql`length(${table.details}) BETWEEN 1 AND 280`),
  check('event_report_status', sql`${table.status} IN ('open','withdrawn','resolved','dismissed')`),
  check('event_report_resolution', sql`(${table.status} = 'open') = (${table.resolvedAt} IS NULL)`),
  check('event_report_revision', sql`${table.revision} >= 1`),
  uniqueIndex('event_report_open_target').on(table.roomId, table.reporterId, table.targetId).where(sql`${table.status} = 'open'`),
  index('event_report_room').on(table.roomId, table.createdAt, table.id), index('event_report_owner').on(table.reporterId, table.createdAt, table.id),
]);
export const eventRoomExclusions = sqliteTable('event_room_exclusions', {
  roomId: text('room_id').notNull().references(() => eventRooms.id), userId: text('user_id').notNull().references(() => avatarUsers.id),
  targetName: text('target_name').notNull(), revision: integer('revision').notNull().default(1),
  createdAt: text('created_at').notNull(), updatedAt: text('updated_at').notNull(), restoredAt: text('restored_at'),
}, table => [primaryKey({ columns: [table.roomId, table.userId] }),check('event_exclusion_revision',sql`${table.revision} >= 1`)]);

// Participation is scoped to a room; it is not real identity or physical presence.
export const eventParticipation = sqliteTable('event_participation', {
  roomId: text('room_id').notNull(), userId: text('user_id').notNull(),
  mode: text('mode').notNull().default('quiet'), revision: integer('revision').notNull().default(1),
  updatedAt: text('updated_at').notNull(),
}, table => [
  primaryKey({ columns: [table.roomId, table.userId] }),
  foreignKey({ columns: [table.roomId, table.userId], foreignColumns: [eventMembers.roomId, eventMembers.userId] }),
  check('event_participation_mode', sql`${table.mode} IN ('quiet','open')`),
  check('event_participation_revision', sql`${table.revision} >= 1`),
]);

// Chat memberships are explicit and independent of event photo membership.
export const eventCommunities = sqliteTable('event_communities', {
 id:text('id').primaryKey(),code:text('code').notNull().unique(),hostId:text('host_id').notNull().references(()=>avatarUsers.id),title:text('title').notNull(),createdAt:text('created_at').notNull(),
});
export const eventCommunityRooms = sqliteTable('event_community_rooms', {
 roomId:text('room_id').primaryKey().references(()=>eventRooms.id),communityId:text('community_id').notNull().references(()=>eventCommunities.id),
});
export const eventConversationMembers = sqliteTable('event_conversation_members', {
 kind:text('kind').notNull(),scopeId:text('scope_id').notNull(),userId:text('user_id').notNull().references(()=>avatarUsers.id),joinedAt:text('joined_at').notNull(),leftAt:text('left_at'),removedAt:text('removed_at'),mode:text('mode').notNull().default('quiet'),muted:integer('muted').notNull().default(0),revision:integer('revision').notNull().default(1),
}, t=>[primaryKey({columns:[t.kind,t.scopeId,t.userId]}),check('event_conversation_kind',sql`${t.kind} IN ('room','community')`),check('event_conversation_muted',sql`${t.muted} IN (0,1)`),check('event_conversation_mode',sql`${t.mode} IN ('quiet','open')`)]);
export const eventGroupMessages = sqliteTable('event_group_messages', {
 seq:integer('seq').primaryKey({autoIncrement:true}),id:text('id').notNull().unique(),kind:text('kind').notNull(),scopeId:text('scope_id').notNull(),senderId:text('sender_id').notNull().references(()=>avatarUsers.id),senderName:text('sender_name').notNull(),text:text('text').notNull(),replyId:text('reply_id'),createdAt:text('created_at').notNull(),hiddenAt:text('hidden_at'),
},t=>[foreignKey({columns:[t.replyId],foreignColumns:[t.id]}),check('event_group_kind',sql`${t.kind} IN ('room','community')`),check('event_group_text',sql`length(${t.text}) BETWEEN 1 AND 1000`),index('event_group_scope').on(t.kind,t.scopeId,t.seq)]);
export const eventGroupReceipts = sqliteTable('event_group_receipts', {
 messageId:text('message_id').notNull().references(()=>eventGroupMessages.id),viewerId:text('viewer_id').notNull().references(()=>avatarUsers.id),deliveredAt:text('delivered_at').notNull(),readAt:text('read_at'),
},t=>[primaryKey({columns:[t.messageId,t.viewerId]})]);

export const eventCommunityGreetings = sqliteTable('event_community_greetings',{pairId:text('pair_id').primaryKey().references(()=>eventSocialPairs.id),communityId:text('community_id').notNull().references(()=>eventCommunities.id),greetingId:text('greeting_id').notNull()});

export const eventGroupMusic = sqliteTable('event_group_music',{
 messageId:text('message_id').primaryKey().references(()=>eventGroupMessages.id),recordingId:text('recording_id').notNull(),
},t=>[check('event_group_music_reference',sql`length(${t.recordingId}) BETWEEN 1 AND 80`)]);
