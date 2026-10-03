const SYNC_WINDOW_DAYS = 180; // enough for a 90-day view plus its previous-period comparison
const FRESH_MS = 2 * 60 * 1000; // skip re-fetching from GitHub if synced within the last 2 minutes

const REPO_COLUMNS = `user_id, github_id, owner, name, full_name, description, language, stars, forks, open_issues,
  is_private, html_url, pushed_at`;

// One statement for any number of repositories (the repo list can be several hundred).
async function upsertRepositories(db, userId, rawRepos) {
  const repos = uniqueBy(rawRepos, (r) => r.full_name.toLowerCase());
  if (!repos.length) return [];
  const { rows } = await db.query(
    `INSERT INTO repositories (${REPO_COLUMNS})
     SELECT $1, x.github_id, x.owner, x.name, x.full_name, x.description, x.language, x.stars, x.forks,
            x.open_issues, x.is_private, x.html_url, x.pushed_at
     FROM jsonb_to_recordset($2::jsonb) AS x(
       github_id bigint, owner text, name text, full_name text, description text, language text, stars int,
       forks int, open_issues int, is_private boolean, html_url text, pushed_at timestamptz)
     ON CONFLICT (user_id, full_name) DO UPDATE SET
       github_id = EXCLUDED.github_id, description = EXCLUDED.description, language = EXCLUDED.language,
       stars = EXCLUDED.stars, forks = EXCLUDED.forks, open_issues = EXCLUDED.open_issues,
       is_private = EXCLUDED.is_private, html_url = EXCLUDED.html_url, pushed_at = EXCLUDED.pushed_at
     RETURNING *`,
    [userId, JSON.stringify(repos)],
  );
  return rows;
}

// Paginated GitHub listings can repeat an item when activity shifts pages mid-fetch; a single INSERT ... ON
// CONFLICT statement cannot touch the same row twice, so collapse duplicates first (last one wins).
const uniqueBy = (items, key) => [...new Map(items.map((i) => [key(i), i])).values()];

async function upsertCommits(db, repositoryId, rawCommits) {
  const commits = uniqueBy(rawCommits, (c) => c.sha);
  if (!commits.length) return;
  await db.query(
    `INSERT INTO commits (repository_id, sha, message, author_login, author_name, committed_at, html_url)
     SELECT $1, x.sha, x.message, x.author_login, x.author_name, x.committed_at, x.html_url
     FROM jsonb_to_recordset($2::jsonb)
       AS x(sha text, message text, author_login text, author_name text, committed_at timestamptz, html_url text)
     ON CONFLICT (repository_id, sha) DO UPDATE SET
       author_login = COALESCE(EXCLUDED.author_login, commits.author_login)`,
    [repositoryId, JSON.stringify(commits)],
  );
}

async function upsertPullRequests(db, repositoryId, rawPulls) {
  const pulls = uniqueBy(rawPulls, (p) => p.number);
  if (!pulls.length) return;
  await db.query(
    `INSERT INTO pull_requests
       (repository_id, number, title, state, author_login, created_at, updated_at, closed_at, merged_at, html_url)
     SELECT $1, x.number, x.title, x.state, x.author_login, x.created_at, x.updated_at, x.closed_at, x.merged_at, x.html_url
     FROM jsonb_to_recordset($2::jsonb)
       AS x(number int, title text, state text, author_login text, created_at timestamptz,
            updated_at timestamptz, closed_at timestamptz, merged_at timestamptz, html_url text)
     ON CONFLICT (repository_id, number) DO UPDATE SET
       title = EXCLUDED.title, state = EXCLUDED.state, updated_at = EXCLUDED.updated_at,
       closed_at = EXCLUDED.closed_at, merged_at = EXCLUDED.merged_at`,
    [repositoryId, JSON.stringify(pulls)],
  );
}

// The dashboard asks for summary, PRs and reports at the same moment. Without this, three requests
// would each pull the same repository from GitHub in parallel.
const inflight = new Map();

function syncRepository(deps, args) {
  const key = `${args.userId}:${args.owner}/${args.name}`.toLowerCase();
  if (!inflight.has(key)) {
    const run = doSync(deps, args).finally(() => inflight.delete(key));
    inflight.set(key, run);
  }
  return inflight.get(key);
}

const DAY = 86400000;
const RETENTION_DAYS = SYNC_WINDOW_DAYS + 30;

/**
 * Makes sure the repository (and its recent commits / PRs) is stored in PostgreSQL.
 * Fetching through the user's own token doubles as the access check for private repos.
 *
 * The first sync pulls the whole window; later ones only ask GitHub for what changed since the last
 * sync (with a day of overlap), which keeps a "Refresh" click to a couple of API calls.
 */
async function doSync({ db, github }, { userId, token, owner, name, force = false }) {
  const existing = await db.query(
    'SELECT * FROM repositories WHERE user_id = $1 AND lower(full_name) = lower($2)',
    [userId, `${owner}/${name}`],
  );
  const row = existing.rows[0];
  const lastSync = row?.last_synced_at ? new Date(row.last_synced_at).getTime() : null;
  if (lastSync && !force && Date.now() - lastSync < FRESH_MS) return row;

  const fullSince = new Date(Date.now() - SYNC_WINDOW_DAYS * DAY).toISOString();
  const fetchAll = (since) => Promise.all([
    github.getRepository(token, owner, name),
    github.listCommits(token, owner, name, since).catch((e) => {
      if (e.status === 409) return { commits: [], truncated: false }; // empty repository
      throw e;
    }),
    github.listPullRequests(token, owner, name, since),
  ]);

  // Incremental only when the previous sync is recent enough that nothing could fall in a gap.
  let incremental = Boolean(lastSync) && Date.now() - lastSync < (SYNC_WINDOW_DAYS - 30) * DAY;
  let [meta, commitResult, pullResult] = await fetchAll(
    incremental ? new Date(lastSync - DAY).toISOString() : fullSince,
  );
  if (incremental && (commitResult.truncated || pullResult.truncated)) {
    // So much changed that the delta itself hit the pagination cap: start over rather than leave a hole.
    incremental = false;
    [meta, commitResult, pullResult] = await fetchAll(fullSince);
  }

  const [repo] = await upsertRepositories(db, userId, [meta]);
  await upsertCommits(db, repo.id, commitResult.commits);
  await upsertPullRequests(db, repo.id, pullResult.pulls);

  // Remember how far back we really have data if the cap cut older commits off (a delta never changes that).
  const oldest = commitResult.commits.reduce((m, c) => (!m || c.committed_at < m ? c.committed_at : m), null);
  const truncated = incremental ? row.sync_truncated : commitResult.truncated || pullResult.truncated;
  const historyFrom = incremental ? row.history_from : (commitResult.truncated ? oldest : null);

  // Bounded storage: nothing older than the window plus a month is ever read.
  await db.query('DELETE FROM commits WHERE repository_id = $1 AND committed_at < now() - make_interval(days => $2)', [repo.id, RETENTION_DAYS]);
  await db.query(
    `DELETE FROM pull_requests WHERE repository_id = $1 AND state <> 'open'
       AND COALESCE(merged_at, closed_at, created_at) < now() - make_interval(days => $2)`,
    [repo.id, RETENTION_DAYS],
  );

  const { rows } = await db.query(
    `UPDATE repositories SET last_synced_at = now(), sync_truncated = $2, history_from = $3
     WHERE id = $1 RETURNING *`,
    [repo.id, truncated, historyFrom],
  );
  return rows[0];
}

module.exports = { syncRepository, upsertRepositories, SYNC_WINDOW_DAYS, uniqueBy };
