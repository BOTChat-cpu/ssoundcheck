CREATE TABLE order_ready_emails (
 id TEXT PRIMARY KEY,
 order_id TEXT NOT NULL REFERENCES song_orders(id) ON DELETE CASCADE,
 media_version TEXT NOT NULL,
 state TEXT NOT NULL DEFAULT 'queued' CHECK(state IN ('queued','sending','sent','failed','skipped')),
 attempts INTEGER NOT NULL DEFAULT 0,
 next_attempt_at INTEGER NOT NULL,
 lease_until INTEGER,
 sent_at INTEGER,
 last_error TEXT,
 created_at INTEGER NOT NULL,
 updated_at INTEGER NOT NULL,
 UNIQUE(order_id,media_version)
);
CREATE INDEX order_ready_emails_due ON order_ready_emails(state,next_attempt_at);
