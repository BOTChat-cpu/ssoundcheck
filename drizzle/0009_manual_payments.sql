CREATE TABLE manual_payment_settings (id INTEGER PRIMARY KEY CHECK(id=1), enabled INTEGER NOT NULL DEFAULT 0, recipient TEXT NOT NULL DEFAULT '', bank TEXT NOT NULL DEFAULT '', details TEXT NOT NULL DEFAULT '');
INSERT INTO manual_payment_settings (id) VALUES (1);
CREATE TABLE manual_payment_requests (id TEXT PRIMARY KEY, order_id TEXT NOT NULL REFERENCES song_orders(id), price_kopecks INTEGER NOT NULL, media_version TEXT NOT NULL, status TEXT NOT NULL CHECK(status IN ('pending','confirmed','rejected')), created_at INTEGER NOT NULL, reviewed_at INTEGER);
CREATE UNIQUE INDEX manual_payment_one_pending ON manual_payment_requests(order_id) WHERE status='pending';
