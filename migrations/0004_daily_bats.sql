ALTER TABLE game_sessions ADD COLUMN bat_type TEXT NOT NULL DEFAULT 'basic'
  CHECK(bat_type IN ('basic', 'gold', 'diamond'));
