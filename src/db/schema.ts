export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS vault_meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS entries (
  id TEXT PRIMARY KEY,
  short_id TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL CHECK (type IN ('account', 'email', 'api_key', 'note')),
  name TEXT NOT NULL,
  username TEXT,
  password_cipher TEXT,
  password_iv TEXT,
  password_auth_tag TEXT,
  baseurl TEXT,
  apikey_cipher TEXT,
  apikey_iv TEXT,
  apikey_auth_tag TEXT,
  url TEXT,
  note_cipher TEXT,
  note_iv TEXT,
  note_auth_tag TEXT,
  remark TEXT,
  tags TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  last_accessed_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_entries_short_id ON entries(short_id);
CREATE INDEX IF NOT EXISTS idx_entries_type ON entries(type);
CREATE INDEX IF NOT EXISTS idx_entries_name ON entries(name);
CREATE INDEX IF NOT EXISTS idx_entries_username ON entries(username);
CREATE INDEX IF NOT EXISTS idx_entries_baseurl ON entries(baseurl);
CREATE INDEX IF NOT EXISTS idx_entries_url ON entries(url);
CREATE INDEX IF NOT EXISTS idx_entries_tags ON entries(tags);
CREATE INDEX IF NOT EXISTS idx_entries_updated_at ON entries(updated_at);
`
