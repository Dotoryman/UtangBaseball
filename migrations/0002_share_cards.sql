CREATE TABLE IF NOT EXISTS share_cards (
  id TEXT PRIMARY KEY,
  image BLOB NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS share_cards_created_idx
  ON share_cards(created_at);
