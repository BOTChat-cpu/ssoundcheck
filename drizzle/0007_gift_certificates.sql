CREATE TABLE gift_certificates (
 id TEXT PRIMARY KEY,
 code TEXT NOT NULL UNIQUE,
 recipient TEXT NOT NULL,
 sender TEXT NOT NULL,
 service TEXT NOT NULL,
 plan_index INTEGER NOT NULL CHECK(plan_index BETWEEN 0 AND 2),
 message TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'issued' CHECK(status IN ('issued','redeemed','cancelled')),
 created_at INTEGER NOT NULL,
 updated_at INTEGER NOT NULL
);
CREATE INDEX gift_certificates_created ON gift_certificates(created_at DESC);
