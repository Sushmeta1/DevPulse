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
  const rows = pulls.map((p) => ({
    number: p.number, title: p.title, state: p.state, author_login: p.author_login ?? null,
    author_is_bot: Boolean(p.author_is_bot), is_draft: Boolean(p.is_draft),
    created_at: p.created_at, updated_at: p.updated_at ?? null, closed_at: p.closed_at ?? null, merged_at: p.merged_at ?? null,
    html_url: p.html_url ?? null, additions: p.additions ?? null, deletions: p.deletions ?? null, changed_files: p.changed_files ?? null,
    first_review_at: p.first_review_at ?? null, first_reviewer: p.first_reviewer ?? null, review_count: p.review_count ?? 0,
  }));
  const { rows: saved } = await db.query(
    `INSERT INTO pull_requests
       (repository_id, number, title, state, author_login, author_is_bot, is_draft, created_at, updated_at, closed_at, merged_at,
        html_url, additions, deletions, changed_files, first_review_at, first_reviewer, review_count, reviews_known)
     SELECT $1, x.number, x.title, x.state, x.author_login, x.author_is_bot, x.is_draft, x.created_at, x.updated_at, x.closed_at,
            x.merged_at, x.html_url, x.additions, x.deletions, x.changed_files, x.first_review_at, x.first_reviewer, x.review_count, TRUE
     FROM jsonb_to_recordset($2::jsonb)
       AS x(number int, title text, state text, author_login text, author_is_bot boolean, is_draft boolean, created_at timestamptz,
            updated_at timestamptz, closed_at timestamptz, merged_at timestamptz, html_url text, additions int, deletions int,
            changed_files int, first_review_at timestamptz, first_reviewer text, review_count int)
     ON CONFLICT (repository_id, number) DO UPDATE SET
       title = EXCLUDED.title, state = EXCLUDED.state, is_draft = EXCLUDED.is_draft, updated_at = EXCLUDED.updated_at,
       closed_at = EXCLUDED.closed_at, merged_at = EXCLUDED.merged_at, additions = EXCLUDED.additions,
       deletions = EXCLUDED.deletions, changed_files = EXCLUDED.changed_files, first_review_at = EXCLUDED.first_review_at,
       first_reviewer = EXCLUDED.first_reviewer, review_count = EXCLUDED.review_count, reviews_known = TRUE
     RETURNING id, number`,
    [repositoryId, JSON.stringify(rows)],
  );

  // Individual review events power reviewer-load analytics.
  const idByNumber = new Map(saved.map((r) => [r.number, r.id]));
  const reviews = pulls.flatMap((p) => (p.reviews || []).map((r) => ({
    pull_request_id: idByNumber.get(p.number), reviewer_login: r.reviewer_login, state: r.state,
    submitted_at: r.submitted_at, is_bot: Boolean(r.is_bot),
  }))).filter((r) => r.pull_request_id);
  const unique = uniqueBy(reviews, (r) => `${r.pull_request_id}|${r.reviewer_login}|${r.submitted_at}`);
  if (unique.length) {
    await db.query(
      `INSERT INTO pull_request_reviews (pull_request_id, reviewer_login, state, submitted_at, is_bot)
       SELECT x.pull_request_id, x.reviewer_login, x.state, x.submitted_at, x.is_bot
       FROM jsonb_to_recordset($1::jsonb)
         AS x(pull_request_id int, reviewer_login text, state text, submitted_at timestamptz, is_bot boolean)
       ON CONFLICT (pull_request_id, reviewer_login, submitted_at) DO UPDATE SET state = EXCLUDED.state`,
      [JSON.stringify(unique)],
    );
  }
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
const REVIEW_DATA_VERSION = 1; // bump when a new kind of per-PR data needs a one-off full backfill

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
  // A repository synced before review data existed must be re-read in full once, or old PRs would look "unreviewed".
  let incremental = Boolean(lastSync) && Date.now() - lastSync < (SYNC_WINDOW_DAYS - 30) * DAY
    && (row.review_data_version ?? 0) >= REVIEW_DATA_VERSION;
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
    `UPDATE repositories SET last_synced_at = now(), sync_truncated = $2, history_from = $3, review_data_version = $4
     WHERE id = $1 RETURNING *`,
    [repo.id, truncated, historyFrom, REVIEW_DATA_VERSION],
  );
  return rows[0];
}

module.exports = { syncRepository, upsertRepositories, SYNC_WINDOW_DAYS, uniqueBy };
