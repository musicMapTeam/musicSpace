CREATE TABLE event_worldcups (
 id TEXT PRIMARY KEY, kind TEXT NOT NULL CHECK(kind IN ('room','community')),
 scope_id TEXT NOT NULL, creator_id TEXT NOT NULL REFERENCES avatar_users(id),
 creator_name TEXT NOT NULL, title TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE INDEX event_worldcup_scope ON event_worldcups(kind,scope_id,created_at);
CREATE TABLE event_worldcup_matches (
 id TEXT PRIMARY KEY, cup_id TEXT NOT NULL REFERENCES event_worldcups(id),
 ordinal INTEGER NOT NULL CHECK(ordinal BETWEEN 0 AND 2),
 left_id TEXT NOT NULL, right_id TEXT NOT NULL, winner_id TEXT,
 left_count INTEGER, right_count INTEGER, tie_reason TEXT, revision INTEGER NOT NULL DEFAULT 1,
 UNIQUE(cup_id,ordinal), CHECK(left_id!=right_id),
 CHECK(winner_id IS NULL OR winner_id IN (left_id,right_id))
);
CREATE TABLE event_worldcup_votes (
 match_id TEXT NOT NULL REFERENCES event_worldcup_matches(id),
 user_id TEXT NOT NULL REFERENCES avatar_users(id), album_id TEXT NOT NULL,
 created_at TEXT NOT NULL, PRIMARY KEY(match_id,user_id)
);
