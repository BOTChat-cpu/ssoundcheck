ALTER TABLE song_orders ADD COLUMN song_title TEXT NOT NULL DEFAULT '';
ALTER TABLE song_orders ADD COLUMN cover_theme TEXT NOT NULL DEFAULT 'night' CHECK(cover_theme IN ('night','rose','sunrise'));
