CREATE TABLE IF NOT EXISTS game_sessions (
  id TEXT PRIMARY KEY,
  nickname TEXT NOT NULL CHECK(length(nickname) BETWEEN 1 AND 10),
  pitch_number INTEGER NOT NULL DEFAULT 0 CHECK(pitch_number BETWEEN 0 AND 10),
  pitch_type TEXT,
  pitch_duration INTEGER,
  contact_at INTEGER,
  score INTEGER NOT NULL DEFAULT 0,
  combo INTEGER NOT NULL DEFAULT 0,
  max_combo INTEGER NOT NULL DEFAULT 0,
  home_runs INTEGER NOT NULL DEFAULT 0,
  max_distance INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  completed_at INTEGER,
  share_card_id TEXT UNIQUE
);

CREATE INDEX IF NOT EXISTS game_sessions_created_idx ON game_sessions(created_at);
ALTER TABLE share_cards ADD COLUMN session_id TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS share_cards_session_idx ON share_cards(session_id) WHERE session_id IS NOT NULL;
ALTER TABLE scores ADD COLUMN session_id TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS scores_session_idx ON scores(session_id) WHERE session_id IS NOT NULL;
