ALTER TABLE song_orders ADD COLUMN due_date TEXT;
ALTER TABLE song_orders ADD COLUMN customer_message TEXT NOT NULL DEFAULT '';
