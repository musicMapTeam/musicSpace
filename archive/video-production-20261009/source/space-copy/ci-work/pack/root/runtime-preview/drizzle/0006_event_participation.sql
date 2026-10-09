CREATE TABLE event_participation (
  room_id text NOT NULL,
  user_id text NOT NULL,
  mode text NOT NULL DEFAULT 'quiet',
  revision integer NOT NULL DEFAULT 1,
  updated_at text NOT NULL,
  PRIMARY KEY (room_id,user_id),
  FOREIGN KEY (room_id,user_id) REFERENCES event_members(room_id,user_id),
  CONSTRAINT event_participation_mode CHECK (mode IN ('quiet','open')),
  CONSTRAINT event_participation_revision CHECK (revision >= 1)
);
--> statement-breakpoint
-- A migration never assumes that previous attendance meant social consent.
INSERT OR IGNORE INTO event_participation (room_id,user_id,mode,revision,updated_at)
SELECT room_id,user_id,'quiet',1,joined_at FROM event_members;
--> statement-breakpoint
UPDATE event_social_pairs SET status='cancelled',revision=revision+1,
updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now'),cooldown_until=NULL
WHERE status='pending' AND EXISTS (
  SELECT 1 FROM event_participation p WHERE p.room_id=event_social_pairs.room_id
  AND p.mode='quiet' AND (p.user_id=event_social_pairs.sender_id OR p.user_id=event_social_pairs.recipient_id)
);
