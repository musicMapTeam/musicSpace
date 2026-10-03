CREATE TABLE event_music_topics (
 id TEXT PRIMARY KEY,kind TEXT NOT NULL CHECK(kind IN ('room','community')),scope_id TEXT NOT NULL,
 author_id TEXT NOT NULL REFERENCES avatar_users(id),author_name TEXT NOT NULL,
 title TEXT NOT NULL CHECK(length(title) BETWEEN 1 AND 80),artist TEXT NOT NULL CHECK(length(artist)<=80),
 note TEXT NOT NULL CHECK(length(note) BETWEEN 1 AND 300),revision INTEGER NOT NULL DEFAULT 1 CHECK(revision>=1),created_at TEXT NOT NULL,withdrawn_at TEXT
);
CREATE INDEX event_music_topic_scope ON event_music_topics(kind,scope_id,created_at,id);
CREATE TABLE event_worldcup_entries (
 cup_id TEXT NOT NULL REFERENCES event_worldcups(id),id TEXT NOT NULL,title TEXT NOT NULL CHECK(length(title) BETWEEN 1 AND 80),artist TEXT NOT NULL CHECK(length(artist)<=80),
 ordinal INTEGER NOT NULL CHECK(ordinal BETWEEN 0 AND 3),PRIMARY KEY(cup_id,id),UNIQUE(cup_id,ordinal)
);
CREATE TABLE event_games (
 id TEXT PRIMARY KEY,kind TEXT NOT NULL CHECK(kind IN ('room','community')),scope_id TEXT NOT NULL,
 creator_id TEXT NOT NULL REFERENCES avatar_users(id),creator_name TEXT NOT NULL,type TEXT NOT NULL CHECK(type IN ('preference','relay')),
 title TEXT NOT NULL CHECK(length(title) BETWEEN 1 AND 40),phase TEXT NOT NULL DEFAULT 'waiting' CHECK(phase IN ('waiting','playing','completed','cancelled')),
 options_json TEXT NOT NULL CHECK(length(options_json)<=4096),round_limit INTEGER NOT NULL CHECK(round_limit BETWEEN 1 AND 6),revision INTEGER NOT NULL DEFAULT 1 CHECK(revision>=1),
 created_at TEXT NOT NULL,updated_at TEXT NOT NULL,finish_reason TEXT
);
CREATE INDEX event_game_scope ON event_games(kind,scope_id,created_at,id);
CREATE TABLE event_game_players (
 game_id TEXT NOT NULL REFERENCES event_games(id),user_id TEXT NOT NULL REFERENCES avatar_users(id),joined_at TEXT NOT NULL,left_at TEXT,player_block_revision INTEGER NOT NULL DEFAULT 0,creator_block_revision INTEGER NOT NULL DEFAULT 0,
 revision INTEGER NOT NULL DEFAULT 1 CHECK(revision>=1),PRIMARY KEY(game_id,user_id)
);
CREATE TABLE event_game_rounds (
 game_id TEXT NOT NULL REFERENCES event_games(id),ordinal INTEGER NOT NULL CHECK(ordinal BETWEEN 1 AND 6),
 status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','revealed','skipped')),turn_user_id TEXT REFERENCES avatar_users(id),revision INTEGER NOT NULL DEFAULT 1 CHECK(revision>=1),
 reason TEXT,PRIMARY KEY(game_id,ordinal)
);
CREATE TABLE event_game_answers (
 game_id TEXT NOT NULL,ordinal INTEGER NOT NULL,user_id TEXT NOT NULL REFERENCES avatar_users(id),author_name TEXT NOT NULL,payload_json TEXT NOT NULL CHECK(length(payload_json)<=2048),created_at TEXT NOT NULL,
 PRIMARY KEY(game_id,ordinal,user_id),FOREIGN KEY(game_id,ordinal) REFERENCES event_game_rounds(game_id,ordinal)
);
CREATE TABLE event_group_context (
 message_id TEXT PRIMARY KEY REFERENCES event_group_messages(id),topic_id TEXT REFERENCES event_music_topics(id),cup_id TEXT REFERENCES event_worldcups(id),game_id TEXT REFERENCES event_games(id),
 CHECK((topic_id IS NOT NULL)+(cup_id IS NOT NULL)+(game_id IS NOT NULL)=1)
);
