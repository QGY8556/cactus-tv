PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS providers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  base_url TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  priority INTEGER NOT NULL DEFAULT 0,
  proxy_enabled INTEGER NOT NULL DEFAULT 0,
  media_hosts TEXT NOT NULL DEFAULT '[]',
  headers_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS provider_health (
  provider_id TEXT PRIMARY KEY,
  ok INTEGER NOT NULL DEFAULT 0,
  latency_ms INTEGER NOT NULL DEFAULT 0,
  last_error TEXT NOT NULL DEFAULT '',
  checked_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (provider_id) REFERENCES providers(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS subtitles (
  id TEXT PRIMARY KEY,
  item_key TEXT NOT NULL,
  name TEXT NOT NULL,
  lang TEXT NOT NULL DEFAULT 'zh',
  url TEXT NOT NULL,
  format TEXT NOT NULL DEFAULT 'vtt',
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_subtitles_item ON subtitles(item_key);

INSERT INTO settings (key, value) VALUES ('site_name', 'Cactus TV') ON CONFLICT(key) DO NOTHING;
INSERT INTO settings (key, value) VALUES ('home_notice', '') ON CONFLICT(key) DO NOTHING;
