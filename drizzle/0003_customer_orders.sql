CREATE TABLE song_orders (
 id TEXT PRIMARY KEY,
 user_id TEXT NOT NULL REFERENCES auth_user(id) ON DELETE RESTRICT,
 service TEXT NOT NULL,
 price_kopecks INTEGER NOT NULL CHECK(price_kopecks > 0),
 currency TEXT NOT NULL DEFAULT 'RUB',
 recipient TEXT NOT NULL,
 occasion TEXT NOT NULL,
 genre TEXT NOT NULL,
 mood TEXT NOT NULL,
 story TEXT NOT NULL,
 contact TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'submitted' CHECK(status IN ('submitted','working','ready','cancelled')),
 full_file TEXT,
 preview_file TEXT,
 media_version TEXT,
 duration REAL,
 paid_at INTEGER,
 payment_provider TEXT,
 payment_id TEXT UNIQUE,
 created_at INTEGER NOT NULL,
 updated_at INTEGER NOT NULL
);
CREATE INDEX song_orders_user_created ON song_orders(user_id,created_at DESC);
CREATE TABLE order_payments (
 id TEXT PRIMARY KEY,
 order_id TEXT NOT NULL REFERENCES song_orders(id),
 provider TEXT NOT NULL,
 provider_payment_id TEXT UNIQUE,
 amount_kopecks INTEGER NOT NULL,
 currency TEXT NOT NULL,
 media_version TEXT NOT NULL,
 state TEXT NOT NULL DEFAULT 'created' CHECK(state IN ('created','pending','succeeded','cancelled')),
 created_at INTEGER NOT NULL,
 updated_at INTEGER NOT NULL
);
