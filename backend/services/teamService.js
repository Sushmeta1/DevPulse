const { syncRepository, SYNC_WINDOW_DAYS } = require('./syncService');
const { buildSummary, loadRows, applyDataQuality } = require('./analyticsService');

const MAX_REPOS = 15;
const MAX_FIRST_SYNCS = 5; // a request must stay well inside a serverless time limit
const CONCURRENCY = 3;

/** Runs `fn` over `items` with at most `limit` in flight, keeping input order. */
async function mapLimit(items, limit, fn) {
  const out = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i], i);
    }
  }));
  return out;
}

const miniFor = (repo, s) => ({
  fullName: repo.full_name,
  description: repo.description,
  language: repo.language,
  commits: s.totals.commits,
  previousCommits: s.previous?.commits ?? null,
  pullRequests: s.totals.pullRequests,
  mergedPullRequests: s.totals.mergedPullRequests,
  openPullRequests: s.totals.openPullRequests,
  stalePullRequests: s.totals.stalePullRequests,
  contributors: s.totals.contributors,
  medianMergeHours: s.totals.medianMergeHours,
  medianFirstReviewHours: s.reviews.firstReview.medianHours,
  waitingForReview: s.reviews.waitingCount,
  daily: s.daily.map((d) => d.commits),
  incomplete: s.dataQuality.incomplete,
});


/**
 * One set of metrics across several repositories. The aggregate is computed by the same pure function as a
 * single repository, over all rows together, so team numbers always equal the sum of the parts.
 *
 * `names` are full names ("owner/repo"). Repositories that cannot be read are reported in `skipped`, not fatal.
 */
async function computeTeam(deps, { userId, token, names, days, tzOffset = 0, force = false }) {
  // Which of the requested repositories have never been analyzed? Only a few are synced per call.
  const known = await deps.db.query(
    'SELECT lower(full_name) AS key, last_synced_at FROM repositories WHERE user_id = $1 AND lower(full_name) = ANY($2::text[])',
    [userId, names.map((n) => n.toLowerCase())],
  );
  const synced = new Set(known.rows.filter((r) => r.last_synced_at).map((r) => r.key));
  let firstSyncs = 0;

  const skipped = [];
  const loaded = await mapLimit(names, CONCURRENCY, async (full) => {
    const [owner, name] = full.split('/');
    if (!synced.has(full.toLowerCase())) {
      if (firstSyncs >= MAX_FIRST_SYNCS) {
        skipped.push({ repo: full, reason: `Open it once first. Only ${MAX_FIRST_SYNCS} new repositories are analyzed per request.` });
        return null;
      }
      firstSyncs += 1;
    }
    try {
      const repo = await syncRepository(deps, { userId, token, owner, name, force });
      const rows = await loadRows(deps.db, repo.id, days);
      return { repo, rows };
    } catch (err) {
      if (err.status === 401) throw err; // the whole session is bad: let the caller sign in again
      skipped.push({ repo: full, reason: err.message });
      return null;
    }
  });
  const ok = loaded.filter(Boolean);

  const previousAvailable = days * 2 <= SYNC_WINDOW_DAYS;
  const perRepo = ok.map(({ repo, rows }) => ({
    repo,
    summary: applyDataQuality(buildSummary({ ...rows, days, tzOffset, previousAvailable }), repo, days),
  }));

  const tag = (rows, repo) => rows.map((r) => ({ ...r, repo: repo.full_name }));
  const aggregate = buildSummary({
    commits: ok.flatMap(({ rows }) => rows.commits),
    pulls: ok.flatMap(({ rows }) => rows.pulls),
    openPulls: ok.flatMap(({ repo, rows }) => tag(rows.openPulls, repo)),
    reviewRows: ok.flatMap(({ rows }) => rows.reviewRows),
    days,
    tzOffset,
    // A single partial previous period makes the combined comparison unreliable, so require all of them.
    previousAvailable: previousAvailable && perRepo.every(({ summary }) => summary.range.previousAvailable),
  });
  const incompleteRepos = perRepo.filter(({ summary }) => summary.dataQuality.incomplete).map(({ repo }) => repo.full_name);
  aggregate.dataQuality = { incomplete: incompleteRepos.length > 0, incompleteRepos };

  return {
    range: aggregate.range,
    aggregate,
    repos: perRepo.map(({ repo, summary }) => miniFor(repo, summary)).sort((a, b) => b.commits - a.commits),
    skipped,
  };
}

module.exports = { computeTeam, mapLimit, MAX_REPOS };
