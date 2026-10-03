const { parseRepo, parseDays } = require('../utils/validate');
const { syncRepository, upsertRepositories } = require('../services/syncService');

const toDto = (r) => ({
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
});

async function listRepositories(req, res) {
  const { db, github } = req.deps;
  const repos = await github.listRepositories(req.githubToken);
  // Cache the list in PostgreSQL (metadata only; commits/PRs are synced on demand).
  const saved = await upsertRepositories(db, req.user.id, repos);
  res.json(saved.sort((a, b) => new Date(b.pushed_at || 0) - new Date(a.pushed_at || 0)).map(toDto));
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
