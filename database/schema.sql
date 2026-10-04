-- database/schema.sql

CREATE TABLE IF NOT EXISTS users (
  id           SERIAL PRIMARY KEY,
  github_id    INTEGER UNIQUE NOT NULL,
  username     VARCHAR(100) NOT NULL,
  avatar_url   TEXT,
  access_token TEXT NOT NULL,
  created_at   TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sessions (
  sid    VARCHAR NOT NULL PRIMARY KEY,
  sess   JSON NOT NULL,
  expire TIMESTAMP NOT NULL
);

CREATE TABLE IF NOT EXISTS metrics_cache (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER REFERENCES users(id) ON DELETE CASCADE,
  repo_name   VARCHAR(200) NOT NULL,
  metric_type VARCHAR(50) NOT NULL,
  data        JSONB NOT NULL,
  cached_at   TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, repo_name, metric_type)
);

CREATE TABLE IF NOT EXISTS ai_summaries (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER REFERENCES users(id) ON DELETE CASCADE,
  repo_name  VARCHAR(200) NOT NULL,
  summary    TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_metrics_cache_user_repo
  ON metrics_cache(user_id, repo_name);