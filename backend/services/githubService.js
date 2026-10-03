const { HttpError } = require('../utils/httpError');

const API = 'https://api.github.com';

function headers(token) {
  return {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'DevPulse',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function request(token, path, params = {}) {
  const url = new URL(path.startsWith('http') ? path : `${API}${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

  const res = await fetch(url, { headers: headers(token) });
  if (res.ok) return res.json();

  if (res.status === 401) throw new HttpError(401, 'GitHub token is invalid or revoked. Please log in again.');
  if (res.status === 404) throw new HttpError(404, 'Repository not found or not accessible');
  if (res.status === 403 || res.status === 429) {
    if (res.headers.get('x-ratelimit-remaining') === '0' || res.status === 429) {
      throw new HttpError(429, 'GitHub API rate limit reached. Try again in a few minutes.');
    }
    throw new HttpError(403, 'GitHub denied access. If this repository belongs to an organisation with SAML SSO, authorize DevPulse for it in GitHub settings.');
  }
  if (res.status === 409) throw new HttpError(409, 'Repository is empty');
  if (res.status === 451) throw new HttpError(451, 'Repository is unavailable for legal reasons');
  throw new HttpError(502, `GitHub API error (${res.status})`);
}

// Returns every item up to `maxPages` pages; `truncated` says the cap (not GitHub) ended the listing.
async function paginate(token, path, params = {}, maxPages = 5) {
  const items = [];
  let truncated = false;
  for (let page = 1; page <= maxPages; page++) {
    const batch = await request(token, path, { ...params, per_page: 100, page });
    items.push(...batch);
    if (batch.length < 100) break;
    if (page === maxPages) truncated = true;
  }
  return { items, truncated };
}

// --- OAuth ---------------------------------------------------------------

async function exchangeCodeForToken(github, code) {
  const res = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'User-Agent': 'DevPulse' },
    body: JSON.stringify({
      client_id: github.clientId,
      client_secret: github.clientSecret,
      code,
      redirect_uri: github.callbackUrl,
    }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.access_token) {
    throw new HttpError(400, body.error_description || 'GitHub OAuth code exchange failed');
  }
  return body.access_token;
}

const getAuthenticatedUser = (token) => request(token, '/user');

// --- Data ----------------------------------------------------------------

const normalizeRepo = (r) => ({
  github_id: r.id,
  owner: r.owner.login,
  name: r.name,
  full_name: r.full_name,
  description: r.description,
  language: r.language,
  stars: r.stargazers_count,
  forks: r.forks_count,
  open_issues: r.open_issues_count,
  is_private: r.private,
  html_url: r.html_url,
  pushed_at: r.pushed_at,
});

async function listRepositories(token) {
  const { items } = await paginate(token, '/user/repos', { sort: 'pushed', affiliation: 'owner,collaborator,organization_member' }, 3);
  return items.map(normalizeRepo);
}

async function getRepository(token, owner, name) {
  return normalizeRepo(await request(token, `/repos/${owner}/${name}`));
}

const COMMIT_PAGES = 10;
const PULL_PAGES = 5;

async function listCommits(token, owner, name, since) {
  const { items, truncated } = await paginate(token, `/repos/${owner}/${name}/commits`, { since }, COMMIT_PAGES);
  const commits = items.map((c) => ({
    sha: c.sha,
    message: (c.commit.message || '').split('\n')[0].slice(0, 300),
    author_login: c.author?.login || null,
    author_name: c.commit.author?.name || null,
    committed_at: c.commit.author?.date || c.commit.committer?.date,
    html_url: c.html_url,
  }));
  return { commits, truncated };
}

async function listPullRequests(token, owner, name, since) {
  const sinceMs = new Date(since).getTime();
  const out = [];
  for (let page = 1; page <= PULL_PAGES; page++) {
    const batch = await request(token, `/repos/${owner}/${name}/pulls`, {
      state: 'all', sort: 'updated', direction: 'desc', per_page: 100, page,
    });
    for (const p of batch) {
      if (new Date(p.updated_at).getTime() < sinceMs) return { pulls: out.map(normalizePull), truncated: false };
      out.push(p);
    }
    if (batch.length < 100) return { pulls: out.map(normalizePull), truncated: false };
  }
  return { pulls: out.map(normalizePull), truncated: true };
}

function normalizePull(p) {
  return {
    number: p.number,
    title: p.title.slice(0, 300),
    state: p.merged_at ? 'merged' : p.state,
    author_login: p.user?.login || null,
    created_at: p.created_at,
    updated_at: p.updated_at,
    closed_at: p.closed_at,
    merged_at: p.merged_at,
    html_url: p.html_url,
  };
}

module.exports = {
  exchangeCodeForToken,
  getAuthenticatedUser,
  listRepositories,
  getRepository,
  listCommits,
  listPullRequests,
};
