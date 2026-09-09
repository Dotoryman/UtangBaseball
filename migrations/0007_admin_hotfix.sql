CREATE TABLE IF NOT EXISTS admin_state (
  state_key TEXT PRIMARY KEY,
  state_value INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- Older scores only retained each game's longest hit. Use that known distance
-- as a conservative historical minimum; new games already store the exact sum.
UPDATE scores
SET total_distance = distance
WHERE total_distance = 0 AND distance > 0;

UPDATE daily_stats
SET total_distance = COALESCE((
  SELECT SUM(s.total_distance)
  FROM scores s
  WHERE s.played_at >= daily_stats.day_start
    AND s.played_at < daily_stats.day_start + 86400000
), 0);
