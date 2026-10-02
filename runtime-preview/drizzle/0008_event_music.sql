-- Public music references inherit their message's membership/block/retraction gates.
CREATE TABLE event_group_music (
 message_id TEXT PRIMARY KEY NOT NULL REFERENCES event_group_messages(id),
 recording_id TEXT NOT NULL CHECK(length(recording_id) BETWEEN 1 AND 80)
);
