const { HttpError } = require('../utils/httpError');
const { fetchWithTimeout } = require('../utils/http');
const { deriveReviewFields } = require('./reviewUtil');

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

  const res = await fetchWithTimeout(url, { headers: headers(token) });
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
  const res = await fetchWithTimeout('https://github.com/login/oauth/access_token', {
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

/** The user's primary, verified e-mail (needs the user:email scope). Null when unavailable - never an error. */
async function getPrimaryEmail(token) {
  try {
    const emails = await request(token, '/user/emails');
    return emails.find((e) => e.primary && e.verified)?.email ?? emails.find((e) => e.verified)?.email ?? null;
  } catch {
    return null;
  }
}

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

const PULLS_QUERY = `
query($owner: String!, $name: String!, $cursor: String) {
  repository(owner: $owner, name: $name) {
    pullRequests(first: 50, after: $cursor, orderBy: { field: UPDATED_AT, direction: DESC }) {
      pageInfo { hasNextPage endCursor }
      nodes {
        number title state isDraft createdAt updatedAt closedAt mergedAt url
        additions deletions changedFiles
        author { login __typename }
        reviews(first: 30) { nodes { state submittedAt author { login __typename } } }
      }
    }
  }
}`;

async function graphql(token, query, variables) {
  const res = await fetchWithTimeout(`${API}/graphql`, {
    method: 'POST',
    headers: { ...headers(token), 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  });
  if (res.status === 401) throw new HttpError(401, 'GitHub token is invalid or revoked. Please log in again.');
  if (res.status === 403 || res.status === 429) throw new HttpError(429, 'GitHub API rate limit reached. Try again in a few minutes.');
  if (!res.ok) throw new HttpError(502, `GitHub API error (${res.status})`);
  const body = await res.json();
  if (body.errors?.length) {
    const notFound = body.errors.some((e) => e.type === 'NOT_FOUND');
    throw new HttpError(notFound ? 404 : 502, notFound ? 'Repository not found or not accessible' : 'GitHub GraphQL error');
  }
  return body.data;
}

/**
 * Pull requests updated since `since`, newest first, with review activity and size in the same round trip
 * (50 PRs per request instead of one REST call per PR for its reviews).
 */
async function listPullRequests(token, owner, name, since) {
  const sinceMs = new Date(since).getTime();
  const out = [];
  let cursor = null;
  for (let page = 0; page < PULL_PAGES * 2; page++) { // 50 per page => same 500 PR ceiling as before
    const data = await graphql(token, PULLS_QUERY, { owner, name, cursor });
    const conn = data.repository.pullRequests;
    for (const node of conn.nodes) {
      if (new Date(node.updatedAt).getTime() < sinceMs) return { pulls: out.map(normalizePull), truncated: false };
      out.push(node);
    }
    if (!conn.pageInfo.hasNextPage) return { pulls: out.map(normalizePull), truncated: false };
    cursor = conn.pageInfo.endCursor;
  }
  return { pulls: out.map(normalizePull), truncated: true };
}

function normalizePull(p) {
  const state = p.mergedAt ? 'merged' : p.state.toLowerCase();
  const pull = {
    number: p.number,
    title: p.title.slice(0, 300),
    state,
    author_login: p.author?.login || null,
    author_is_bot: p.author?.__typename === 'Bot',
    is_draft: Boolean(p.isDraft),
    created_at: p.createdAt,
    updated_at: p.updatedAt,
    closed_at: p.closedAt,
    merged_at: p.mergedAt,
    html_url: p.url,
    additions: p.additions ?? null,
    deletions: p.deletions ?? null,
    changed_files: p.changedFiles ?? null,
    reviews: (p.reviews?.nodes || []).map((r) => ({
      reviewer_login: r.author?.login || null,
      is_bot: r.author?.__typename === 'Bot',
      state: r.state,
      submitted_at: r.submittedAt,
    })),
  };
  return { ...pull, ...deriveReviewFields(pull) };
}

// Best effort: tells GitHub to revoke DevPulse's grant when a user deletes their account.
async function revokeGrant(github, token) {
  if (!github.clientId || !github.clientSecret) return false;
  const basic = Buffer.from(`${github.clientId}:${github.clientSecret}`).toString('base64');
  try {
    const res = await fetchWithTimeout(`${API}/applications/${github.clientId}/grant`, {
      method: 'DELETE',
      headers: { ...headers(), Authorization: `Basic ${basic}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ access_token: token }),
    }, 8000);
    return res.status === 204;
  } catch {
    return false;
  }
}

module.exports = {
  revokeGrant,
  getPrimaryEmail,
  exchangeCodeForToken,
  getAuthenticatedUser,
  listRepositories,
  getRepository,
  listCommits,
  listPullRequests,
};
