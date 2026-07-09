CREATE TABLE IF NOT EXISTS favorites (
  item_key TEXT PRIMARY KEY,
  payload_json TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_favorites_updated ON favorites(updated_at DESC);

CREATE TABLE IF NOT EXISTS watch_history (
  item_key TEXT PRIMARY KEY,
  payload_json TEXT NOT NULL,
  watched_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_watch_history_watched ON watch_history(watched_at DESC);
