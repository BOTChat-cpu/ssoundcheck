CREATE TABLE order_messages (
 sequence INTEGER PRIMARY KEY AUTOINCREMENT,
 id TEXT NOT NULL UNIQUE,
 order_id TEXT NOT NULL REFERENCES song_orders(id) ON DELETE CASCADE,
 role TEXT NOT NULL CHECK(role IN ('customer','studio')),
 body TEXT NOT NULL CHECK(length(body) BETWEEN 1 AND 2000),
 created_at INTEGER NOT NULL
);
CREATE INDEX order_messages_order_sequence ON order_messages(order_id,sequence);
CREATE INDEX order_messages_role_created ON order_messages(role,created_at);
CREATE TABLE order_message_reads (
 order_id TEXT NOT NULL REFERENCES song_orders(id) ON DELETE CASCADE,
 role TEXT NOT NULL CHECK(role IN ('customer','studio')),
 last_sequence INTEGER NOT NULL DEFAULT 0,
 PRIMARY KEY(order_id,role)
);
