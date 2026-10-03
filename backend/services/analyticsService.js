const DAY = 86400000;
const dayKey = (d) => new Date(d).toISOString().slice(0, 10);

/**
 * Pure aggregation over already-fetched rows. `commits` need committed_at / author_login,
 * `pulls` need state / created_at / merged_at / author_login.
 */
function buildSummary({ commits, pulls, days, now = new Date() }) {
  const end = new Date(now);
  const startMs = Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate()) - (days - 1) * DAY;

  const inRange = (d) => new Date(d).getTime() >= startMs;
  const windowCommits = commits.filter((c) => inRange(c.committed_at));
  const windowPulls = pulls.filter((p) => inRange(p.created_at));

  // Commits per day, zero-filled so charts have a continuous axis.
  const perDay = new Map();
  for (let i = 0; i < days; i++) perDay.set(dayKey(startMs + i * DAY), 0);
  for (const c of windowCommits) {
    const k = dayKey(c.committed_at);
    if (perDay.has(k)) perDay.set(k, perDay.get(k) + 1);
  }
  const commitsByDay = [...perDay].map(([date, count]) => ({ date, commits: count }));

  const prCounts = { open: 0, merged: 0, closed: 0 };
  for (const p of windowPulls) prCounts[p.state] += 1;

  const mergeHours = windowPulls
    .filter((p) => p.merged_at)
    .map((p) => (new Date(p.merged_at) - new Date(p.created_at)) / 3600000);
  const avgMergeHours = mergeHours.length
    ? Math.round((mergeHours.reduce((a, b) => a + b, 0) / mergeHours.length) * 10) / 10
    : null;

  const people = new Map();
  const bump = (login, field) => {
    if (!login) return;
    const entry = people.get(login) || { login, commits: 0, pullRequests: 0 };
    entry[field] += 1;
    people.set(login, entry);
  };
  windowCommits.forEach((c) => bump(c.author_login, 'commits'));
  windowPulls.forEach((p) => bump(p.author_login, 'pullRequests'));
  const topContributors = [...people.values()]
    .sort((a, b) => b.commits + b.pullRequests - (a.commits + a.pullRequests) || a.login.localeCompare(b.login))
    .slice(0, 8);

  const busiest = commitsByDay.reduce((m, d) => (d.commits > m.commits ? d : m), { date: null, commits: 0 });

  return {
    range: { days, since: new Date(startMs).toISOString() },
    totals: {
      commits: windowCommits.length,
      pullRequests: windowPulls.length,
      openPullRequests: prCounts.open,
      mergedPullRequests: prCounts.merged,
      closedPullRequests: prCounts.closed,
      contributors: people.size,
      avgMergeHours,
      busiestDay: busiest.commits ? busiest : null,
    },
    commitsByDay,
    pullRequestsByState: [
      { name: 'Merged', value: prCounts.merged },
      { name: 'Open', value: prCounts.open },
      { name: 'Closed', value: prCounts.closed },
    ],
    topContributors,
  };
}

async function loadAndSummarize(db, repositoryId, days) {
  const since = new Date(Date.now() - days * DAY).toISOString();
  const [commits, pulls] = await Promise.all([
    db.query('SELECT author_login, committed_at FROM commits WHERE repository_id = $1 AND committed_at >= $2', [repositoryId, since]),
    db.query('SELECT state, author_login, created_at, merged_at FROM pull_requests WHERE repository_id = $1 AND created_at >= $2', [repositoryId, since]),
  ]);
  return buildSummary({ commits: commits.rows, pulls: pulls.rows, days });
}

module.exports = { buildSummary, loadAndSummarize };
