CREATE TABLE IF NOT EXISTS nickname_aliases (
  original_nickname TEXT PRIMARY KEY CHECK(length(original_nickname) BETWEEN 1 AND 10),
  replacement_nickname TEXT NOT NULL CHECK(length(replacement_nickname) BETWEEN 1 AND 10),
  enabled INTEGER NOT NULL DEFAULT 1 CHECK(enabled IN (0, 1)),
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS nickname_aliases_enabled_idx
  ON nickname_aliases(enabled, updated_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS nickname_aliases_replacement_idx
  ON nickname_aliases(replacement_nickname);
