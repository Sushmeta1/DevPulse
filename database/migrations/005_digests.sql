-- 005: weekly digest subscriptions (one per user).
CREATE TABLE IF NOT EXISTS digests (
  user_id            INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  repos              TEXT[] NOT NULL DEFAULT '{}',          -- empty = every analyzed repository
  enabled            BOOLEAN NOT NULL DEFAULT TRUE,
  send_email         BOOLEAN NOT NULL DEFAULT FALSE,
  slack_webhook_enc  TEXT,                                  -- encrypted: a webhook URL is a credential
  weekday            SMALLINT NOT NULL DEFAULT 1 CHECK (weekday BETWEEN 0 AND 6),
  tz_offset          SMALLINT NOT NULL DEFAULT 0,           -- minutes east of UTC, decides which local weekday it is
  include_ai         BOOLEAN NOT NULL DEFAULT TRUE,
  last_sent_at       TIMESTAMPTZ,
  last_attempt_at    TIMESTAMPTZ,
  last_status        TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS digests_due_idx ON digests (last_sent_at) WHERE enabled;
