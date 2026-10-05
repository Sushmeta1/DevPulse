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
const SIZE_BUCKETS = [
  { label: 'XS', range: '< 10 lines', max: 10 },
  { label: 'S', range: '10-49', max: 50 },
  { label: 'M', range: '50-249', max: 250 },
  { label: 'L', range: '250-999', max: 1000 },
  { label: 'XL', range: '1,000+', max: Infinity },
];
const WAITING_LIST_SIZE = 10;
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
function buildSummary({ commits, pulls, openPulls = [], reviewRows = [], days, now = new Date(), tzOffset = 0, previousAvailable = false }) {
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

  // ---- Reviews: who gets reviewed how fast, who is waiting, who does the reviewing -------------------------
  // Drafts, bot-authored PRs and PRs whose reviews have not been fetched yet are left out, so "no review"
  // never means "we have not looked".
  const eligible = (p) => !p.is_draft && !p.author_is_bot && p.reviews_known;
  const firstReviewHours = [];
  const prevFirstReviewHours = [];
  let reviewedWithinDay = 0;
  let unreviewedPastDay = 0;
  const sizeSamples = SIZE_BUCKETS.map(() => []);
  const sizes = [];
  for (const p of pulls) {
    const created = dayIdx(p.created_at);
    if (eligible(p)) {
      const wait = p.first_review_at ? Math.max(0, (new Date(p.first_review_at) - new Date(p.created_at)) / HOUR) : null;
      if (inCurrent(created)) {
        if (wait !== null) {
          firstReviewHours.push(wait);
          if (wait <= 24) reviewedWithinDay += 1;
        } else if (p.state === 'open' && nowMs - new Date(p.created_at).getTime() > DAY) {
          unreviewedPastDay += 1;
        }
      } else if (inPrevious(created) && wait !== null) {
        prevFirstReviewHours.push(wait);
      }
    }
    if (inCurrent(created) && p.additions !== null && p.additions !== undefined) sizes.push((p.additions || 0) + (p.deletions || 0));
    if (p.merged_at && p.additions !== null && p.additions !== undefined && inCurrent(dayIdx(p.merged_at))) {
      const lines = (p.additions || 0) + (p.deletions || 0);
      sizeSamples[SIZE_BUCKETS.findIndex((b) => lines < b.max)].push((new Date(p.merged_at) - new Date(p.created_at)) / HOUR);
    }
  }
  const sortedFirstReview = [...firstReviewHours].sort((a, b) => a - b);
  const sortedPrevFirstReview = [...prevFirstReviewHours].sort((a, b) => a - b);
  const reviewedCount = firstReviewHours.length;
  const firstReviewDistribution = LEAD_BUCKETS.map((b) => ({ label: b.label, count: 0 }));
  for (const h of firstReviewHours) firstReviewDistribution[LEAD_BUCKETS.findIndex((b) => h < b.max)].count += 1;

  const waiting = openPulls
    .filter((p) => eligible(p) && !p.first_review_at)
    .map((p) => ({
      number: p.number, title: p.title, authorLogin: p.author_login, htmlUrl: p.html_url, createdAt: p.created_at, repo: p.repo ?? null,
      hoursWaiting: Math.round(((nowMs - new Date(p.created_at).getTime()) / HOUR) * 10) / 10,
    }))
    .sort((a, b) => b.hoursWaiting - a.hoursWaiting);

  // Reviewer load: submitted reviews by humans inside the window.
  const reviewerMap = new Map();
  for (const r of reviewRows) {
    if (r.is_bot || !r.reviewer_login || !inCurrent(dayIdx(r.submitted_at))) continue;
    if (!reviewerMap.has(r.reviewer_login)) {
      reviewerMap.set(r.reviewer_login, { login: r.reviewer_login, reviews: 0, approvals: 0, changesRequested: 0, firstTouch: new Map() });
    }
    const entry = reviewerMap.get(r.reviewer_login);
    entry.reviews += 1;
    if (r.state === 'APPROVED') entry.approvals += 1;
    if (r.state === 'CHANGES_REQUESTED') entry.changesRequested += 1;
    const seen = entry.firstTouch.get(r.pr_id);
    const at = new Date(r.submitted_at).getTime();
    if (seen === undefined || at < seen.at) entry.firstTouch.set(r.pr_id, { at, created: new Date(r.pr_created_at).getTime() });
  }
  const reviewerList = [...reviewerMap.values()].sort((a, b) => b.reviews - a.reviews || a.login.localeCompare(b.login));
  const totalReviews = reviewerList.reduce((n, r) => n + r.reviews, 0);
  const reviewers = reviewerList.slice(0, TOP_CONTRIBUTORS).map((r) => ({
    login: r.login,
    reviews: r.reviews,
    prsReviewed: r.firstTouch.size,
    approvals: r.approvals,
    changesRequested: r.changesRequested,
    share: totalReviews ? Math.round((r.reviews / totalReviews) * 100) : 0,
    medianResponseHours: percentile([...r.firstTouch.values()].map((t) => Math.max(0, (t.at - t.created) / HOUR)).sort((a, b) => a - b), 0.5),
  }));

  const sortedSizes = [...sizes].sort((a, b) => a - b);
  const reviewsKnown = pulls.filter((p) => p.reviews_known).length;

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
      medianFirstReviewHours: percentile(sortedFirstReview, 0.5),
      oldestOpenDays: openAges.length ? Math.floor(Math.max(...openAges)) : null,
      busiestDay: busiest.commits ? { date: busiest.date, commits: busiest.commits } : null,
    },
    reviews: {
      // false while older PRs are still waiting for their first review-aware sync
      available: pulls.length === 0 || reviewsKnown > 0,
      firstReview: {
        medianHours: percentile(sortedFirstReview, 0.5),
        p90Hours: percentile(sortedFirstReview, 0.9),
        reviewedCount,
        withinDayPct: reviewedCount + unreviewedPastDay ? Math.round((reviewedWithinDay / (reviewedCount + unreviewedPastDay)) * 100) : null,
        distribution: firstReviewDistribution,
      },
      previousMedianHours: previousAvailable ? percentile(sortedPrevFirstReview, 0.5) : null,
      waitingCount: waiting.length,
      waiting: waiting.slice(0, WAITING_LIST_SIZE),
      reviewers,
      reviewerCount: reviewerList.length,
      totalReviews,
      topReviewerShare: reviewerList.length ? Math.round((reviewerList[0].reviews / totalReviews) * 100) : null,
    },
    size: {
      medianLines: percentile(sortedSizes, 0.5),
      buckets: SIZE_BUCKETS.map((b, i) => ({
        label: b.label, range: b.range, mergedCount: sizeSamples[i].length,
        medianMergeHours: percentile([...sizeSamples[i]].sort((x, y) => x - y), 0.5),
      })),
    },
    previous: previousAvailable
      ? {
          medianFirstReviewHours: percentile(sortedPrevFirstReview, 0.5),
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

/** Everything the analytics need for one repository, for a window of `days` plus the period before it. */
async function loadRows(db, repoId, days) {
  // Two periods plus a day of slack either side so timezone shifts never clip a boundary day.
  const since = new Date(Date.now() - (days * 2 + 2) * DAY).toISOString();
  const [commits, pulls, open, reviews] = await Promise.all([
    db.query(
      'SELECT author_login, author_name, committed_at FROM commits WHERE repository_id = $1 AND committed_at >= $2',
      [repoId, since],
    ),
    db.query(
      `SELECT state, author_login, author_is_bot, is_draft, created_at, merged_at, additions, deletions, first_review_at, reviews_known
       FROM pull_requests WHERE repository_id = $1 AND (created_at >= $2 OR merged_at >= $2)`,
      [repoId, since],
    ),
    db.query(
      `SELECT number, title, author_login, author_is_bot, is_draft, created_at, html_url, first_review_at, reviews_known
       FROM pull_requests WHERE repository_id = $1 AND state = 'open'`,
      [repoId],
    ),
    db.query(
      `SELECT r.reviewer_login, r.submitted_at, r.state, r.is_bot, p.id AS pr_id, p.created_at AS pr_created_at
       FROM pull_request_reviews r JOIN pull_requests p ON p.id = r.pull_request_id
       WHERE p.repository_id = $1 AND r.submitted_at >= $2`,
      [repoId, since],
    ),
  ]);
  return { commits: commits.rows, pulls: pulls.rows, openPulls: open.rows, reviewRows: reviews.rows };
}

/** Marks the summary honestly when GitHub's pagination cap cut history short of the window. */
function applyDataQuality(summary, repo, days) {
  const from = repo.history_from ? new Date(repo.history_from) : null;
  // If the cap cut history off inside the previous period, that period is partial: comparing against it
  // would show a wildly inflated "+315%". Drop the comparison rather than mislead.
  if (from && repo.sync_truncated) {
    const prevStart = new Date(`${summary.range.since}T00:00:00Z`);
    prevStart.setUTCDate(prevStart.getUTCDate() - days);
    if (from > prevStart) {
      summary.previous = null;
      summary.previousCommitsDaily = null;
      summary.reviews.previousMedianHours = null;
      summary.range.previousAvailable = false;
    }
  }
  summary.dataQuality = {
    truncated: Boolean(repo.sync_truncated),
    historyFrom: from ? from.toISOString() : null,
    incomplete: Boolean(repo.sync_truncated && from && from > new Date(summary.range.since)),
  };
  return summary;
}

async function loadAndSummarize(db, repo, days, { tzOffset = 0, syncWindowDays = 180 } = {}) {
  const rows = await loadRows(db, repo.id, days);
  const summary = buildSummary({ ...rows, days, tzOffset, previousAvailable: days * 2 <= syncWindowDays });
  return applyDataQuality(summary, repo, days);
}

module.exports = { buildSummary, loadAndSummarize, loadRows, applyDataQuality, LEAD_BUCKETS, SIZE_BUCKETS };
