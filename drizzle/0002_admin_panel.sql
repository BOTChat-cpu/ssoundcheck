ALTER TABLE reviews ADD COLUMN status TEXT NOT NULL DEFAULT 'published';
CREATE TABLE site_content (id INTEGER PRIMARY KEY CHECK (id = 1), value TEXT NOT NULL, updated_at INTEGER NOT NULL);
CREATE TABLE admin_sessions (token_hash TEXT PRIMARY KEY, expires_at INTEGER NOT NULL, password_version TEXT NOT NULL);
CREATE TABLE admin_login_state (id INTEGER PRIMARY KEY CHECK (id = 1), failures INTEGER NOT NULL DEFAULT 0, window_start INTEGER NOT NULL);
