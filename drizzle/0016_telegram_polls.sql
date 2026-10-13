ALTER TABLE telegram_channel_settings ADD COLUMN plan_version INTEGER NOT NULL DEFAULT 0;
ALTER TABLE telegram_channel_posts ADD COLUMN kind TEXT NOT NULL DEFAULT 'photo' CHECK(kind IN ('photo','poll'));
ALTER TABLE telegram_channel_posts ADD COLUMN poll_question TEXT CHECK(poll_question IS NULL OR length(poll_question) BETWEEN 1 AND 300);
ALTER TABLE telegram_channel_posts ADD COLUMN poll_options TEXT;
ALTER TABLE telegram_channel_posts ADD COLUMN poll_multiple INTEGER NOT NULL DEFAULT 0 CHECK(poll_multiple IN (0,1));
