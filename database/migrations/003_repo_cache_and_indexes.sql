-- 003: cache the GitHub repository list per user, and index the lookups the dashboard actually performs.
ALTER TABLE users ADD COLUMN IF NOT EXISTS repos_synced_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS pull_requests_repo_merged_idx ON pull_requests (repository_id, merged_at) WHERE merged_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS pull_requests_open_idx ON pull_requests (repository_id) WHERE state = 'open';
CREATE INDEX IF NOT EXISTS ai_reports_user_day_idx ON ai_reports (user_id, created_at DESC);
