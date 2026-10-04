const { parseRepo, parseDays } = require('../utils/validate');
const { syncRepository, upsertRepositories } = require('../services/syncService');

const toDto = (r, extra = {}) => ({
  id: r.id,
  owner: r.owner,
  name: r.name,
  fullName: r.full_name,
  description: r.description,
  language: r.language,
  stars: r.stars,
  forks: r.forks,
  openIssues: r.open_issues,
  isPrivate: r.is_private,
  htmlUrl: r.html_url,
  pushedAt: r.pushed_at,
  lastSyncedAt: r.last_synced_at,
  ...extra,
});

const REPO_LIST_FRESH_MS = 5 * 60 * 1000;
const ACTIVITY_DAYS = 30;

/** Commits per UTC day for the last 30 days plus open PR counts, for every synced repository, in two queries. */
async function activityFor(db, repos) {
  const ids = repos.filter((r) => r.last_synced_at).map((r) => r.id);
  const out = new Map();
  if (!ids.length) return out;
  const [commits, open] = await Promise.all([
    db.query(
      `SELECT repository_id AS id, (committed_at AT TIME ZONE 'UTC')::date::text AS day, count(*)::int AS n
       FROM commits WHERE repository_id = ANY($1::int[]) AND committed_at >= now() - make_interval(days => $2)
       GROUP BY 1, 2`,
      [ids, ACTIVITY_DAYS + 1],
    ),
    db.query("SELECT repository_id AS id, count(*)::int AS n FROM pull_requests WHERE state = 'open' AND repository_id = ANY($1::int[]) GROUP BY 1", [ids]),
  ]);
  const today = Math.floor(Date.now() / 86400000);
  const days = Array.from({ length: ACTIVITY_DAYS }, (_, i) => new Date((today - (ACTIVITY_DAYS - 1) + i) * 86400000).toISOString().slice(0, 10));
  for (const id of ids) out.set(id, { activity: days.map(() => 0), openPulls: 0 });
  for (const { id, day, n } of commits.rows) {
    const i = days.indexOf(day);
    if (i >= 0) out.get(id).activity[i] = n;
  }
  for (const { id, n } of open.rows) out.get(id).openPulls = n;
  for (const v of out.values()) v.commits30 = v.activity.reduce((a, b) => a + b, 0);
  return out;
}

async function listRepositories(req, res) {
  const { db, github } = req.deps;
  const cached = req.user.repos_synced_at
    && Date.now() - new Date(req.user.repos_synced_at).getTime() < REPO_LIST_FRESH_MS
    && req.query.refresh !== 'true';

  if (!cached) {
    const repos = await github.listRepositories(req.githubToken);
    await upsertRepositories(db, req.user.id, repos);
    // Forget repositories that disappeared from GitHub, unless we hold synced data for them.
    await db.query(
      'DELETE FROM repositories WHERE user_id = $1 AND last_synced_at IS NULL AND NOT (full_name = ANY($2::text[]))',
      [req.user.id, repos.map((r) => r.full_name)],
    );
    await db.query('UPDATE users SET repos_synced_at = now() WHERE id = $1', [req.user.id]);
  }

  const { rows } = await db.query('SELECT * FROM repositories WHERE user_id = $1 ORDER BY pushed_at DESC NULLS LAST, full_name', [req.user.id]);
  const activity = await activityFor(db, rows);
  res.json(rows.map((r) => toDto(r, { synced: Boolean(r.last_synced_at), ...(activity.get(r.id) || { activity: null, openPulls: null, commits30: null }) })));
}

async function listCommits(req, res) {
  const deps = req.deps;
  const { owner, name } = parseRepo(req.params.owner, req.params.repo);
  const days = parseDays(req.query.days);
  const repo = await syncRepository(deps, { userId: req.user.id, token: req.githubToken, owner, name, force: req.query.refresh === 'true' });
  const { rows } = await deps.db.query(
    `SELECT sha, message, author_login, author_name, committed_at, html_url FROM commits
     WHERE repository_id = $1 AND committed_at >= now() - make_interval(days => $2)
     ORDER BY committed_at DESC LIMIT 50`,
    [repo.id, days],
  );
  res.json(rows.map((c) => ({
    sha: c.sha, message: c.message, authorLogin: c.author_login, authorName: c.author_name,
    committedAt: c.committed_at, htmlUrl: c.html_url,
  })));
}

async function listPulls(req, res) {
  const deps = req.deps;
  const { owner, name } = parseRepo(req.params.owner, req.params.repo);
  const days = parseDays(req.query.days);
  const repo = await syncRepository(deps, { userId: req.user.id, token: req.githubToken, owner, name, force: req.query.refresh === 'true' });
  const { rows } = await deps.db.query(
    `SELECT number, title, state, author_login, created_at, merged_at, closed_at, html_url FROM pull_requests
     WHERE repository_id = $1 AND created_at >= now() - make_interval(days => $2)
     ORDER BY created_at DESC LIMIT 100`,
    [repo.id, days],
  );
  res.json(rows.map((p) => ({
    number: p.number, title: p.title, state: p.state, authorLogin: p.author_login,
    createdAt: p.created_at, mergedAt: p.merged_at, closedAt: p.closed_at, htmlUrl: p.html_url,
  })));
}

module.exports = { listRepositories, listCommits, listPulls, toDto };
