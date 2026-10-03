const DAY = 86400000;
const HOUR = 3600000;

// Upper bounds (hours) of the PR lead-time histogram buckets.
const LEAD_BUCKETS = [
  { label: '< 1h', max: 1 },
  { label: '1-4h', max: 4 },
  { label: '4-24h', max: 24 },
  { label: '1-3d', max: 72 },
  { label: '3-7d', max: 168 },
  { label: '> 7d', max: Infinity },
];
const STALE_PR_DAYS = 14;
const TOP_CONTRIBUTORS = 8;

const round1 = (n) => Math.round(n * 10) / 10;

function percentile(sorted, p) {
  if (!sorted.length) return null;
  const idx = Math.min(sorted.length - 1, Math.ceil(p * sorted.length) - 1);
  return round1(sorted[Math.max(0, idx)]);
}

/**
 * Pure aggregation over already-loaded rows.
 *
 * `tzOffset` is minutes east of UTC (IST = 330). Every "day" and "hour" below is a day/hour in that
 * timezone, so a commit at 23:30 local lands on the day the user remembers it happening.
 *
 * commits: { author_login, author_name, committed_at }
 * pulls:   { state, author_login, created_at, merged_at }   (anything touching the window or the previous one)
 * openPulls: { created_at }                                 (every PR that is open right now)
 */
function buildSummary({ commits, pulls, openPulls = [], days, now = new Date(), tzOffset = 0, previousAvailable = false }) {
  const off = tzOffset * 60000;
  const nowMs = new Date(now).getTime();
  const localMs = (t) => new Date(t).getTime() + off;
  const dayIdx = (t) => Math.floor(localMs(t) / DAY);
  const keyOf = (idx) => new Date(idx * DAY).toISOString().slice(0, 10);

  const today = dayIdx(nowMs);
  const start = today - (days - 1);
  const prevStart = start - days;
  const inCurrent = (idx) => idx >= start && idx <= today;
  const inPrevious = (idx) => idx >= prevStart && idx < start;

  const daily = Array.from({ length: days }, (_, i) => ({ date: keyOf(start + i), commits: 0, opened: 0, merged: 0 }));
  const prevCommitsDaily = Array.from({ length: days }, () => 0);
  const punchcard = Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => 0));

  const people = new Map();
  const prevPeople = new Set();
  const person = (c) => {
    const id = c.author_login || c.author_name;
    if (!id) return null;
    if (!people.has(id)) {
      people.set(id, {
        login: id, name: c.author_name || null, linked: Boolean(c.author_login),
        commits: 0, pullRequests: 0, series: Array.from({ length: days }, () => 0),
      });
    }
    return people.get(id);
  };

  let commitCount = 0;
  let prevCommitCount = 0;
  for (const c of commits) {
    const idx = dayIdx(c.committed_at);
    if (inCurrent(idx)) {
      commitCount += 1;
      daily[idx - start].commits += 1;
      const d = new Date(localMs(c.committed_at));
      punchcard[d.getUTCDay()][d.getUTCHours()] += 1;
      const p = person(c);
      if (p) { p.commits += 1; p.series[idx - start] += 1; }
    } else if (inPrevious(idx)) {
      prevCommitCount += 1;
      prevCommitsDaily[idx - prevStart] += 1;
      const id = c.author_login || c.author_name;
      if (id) prevPeople.add(id);
    }
  }

  const prCounts = { open: 0, merged: 0, closed: 0 };
  let opened = 0;
  let prevOpened = 0;
  let mergedInWindow = 0;
  let prevMerged = 0;
  const leadHours = [];
  const prevLeadHours = [];
  for (const p of pulls) {
    const created = dayIdx(p.created_at);
    if (inCurrent(created)) {
      opened += 1;
      daily[created - start].opened += 1;
      prCounts[p.state] += 1;
      const pp = person({ author_login: p.author_login });
      if (pp) pp.pullRequests += 1;
    } else if (inPrevious(created)) {
      prevOpened += 1;
    }
    if (p.merged_at) {
      const merged = dayIdx(p.merged_at);
      const hours = (new Date(p.merged_at) - new Date(p.created_at)) / HOUR;
      if (inCurrent(merged)) {
        mergedInWindow += 1;
        daily[merged - start].merged += 1;
        leadHours.push(hours);
      } else if (inPrevious(merged)) {
        prevMerged += 1;
        prevLeadHours.push(hours);
      }
    }
  }

  const sortedLead = [...leadHours].sort((a, b) => a - b);
  const prevSortedLead = [...prevLeadHours].sort((a, b) => a - b);
  const leadTime = LEAD_BUCKETS.map((b) => ({ label: b.label, count: 0 }));
  for (const h of leadHours) leadTime[LEAD_BUCKETS.findIndex((b) => h < b.max)].count += 1;

  const openAges = openPulls.map((p) => (nowMs - new Date(p.created_at).getTime()) / DAY);
  const activeDays = daily.filter((d) => d.commits > 0).length;
  let longestStreak = 0;
  let run = 0;
  for (const d of daily) {
    run = d.commits > 0 ? run + 1 : 0;
    longestStreak = Math.max(longestStreak, run);
  }
  const prevActiveDays = prevCommitsDaily.filter((n) => n > 0).length;

  const ranked = [...people.values()].sort(
    (a, b) => b.commits + b.pullRequests - (a.commits + a.pullRequests) || a.login.localeCompare(b.login),
  );
  const topContributors = ranked.slice(0, TOP_CONTRIBUTORS).map((p) => ({
    ...p,
    activeDays: p.series.filter((n) => n > 0).length,
  }));

  const busiest = daily.reduce((m, d) => (d.commits > m.commits ? d : m), { date: null, commits: 0 });
  const finished = prCounts.merged + prCounts.closed;

  return {
    range: { days, since: keyOf(start), until: keyOf(today), tzOffset, previousAvailable },
    totals: {
      commits: commitCount,
      pullRequests: opened,
      mergedPullRequests: mergedInWindow,
      openPullRequests: openPulls.length,
      closedPullRequests: prCounts.closed,
      contributors: people.size,
      activeDays,
      longestStreak,
      avgMergeHours: leadHours.length ? round1(leadHours.reduce((a, b) => a + b, 0) / leadHours.length) : null,
      medianMergeHours: percentile(sortedLead, 0.5),
      p90MergeHours: percentile(sortedLead, 0.9),
      mergeRate: finished ? Math.round((prCounts.merged / finished) * 100) : null,
      stalePullRequests: openAges.filter((a) => a > STALE_PR_DAYS).length,
      oldestOpenDays: openAges.length ? Math.floor(Math.max(...openAges)) : null,
      busiestDay: busiest.commits ? { date: busiest.date, commits: busiest.commits } : null,
    },
    previous: previousAvailable
      ? {
          commits: prevCommitCount,
          pullRequests: prevOpened,
          mergedPullRequests: prevMerged,
          contributors: prevPeople.size,
          activeDays: prevActiveDays,
          medianMergeHours: percentile(prevSortedLead, 0.5),
        }
      : null,
    daily,
    previousCommitsDaily: previousAvailable ? prevCommitsDaily : null,
    pullRequestsByState: [
      { name: 'Merged', value: prCounts.merged },
      { name: 'Open', value: prCounts.open },
      { name: 'Closed', value: prCounts.closed },
    ],
    leadTime,
    punchcard,
    topContributors,
  };
}

