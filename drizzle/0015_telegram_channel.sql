CREATE TABLE telegram_channel_settings (
 id INTEGER PRIMARY KEY CHECK(id=1),
 channel_id TEXT NOT NULL,
 username TEXT NOT NULL,
 title TEXT NOT NULL,
 enabled INTEGER NOT NULL DEFAULT 0 CHECK(enabled IN (0,1)),
 last_sent_at INTEGER,
 last_error TEXT,
 updated_at INTEGER NOT NULL
);
CREATE TABLE telegram_channel_posts (
 id TEXT PRIMARY KEY,
 channel_id TEXT NOT NULL,
 dedupe_key TEXT NOT NULL,
 topic TEXT NOT NULL,
 body TEXT NOT NULL CHECK(length(body) BETWEEN 1 AND 950),
 image TEXT NOT NULL CHECK(image IN ('welcome','story','sound','gift')),
 scheduled_at INTEGER NOT NULL,
 next_attempt_at INTEGER NOT NULL,
 state TEXT NOT NULL DEFAULT 'queued' CHECK(state IN ('queued','sending','sent','failed','uncertain','cancelled','skipped')),
 attempts INTEGER NOT NULL DEFAULT 0,
 lease_until INTEGER,
 message_id INTEGER,
 sent_at INTEGER,
 last_error TEXT,
 created_at INTEGER NOT NULL,
 UNIQUE(channel_id,dedupe_key)
);
CREATE INDEX telegram_channel_due ON telegram_channel_posts(state,next_attempt_at);
