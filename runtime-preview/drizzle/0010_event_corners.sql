CREATE TABLE event_corners (
 id TEXT PRIMARY KEY, pair_id TEXT NOT NULL REFERENCES event_social_pairs(id), pair_revision INTEGER NOT NULL,
 low_block_revision INTEGER NOT NULL, high_block_revision INTEGER NOT NULL,
 a_id TEXT NOT NULL REFERENCES avatar_users(id), b_id TEXT NOT NULL REFERENCES avatar_users(id),
 status TEXT NOT NULL DEFAULT 'invited' CONSTRAINT event_corner_status CHECK(status IN ('invited','active','withdrawn')),
 b_joined INTEGER NOT NULL DEFAULT 0 CONSTRAINT event_corner_joined CHECK(b_joined IN (0,1)), revision INTEGER NOT NULL DEFAULT 1 CONSTRAINT event_corner_revision CHECK(revision>=1),
 a_confirm INTEGER, b_confirm INTEGER, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, CONSTRAINT event_corner_distinct CHECK(a_id!=b_id)
);
CREATE UNIQUE INDEX event_corner_active_pair ON event_corners(pair_id,pair_revision,low_block_revision,high_block_revision) WHERE status!='withdrawn';
CREATE TABLE event_corner_contributions (
 corner_id TEXT NOT NULL REFERENCES event_corners(id), user_id TEXT NOT NULL REFERENCES avatar_users(id),
 author_name TEXT NOT NULL, avatar TEXT NOT NULL, note TEXT NOT NULL DEFAULT '' CONSTRAINT event_corner_note CHECK(length(note)<=200),
 photo_id TEXT REFERENCES event_photos(id), photo_revision INTEGER, PRIMARY KEY(corner_id,user_id),
 CONSTRAINT event_corner_photo_reference CHECK((photo_id IS NULL AND photo_revision IS NULL) OR (photo_id IS NOT NULL AND photo_revision>=1))
);
CREATE TABLE event_corner_saves (
 id TEXT PRIMARY KEY, corner_id TEXT NOT NULL REFERENCES event_corners(id), user_id TEXT NOT NULL REFERENCES avatar_users(id),
 content_revision INTEGER NOT NULL, created_at TEXT NOT NULL, UNIQUE(corner_id,user_id,content_revision)
);