async function loadAndSummarize(db, repo, days, { tzOffset = 0, syncWindowDays = 180 } = {}) {
  // Two periods plus a day of slack either side so timezone shifts never clip a boundary day.
  const since = new Date(Date.now() - (days * 2 + 2) * DAY).toISOString();
  const [commits, pulls, open] = await Promise.all([
    db.query(
      'SELECT author_login, author_name, committed_at FROM commits WHERE repository_id = $1 AND committed_at >= $2',
      [repo.id, since],
    ),
    db.query(
      `SELECT state, author_login, created_at, merged_at FROM pull_requests
       WHERE repository_id = $1 AND (created_at >= $2 OR merged_at >= $2)`,
      [repo.id, since],
    ),
    db.query("SELECT created_at FROM pull_requests WHERE repository_id = $1 AND state = 'open'", [repo.id]),
  ]);
  const summary = buildSummary({
    commits: commits.rows,
    pulls: pulls.rows,
    openPulls: open.rows,
    days,
    tzOffset,
    previousAvailable: days * 2 <= syncWindowDays,
  });
  // Be honest when GitHub's pagination cap cut the history short of this window.
  const from = repo.history_from ? new Date(repo.history_from) : null;
  summary.dataQuality = {
    truncated: Boolean(repo.sync_truncated),
    historyFrom: from ? from.toISOString() : null,
    incomplete: Boolean(repo.sync_truncated && from && from > new Date(summary.range.since)),
  };
  return summary;
}

module.exports = { buildSummary, loadAndSummarize, LEAD_BUCKETS };
