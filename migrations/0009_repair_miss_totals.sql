CREATE UNIQUE INDEX IF NOT EXISTS nickname_aliases_replacement_idx
  ON nickname_aliases(replacement_nickname);

-- Every completed game has exactly ten outcomes. Recalculate misses for games
-- saved after detailed outcome collection was introduced, so a stale session
-- counter can never leave the lifetime total at zero.
UPDATE scores
SET misses = MAX(
  0,
  10 - (fouls + infield_hits + singles + doubles + triples + home_runs)
)
WHERE played_at >= COALESCE((
  SELECT CAST(strftime('%s', applied_at) AS INTEGER) * 1000
  FROM d1_migrations
  WHERE name = '0006_admin_operations.sql'
), 9223372036854775807);

-- Before detailed collection, only a zero-point game proves all ten pitches
-- were whiffs. Do not invent outcomes for any other historical game.
UPDATE scores
SET misses = 10
WHERE played_at < COALESCE((
    SELECT CAST(strftime('%s', applied_at) AS INTEGER) * 1000
    FROM d1_migrations
    WHERE name = '0006_admin_operations.sql'
  ), 0)
  AND score = 0
  AND misses = 0;

UPDATE daily_stats
SET misses = COALESCE((
  SELECT SUM(s.misses)
  FROM scores s
  WHERE s.played_at >= daily_stats.day_start
    AND s.played_at < daily_stats.day_start + 86400000
), 0);
