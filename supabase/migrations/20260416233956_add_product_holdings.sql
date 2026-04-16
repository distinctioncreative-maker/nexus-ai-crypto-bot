-- Per-product holdings map so switching instruments doesn't wipe state
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS product_holdings JSONB DEFAULT '{}';
