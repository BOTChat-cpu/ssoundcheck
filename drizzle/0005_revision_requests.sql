CREATE TABLE order_revisions (
 id TEXT PRIMARY KEY,
 order_id TEXT NOT NULL REFERENCES song_orders(id) ON DELETE RESTRICT,
 message TEXT NOT NULL CHECK(length(message) BETWEEN 10 AND 1500),
 status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','reviewed')),
 created_at INTEGER NOT NULL,
 updated_at INTEGER NOT NULL
);
CREATE INDEX order_revisions_order ON order_revisions(order_id,created_at);
CREATE UNIQUE INDEX order_revisions_one_pending ON order_revisions(order_id) WHERE status='pending';
