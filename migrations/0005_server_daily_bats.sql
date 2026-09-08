ALTER TABLE game_sessions ADD COLUMN player_id TEXT;
ALTER TABLE scores ADD COLUMN player_id TEXT;

CREATE INDEX IF NOT EXISTS scores_player_day_idx
  ON scores(player_id, played_at DESC);
