CREATE TABLE site_visits (
 id TEXT PRIMARY KEY,
 visitor TEXT NOT NULL,
 started_at INTEGER NOT NULL,
 last_seen INTEGER NOT NULL,
 views INTEGER NOT NULL DEFAULT 1,
 state INTEGER NOT NULL DEFAULT 0 CHECK(state IN (0,1,2,3)),
 device TEXT NOT NULL,
 source TEXT NOT NULL
);
CREATE INDEX site_visits_started ON site_visits(started_at);
CREATE TABLE site_bot_days (day TEXT PRIMARY KEY, requests INTEGER NOT NULL DEFAULT 0);
