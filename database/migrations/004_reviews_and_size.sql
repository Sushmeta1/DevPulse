-- 004: review activity and pull request size, for time-to-first-review, reviewer load and size-vs-merge-time analytics.

ALTER TABLE pull_requests ADD COLUMN IF NOT EXISTS is_draft        BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE pull_requests ADD COLUMN IF NOT EXISTS author_is_bot   BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE pull_requests ADD COLUMN IF NOT EXISTS additions       INTEGER;
ALTER TABLE pull_requests ADD COLUMN IF NOT EXISTS deletions       INTEGER;
ALTER TABLE pull_requests ADD COLUMN IF NOT EXISTS changed_files   INTEGER;
ALTER TABLE pull_requests ADD COLUMN IF NOT EXISTS first_review_at TIMESTAMPTZ;
ALTER TABLE pull_requests ADD COLUMN IF NOT EXISTS first_reviewer  TEXT;
ALTER TABLE pull_requests ADD COLUMN IF NOT EXISTS review_count    INTEGER NOT NULL DEFAULT 0;
-- false until a sync has actually looked at this PR's reviews, so "no review yet" is never confused with "not fetched yet".
ALTER TABLE pull_requests ADD COLUMN IF NOT EXISTS reviews_known   BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS pull_request_reviews (
  id               SERIAL PRIMARY KEY,
  pull_request_id  INTEGER NOT NULL REFERENCES pull_requests(id) ON DELETE CASCADE,
  reviewer_login   TEXT NOT NULL,
  state            TEXT NOT NULL,
  submitted_at     TIMESTAMPTZ NOT NULL,
  is_bot           BOOLEAN NOT NULL DEFAULT FALSE,
  UNIQUE (pull_request_id, reviewer_login, submitted_at)
);
CREATE INDEX IF NOT EXISTS pull_request_reviews_pr_idx ON pull_request_reviews (pull_request_id);
CREATE INDEX IF NOT EXISTS pull_request_reviews_time_idx ON pull_request_reviews (submitted_at);

-- Repositories synced before this migration have no review data; 0 makes the next sync fetch the whole window once.
ALTER TABLE repositories ADD COLUMN IF NOT EXISTS review_data_version INTEGER NOT NULL DEFAULT 0;
