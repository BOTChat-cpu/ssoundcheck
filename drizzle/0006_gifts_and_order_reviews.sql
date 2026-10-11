CREATE TABLE order_gifts (
 order_id TEXT PRIMARY KEY REFERENCES song_orders(id) ON DELETE RESTRICT,
 token TEXT NOT NULL UNIQUE,
 recipient TEXT NOT NULL,
 sender TEXT NOT NULL,
 title TEXT NOT NULL,
 message TEXT NOT NULL,
 theme TEXT NOT NULL CHECK(theme IN ('night','rose','sunrise')),
 enabled INTEGER NOT NULL DEFAULT 0 CHECK(enabled IN (0,1)),
 updated_at INTEGER NOT NULL
);
ALTER TABLE reviews ADD COLUMN order_id TEXT REFERENCES song_orders(id);
