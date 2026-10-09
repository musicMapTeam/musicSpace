ALTER TABLE event_communities ADD COLUMN description TEXT NOT NULL DEFAULT '' CHECK(length(description)<=300);
ALTER TABLE event_communities ADD COLUMN archived_at TEXT;
ALTER TABLE event_communities ADD COLUMN revision INTEGER NOT NULL DEFAULT 1 CHECK(revision>=1);
CREATE TABLE event_community_events (
 id TEXT PRIMARY KEY, community_id TEXT NOT NULL REFERENCES event_communities(id),
 title TEXT NOT NULL CHECK(length(title) BETWEEN 1 AND 40),
 venue TEXT NOT NULL CHECK(length(venue)<=40), starts_at INTEGER,
 note TEXT NOT NULL DEFAULT '' CHECK(length(note)<=300),
 status TEXT NOT NULL DEFAULT 'planned' CHECK(status IN ('planned','linked','cancelled')),
 room_id TEXT UNIQUE REFERENCES event_rooms(id), revision INTEGER NOT NULL DEFAULT 1 CHECK(revision>=1),
 created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
 CHECK((status='linked' AND room_id IS NOT NULL) OR (status!='linked' AND room_id IS NULL))
);
CREATE INDEX event_community_event_order ON event_community_events(community_id,created_at,id);
