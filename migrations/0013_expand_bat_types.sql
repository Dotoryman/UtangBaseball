DROP TRIGGER IF EXISTS scores_admin_rollup;

CREATE TABLE game_sessions_v113 (
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
  share_card_id TEXT UNIQUE,
  bat_type TEXT NOT NULL DEFAULT 'basic'
    CHECK(bat_type IN ('basic', 'aluminum', 'gold', 'ruby', 'diamond')),
  player_id TEXT,
  misses INTEGER NOT NULL DEFAULT 0,
  fouls INTEGER NOT NULL DEFAULT 0,
  infield_hits INTEGER NOT NULL DEFAULT 0,
  singles INTEGER NOT NULL DEFAULT 0,
  doubles INTEGER NOT NULL DEFAULT 0,
  triples INTEGER NOT NULL DEFAULT 0,
  total_distance INTEGER NOT NULL DEFAULT 0
);

INSERT INTO game_sessions_v113(
  id, nickname, pitch_number, pitch_type, pitch_duration, contact_at,
  score, combo, max_combo, home_runs, max_distance, created_at, completed_at,
  share_card_id, bat_type, player_id, misses, fouls, infield_hits, singles,
  doubles, triples, total_distance
)
SELECT
  id, nickname, pitch_number, pitch_type, pitch_duration, contact_at,
  score, combo, max_combo, home_runs, max_distance, created_at, completed_at,
  share_card_id, bat_type, player_id, misses, fouls, infield_hits, singles,
  doubles, triples, total_distance
FROM game_sessions;

DROP TABLE game_sessions;
ALTER TABLE game_sessions_v113 RENAME TO game_sessions;
CREATE INDEX game_sessions_created_idx ON game_sessions(created_at);

CREATE TRIGGER scores_admin_rollup AFTER INSERT ON scores
BEGIN
  INSERT INTO daily_stats(
    day_start, completed_games, total_score, max_score, home_runs, misses, fouls,
    infield_hits, singles, doubles, triples, total_distance, max_distance, sum_max_combo, max_combo
  ) VALUES (
    CAST((NEW.played_at + 32400000) / 86400000 AS INTEGER) * 86400000 - 32400000,
    1, NEW.score, NEW.score, NEW.home_runs, NEW.misses, NEW.fouls,
    NEW.infield_hits, NEW.singles, NEW.doubles, NEW.triples, NEW.total_distance,
    NEW.distance, NEW.max_combo, NEW.max_combo
  )
  ON CONFLICT(day_start) DO UPDATE SET
    completed_games = completed_games + 1,
    total_score = total_score + excluded.total_score,
    max_score = MAX(max_score, excluded.max_score),
    home_runs = home_runs + excluded.home_runs,
    misses = misses + excluded.misses,
    fouls = fouls + excluded.fouls,
    infield_hits = infield_hits + excluded.infield_hits,
    singles = singles + excluded.singles,
    doubles = doubles + excluded.doubles,
    triples = triples + excluded.triples,
    total_distance = total_distance + excluded.total_distance,
    max_distance = MAX(max_distance, excluded.max_distance),
    sum_max_combo = sum_max_combo + excluded.sum_max_combo,
    max_combo = MAX(max_combo, excluded.max_combo);

  INSERT INTO daily_players(day_start, player_id, completed_games, last_played_at)
  VALUES (
    CAST((NEW.played_at + 32400000) / 86400000 AS INTEGER) * 86400000 - 32400000,
    COALESCE(NEW.player_id, 'anonymous'), 1, NEW.played_at
  )
  ON CONFLICT(day_start, player_id) DO UPDATE SET
    completed_games = completed_games + 1,
    last_played_at = excluded.last_played_at;

  INSERT INTO funnel_events(day_start, player_id, event, event_count, last_event_at)
  VALUES (
    CAST((NEW.played_at + 32400000) / 86400000 AS INTEGER) * 86400000 - 32400000,
    COALESCE(NEW.player_id, 'anonymous'), 'game_complete', 1, NEW.played_at
  )
  ON CONFLICT(day_start, player_id, event) DO UPDATE SET
    event_count = event_count + 1,
    last_event_at = excluded.last_event_at;

  INSERT INTO funnel_events(day_start, player_id, event, event_count, last_event_at)
  SELECT
    CAST((NEW.played_at + 32400000) / 86400000 AS INTEGER) * 86400000 - 32400000,
    COALESCE(NEW.player_id, 'anonymous'), 'second_complete', 1, NEW.played_at
  WHERE EXISTS (
    SELECT 1 FROM game_sessions WHERE id = NEW.session_id AND bat_type = 'aluminum'
  )
  ON CONFLICT(day_start, player_id, event) DO UPDATE SET
    event_count = event_count + 1,
    last_event_at = excluded.last_event_at;
END;
