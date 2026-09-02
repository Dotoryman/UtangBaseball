CREATE TABLE IF NOT EXISTS scores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nickname TEXT NOT NULL CHECK(length(nickname) BETWEEN 1 AND 10),
  score INTEGER NOT NULL CHECK(score BETWEEN 0 AND 200000),
  home_runs INTEGER NOT NULL CHECK(home_runs BETWEEN 0 AND 10),
  distance INTEGER NOT NULL CHECK(distance BETWEEN 0 AND 200),
  played_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS scores_rank_idx
  ON scores(score DESC, played_at ASC);

CREATE INDEX IF NOT EXISTS scores_period_idx
  ON scores(played_at DESC, score DESC);
