-- 002: sync-quality tracking and the shared demo account.
ALTER TABLE repositories ADD COLUMN IF NOT EXISTS sync_truncated BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE repositories ADD COLUMN IF NOT EXISTS history_from TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_demo BOOLEAN NOT NULL DEFAULT FALSE;
