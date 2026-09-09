ALTER TABLE game_sessions ADD COLUMN misses INTEGER NOT NULL DEFAULT 0;
ALTER TABLE game_sessions ADD COLUMN fouls INTEGER NOT NULL DEFAULT 0;
ALTER TABLE game_sessions ADD COLUMN infield_hits INTEGER NOT NULL DEFAULT 0;
ALTER TABLE game_sessions ADD COLUMN singles INTEGER NOT NULL DEFAULT 0;
ALTER TABLE game_sessions ADD COLUMN doubles INTEGER NOT NULL DEFAULT 0;
ALTER TABLE game_sessions ADD COLUMN triples INTEGER NOT NULL DEFAULT 0;
ALTER TABLE game_sessions ADD COLUMN total_distance INTEGER NOT NULL DEFAULT 0;

ALTER TABLE scores ADD COLUMN misses INTEGER NOT NULL DEFAULT 0;
ALTER TABLE scores ADD COLUMN fouls INTEGER NOT NULL DEFAULT 0;
ALTER TABLE scores ADD COLUMN infield_hits INTEGER NOT NULL DEFAULT 0;
ALTER TABLE scores ADD COLUMN singles INTEGER NOT NULL DEFAULT 0;
ALTER TABLE scores ADD COLUMN doubles INTEGER NOT NULL DEFAULT 0;
ALTER TABLE scores ADD COLUMN triples INTEGER NOT NULL DEFAULT 0;
ALTER TABLE scores ADD COLUMN total_distance INTEGER NOT NULL DEFAULT 0;
ALTER TABLE scores ADD COLUMN max_combo INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS scores_nickname_time_idx ON scores(nickname COLLATE NOCASE, played_at DESC);

CREATE TABLE daily_stats (
  day_start INTEGER PRIMARY KEY,
  completed_games INTEGER NOT NULL DEFAULT 0,
  total_score INTEGER NOT NULL DEFAULT 0,
  max_score INTEGER NOT NULL DEFAULT 0,
  home_runs INTEGER NOT NULL DEFAULT 0,
  misses INTEGER NOT NULL DEFAULT 0,
  fouls INTEGER NOT NULL DEFAULT 0,
  infield_hits INTEGER NOT NULL DEFAULT 0,
  singles INTEGER NOT NULL DEFAULT 0,
  doubles INTEGER NOT NULL DEFAULT 0,
  triples INTEGER NOT NULL DEFAULT 0,
  total_distance INTEGER NOT NULL DEFAULT 0,
  max_distance INTEGER NOT NULL DEFAULT 0,
  sum_max_combo INTEGER NOT NULL DEFAULT 0,
  max_combo INTEGER NOT NULL DEFAULT 0,
  share_clicks INTEGER NOT NULL DEFAULT 0,
  referrals INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE daily_players (
  day_start INTEGER NOT NULL,
  player_id TEXT NOT NULL,
  completed_games INTEGER NOT NULL DEFAULT 0,
  last_played_at INTEGER NOT NULL,
  PRIMARY KEY(day_start, player_id)
);
CREATE INDEX daily_players_recent_idx ON daily_players(day_start, last_played_at DESC);

CREATE TABLE funnel_events (
  day_start INTEGER NOT NULL,
  player_id TEXT NOT NULL,
  event TEXT NOT NULL CHECK(event IN ('landing', 'play_click', 'game_start', 'game_complete', 'retry_click', 'second_complete', 'result_view', 'share_click', 'referral')),
  event_count INTEGER NOT NULL DEFAULT 1,
  last_event_at INTEGER NOT NULL,
  PRIMARY KEY(day_start, player_id, event)
);
CREATE INDEX funnel_events_period_idx ON funnel_events(day_start, event);

CREATE TABLE banned_words (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  term TEXT NOT NULL,
  normalized_term TEXT NOT NULL UNIQUE,
  created_at INTEGER NOT NULL
);

INSERT OR IGNORE INTO banned_words(term, normalized_term, created_at) VALUES
  ('씨발', '씨발', unixepoch('now') * 1000),
  ('시발', '시발', unixepoch('now') * 1000),
  ('병신', '병신', unixepoch('now') * 1000),
  ('개새끼', '개새끼', unixepoch('now') * 1000),
  ('좆', '좆', unixepoch('now') * 1000),
  ('ㅅㅂ', 'ㅅㅂ', unixepoch('now') * 1000),
  ('ㅂㅅ', 'ㅂㅅ', unixepoch('now') * 1000),
  ('fuck', 'fuck', unixepoch('now') * 1000);

CREATE TABLE nickname_reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nickname TEXT NOT NULL,
  reporter_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  UNIQUE(nickname, reporter_id)
);
CREATE INDEX nickname_reports_name_idx ON nickname_reports(nickname, created_at DESC);

CREATE TABLE admin_audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT,
  details TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX admin_audit_recent_idx ON admin_audit_logs(created_at DESC);

CREATE TABLE admin_login_attempts (
  identity_hash TEXT PRIMARY KEY,
  attempts INTEGER NOT NULL DEFAULT 0,
  window_started_at INTEGER NOT NULL,
  blocked_until INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE balance_settings (
  setting_key TEXT PRIMARY KEY,
  setting_value REAL NOT NULL,
  label TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);
INSERT OR IGNORE INTO balance_settings(setting_key, setting_value, label, updated_at) VALUES
  ('home_run_distance', 115, '홈런 기준 비거리', unixepoch('now') * 1000),
  ('triple_distance', 96, '3루타 기준 비거리', unixepoch('now') * 1000),
  ('double_distance', 73, '2루타 기준 비거리', unixepoch('now') * 1000),
  ('gold_bat_games', 1, '황금배트 지급 완료 횟수', unixepoch('now') * 1000),
  ('diamond_bat_games', 2, '다이아몬드배트 지급 완료 횟수', unixepoch('now') * 1000);

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
  WHERE EXISTS (SELECT 1 FROM game_sessions WHERE id = NEW.session_id AND bat_type = 'gold')
  ON CONFLICT(day_start, player_id, event) DO UPDATE SET
    event_count = event_count + 1,
    last_event_at = excluded.last_event_at;
END;

-- Preserve useful historical totals for scores created before this migration.
INSERT OR IGNORE INTO daily_stats(
  day_start, completed_games, total_score, max_score, home_runs,
  misses, fouls, infield_hits, singles, doubles, triples,
  total_distance, max_distance, sum_max_combo, max_combo
)
SELECT
  CAST((played_at + 32400000) / 86400000 AS INTEGER) * 86400000 - 32400000,
  COUNT(*), SUM(score), MAX(score), SUM(home_runs),
  SUM(misses), SUM(fouls), SUM(infield_hits), SUM(singles), SUM(doubles), SUM(triples),
  SUM(total_distance), MAX(distance), SUM(max_combo), MAX(max_combo)
FROM scores
GROUP BY CAST((played_at + 32400000) / 86400000 AS INTEGER);

INSERT OR IGNORE INTO daily_players(day_start, player_id, completed_games, last_played_at)
SELECT
  CAST((played_at + 32400000) / 86400000 AS INTEGER) * 86400000 - 32400000,
  player_id,
  COUNT(*),
  MAX(played_at)
FROM scores
WHERE player_id IS NOT NULL
GROUP BY CAST((played_at + 32400000) / 86400000 AS INTEGER), player_id;
