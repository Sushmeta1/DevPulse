-- DevPulse schema. Idempotent: safe to run on every start.

CREATE TABLE IF NOT EXISTS users (
  id                 SERIAL PRIMARY KEY,
  github_id          BIGINT UNIQUE NOT NULL,
  login              TEXT NOT NULL,
  name               TEXT,
  email              TEXT,
  avatar_url         TEXT,
  access_token_enc   TEXT NOT NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Repositories are stored per user so private-repo data never leaks across accounts.
CREATE TABLE IF NOT EXISTS repositories (
  id               SERIAL PRIMARY KEY,
  user_id          INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  github_id        BIGINT NOT NULL,
  owner            TEXT NOT NULL,
  name             TEXT NOT NULL,
  full_name        TEXT NOT NULL,
  description      TEXT,
  language         TEXT,
  stars            INTEGER NOT NULL DEFAULT 0,
  forks            INTEGER NOT NULL DEFAULT 0,
  open_issues      INTEGER NOT NULL DEFAULT 0,
  is_private       BOOLEAN NOT NULL DEFAULT FALSE,
  html_url         TEXT,
  pushed_at        TIMESTAMPTZ,
  last_synced_at   TIMESTAMPTZ,
  UNIQUE (user_id, full_name)
);

CREATE TABLE IF NOT EXISTS commits (
  id             SERIAL PRIMARY KEY,
  repository_id  INTEGER NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
  sha            TEXT NOT NULL,
  message        TEXT,
  author_login   TEXT,
  author_name    TEXT,
  committed_at   TIMESTAMPTZ NOT NULL,
  html_url       TEXT,
  UNIQUE (repository_id, sha)
);
CREATE INDEX IF NOT EXISTS commits_repo_date_idx ON commits (repository_id, committed_at DESC);

CREATE TABLE IF NOT EXISTS pull_requests (
  id             SERIAL PRIMARY KEY,
  repository_id  INTEGER NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
  number         INTEGER NOT NULL,
  title          TEXT NOT NULL,
  state          TEXT NOT NULL CHECK (state IN ('open', 'closed', 'merged')),
  author_login   TEXT,
  created_at     TIMESTAMPTZ NOT NULL,
  updated_at     TIMESTAMPTZ,
  closed_at      TIMESTAMPTZ,
  merged_at      TIMESTAMPTZ,
  html_url       TEXT,
  UNIQUE (repository_id, number)
);
CREATE INDEX IF NOT EXISTS pull_requests_repo_date_idx ON pull_requests (repository_id, created_at DESC);

CREATE TABLE IF NOT EXISTS ai_reports (
  id             SERIAL PRIMARY KEY,
  repository_id  INTEGER NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
  user_id        INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider       TEXT NOT NULL,
  model          TEXT,
  range_days     INTEGER NOT NULL,
  content        JSONB NOT NULL,
  metrics        JSONB NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ai_reports_repo_idx ON ai_reports (repository_id, created_at DESC);
