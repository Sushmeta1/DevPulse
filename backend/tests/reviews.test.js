const test = require('node:test');
const assert = require('node:assert/strict');
const { cleanReviews, deriveReviewFields } = require('../services/reviewUtil');
const { buildSummary } = require('../services/analyticsService');
const github = require('../services/githubService');

const NOW = new Date('2025-03-10T12:00:00Z');
const H = 3600000;
const at = (hoursAgo) => new Date(NOW.getTime() - hoursAgo * H).toISOString();

// ---------------------------------------------------------------- review semantics
test('reviews: self-reviews, pending reviews and nameless authors are ignored; bots never count as the first human review', () => {
  const pr = {
    author_login: 'ann', created_at: at(48),
    reviews: [
      { reviewer_login: 'ann', state: 'COMMENTED', submitted_at: at(47), is_bot: false },      // replying to reviewers
      { reviewer_login: 'ci-bot', state: 'COMMENTED', submitted_at: at(46), is_bot: true },
      { reviewer_login: 'bob', state: 'PENDING', submitted_at: at(45), is_bot: false },
      { reviewer_login: null, state: 'COMMENTED', submitted_at: at(44), is_bot: false },
      { reviewer_login: 'cy', state: 'APPROVED', submitted_at: at(30), is_bot: false },
      { reviewer_login: 'bob', state: 'COMMENTED', submitted_at: at(40), is_bot: false },
    ],
  };
  assert.deepEqual(cleanReviews(pr.reviews, 'ann').map((r) => r.reviewer_login), ['ci-bot', 'bob', 'cy']);
  const f = deriveReviewFields(pr);
  assert.equal(f.first_reviewer, 'bob');
  assert.equal(f.first_review_at, at(40));
  assert.equal(f.review_count, 2); // bob + cy, the bot is not a human review
});

test('reviews: a PR with only bot reviews has no first human review', () => {
  const f = deriveReviewFields({ author_login: 'ann', created_at: at(10), reviews: [{ reviewer_login: 'bot', is_bot: true, state: 'COMMENTED', submitted_at: at(9) }] });
  assert.equal(f.first_review_at, null);
  assert.equal(f.review_count, 0);
});

// ---------------------------------------------------------------- GraphQL client
function graphqlResponse(nodes, hasNextPage = false) {
  return new Response(JSON.stringify({ data: { repository: { pullRequests: { pageInfo: { hasNextPage, endCursor: 'c1' }, nodes } } } }));
}
const node = (n, extra = {}) => ({
  number: n, title: `PR ${n}`, state: 'MERGED', isDraft: false, createdAt: at(30), updatedAt: at(5), closedAt: at(5), mergedAt: at(5),
  url: `https://github.com/o/r/pull/${n}`, additions: 30, deletions: 10, changedFiles: 3,
  author: { login: 'ann', __typename: 'User' },
  reviews: { nodes: [{ state: 'APPROVED', submittedAt: at(20), author: { login: 'bob', __typename: 'User' } }] }, ...extra,
});

test('github: parses pull requests, review activity and size from GraphQL', async (t) => {
  t.mock.method(globalThis, 'fetch', async (url, opts) => {
    assert.equal(String(url), 'https://api.github.com/graphql');
    assert.match(JSON.parse(opts.body).query, /reviews\(first: 30\)/);
    return graphqlResponse([
      node(1),
      node(2, { state: 'OPEN', mergedAt: null, closedAt: null, isDraft: true, author: { login: 'dependabot[bot]', __typename: 'Bot' }, reviews: { nodes: [] } }),
    ]);
  });
  const { pulls, truncated } = await github.listPullRequests('tok', 'o', 'r', at(24 * 30));
  assert.equal(truncated, false);
  assert.equal(pulls[0].state, 'merged');
  assert.equal(pulls[0].first_reviewer, 'bob');
  assert.equal(pulls[0].additions, 30);
  assert.equal(pulls[1].state, 'open');
  assert.equal(pulls[1].is_draft, true);
  assert.equal(pulls[1].author_is_bot, true);
  assert.equal(pulls[1].first_review_at, null);
});

test('github: pages by cursor and stops at the sync window', async (t) => {
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async (url, opts) => {
    calls += 1;
    const { cursor } = JSON.parse(opts.body).variables;
    if (cursor === null) return graphqlResponse([node(1), node(2)], true);
    return graphqlResponse([node(3), node(4, { updatedAt: at(24 * 100) })], true); // 4 is older than the window
  });
  const { pulls } = await github.listPullRequests('tok', 'o', 'r', at(24 * 30));
  assert.deepEqual(pulls.map((p) => p.number), [1, 2, 3]);
  assert.equal(calls, 2);
});

test('github: reports truncation when the page cap ends the listing', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => graphqlResponse([node(1)], true));
  const { truncated } = await github.listPullRequests('tok', 'o', 'r', at(24 * 30));
  assert.equal(truncated, true);
});

test('github: maps GraphQL errors to useful HTTP errors', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => new Response(JSON.stringify({ errors: [{ type: 'NOT_FOUND', message: 'x' }] })));
  await assert.rejects(github.listPullRequests('tok', 'o', 'r', at(10)), { status: 404 });
  t.mock.method(globalThis, 'fetch', async () => new Response('{}', { status: 401 }));
  await assert.rejects(github.listPullRequests('tok', 'o', 'r', at(10)), { status: 401 });
  t.mock.method(globalThis, 'fetch', async () => new Response('{}', { status: 403 }));
  await assert.rejects(github.listPullRequests('tok', 'o', 'r', at(10)), { status: 429 });
});

// ---------------------------------------------------------------- analytics
const pr = (over) => ({
  state: 'merged', author_login: 'ann', author_is_bot: false, is_draft: false, reviews_known: true,
  created_at: at(60), merged_at: at(30), first_review_at: at(55), additions: 20, deletions: 5, ...over,
});

test('analytics: time to first review, within-a-day rate and the previous-period comparison', () => {
  const pulls = [
    pr({ number: 1, created_at: at(60), first_review_at: at(58) }),                       // 2h
    pr({ number: 2, created_at: at(50), first_review_at: at(40) }),                       // 10h
    pr({ number: 3, created_at: at(100), first_review_at: at(40) }),                      // 60h (late)
    pr({ number: 4, created_at: at(24 * 9), first_review_at: at(24 * 9 - 20) }),          // previous period (days=7): 20h
    pr({ number: 5, state: 'open', merged_at: null, created_at: at(70), first_review_at: null }), // unreviewed > 1 day => a miss
    pr({ number: 6, is_draft: true, state: 'open', merged_at: null, created_at: at(70), first_review_at: null }), // drafts excluded
    pr({ number: 7, author_is_bot: true, created_at: at(70), first_review_at: null, state: 'open', merged_at: null }), // bots excluded
    pr({ number: 8, reviews_known: false, created_at: at(70), first_review_at: null, state: 'open', merged_at: null }), // not fetched yet
  ];
  const s = buildSummary({ commits: [], pulls, openPulls: [], days: 7, now: NOW, previousAvailable: true });
  const f = s.reviews.firstReview;
  assert.equal(f.reviewedCount, 3);
  assert.equal(f.medianHours, 10);
  assert.equal(f.p90Hours, 60);
  // 2 of the 3 reviewed within 24h; the open PR with no review for >24h counts against it: 2 / (3 + 1)
  assert.equal(f.withinDayPct, 50);
  assert.equal(s.reviews.previousMedianHours, 20);
  assert.equal(s.previous.medianFirstReviewHours, 20);
  assert.equal(s.totals.medianFirstReviewHours, 10);
  assert.equal(f.distribution.reduce((n, b) => n + b.count, 0), 3);
});

test('analytics: the waiting list holds only open, non-draft, non-bot PRs with no human review, longest wait first', () => {
  const open = (number, hours, over = {}) => ({
    number, title: `PR ${number}`, author_login: 'ann', author_is_bot: false, is_draft: false, reviews_known: true,
    created_at: at(hours), html_url: `u${number}`, first_review_at: null, ...over,
  });
  const s = buildSummary({
    commits: [], pulls: [], days: 7, now: NOW,
    openPulls: [open(1, 5), open(2, 120), open(3, 30, { first_review_at: at(10) }), open(4, 40, { is_draft: true }), open(5, 50, { author_is_bot: true }), open(6, 60, { reviews_known: false })],
  });
  assert.deepEqual(s.reviews.waiting.map((w) => w.number), [2, 1]);
  assert.equal(s.reviews.waitingCount, 2);
  assert.equal(s.reviews.waiting[0].hoursWaiting, 120);
});

test('analytics: reviewer load counts human reviews in the window and their first-response time', () => {
  const row = (reviewer, hoursAgo, state, prId, prCreatedHoursAgo, extra = {}) => ({
    reviewer_login: reviewer, submitted_at: at(hoursAgo), state, is_bot: false, pr_id: prId, pr_created_at: at(prCreatedHoursAgo), ...extra,
  });
  const reviewRows = [
    row('bob', 20, 'COMMENTED', 1, 30),   // bob touched PR1 first after 10h
    row('bob', 10, 'APPROVED', 1, 30),
    row('bob', 15, 'CHANGES_REQUESTED', 2, 25), // PR2 after 10h
    row('cy', 12, 'APPROVED', 3, 14),     // 2h
    row('ci', 5, 'COMMENTED', 4, 6, { is_bot: true }),
    row('old', 24 * 30, 'APPROVED', 5, 24 * 31), // outside the 7-day window
  ];
  const s = buildSummary({ commits: [], pulls: [], reviewRows, days: 7, now: NOW });
  const [bob, cy] = s.reviews.reviewers;
  assert.deepEqual([bob.login, bob.reviews, bob.prsReviewed, bob.approvals, bob.changesRequested], ['bob', 3, 2, 1, 1]);
  assert.equal(bob.medianResponseHours, 10);
  assert.equal(cy.login, 'cy');
  assert.equal(cy.medianResponseHours, 2);
  assert.equal(s.reviews.reviewerCount, 2, 'bots and out-of-window reviews do not count');
  assert.equal(s.reviews.totalReviews, 4);
  assert.equal(s.reviews.topReviewerShare, 75);
  assert.equal(bob.share, 75);
});

test('analytics: PR size buckets with the median merge time of each', () => {
  const sized = (lines, mergeHours, n) => pr({ number: n, additions: lines, deletions: 0, created_at: at(mergeHours + 10), merged_at: at(10) });
  const pulls = [sized(5, 2, 1), sized(8, 4, 2), sized(30, 10, 3), sized(100, 30, 4), sized(500, 70, 5), sized(2000, 150, 6)];
  const s = buildSummary({ commits: [], pulls, days: 14, now: NOW });
  const by = Object.fromEntries(s.size.buckets.map((b) => [b.label, b]));
  assert.deepEqual([by.XS.mergedCount, by.S.mergedCount, by.M.mergedCount, by.L.mergedCount, by.XL.mergedCount], [2, 1, 1, 1, 1]);
  assert.equal(by.XS.medianMergeHours, 2); // lower of the two (nearest-rank median)
  assert.equal(by.XL.medianMergeHours, 150);
  assert.equal(s.size.medianLines, 30); // nearest-rank median of 5, 8, 30, 100, 500, 2000
});

test('analytics: reports review data as unavailable while no PR has been fetched with reviews', () => {
  const s = buildSummary({ commits: [], pulls: [pr({ number: 1, reviews_known: false })], days: 7, now: NOW });
  assert.equal(s.reviews.available, false);
  assert.equal(buildSummary({ commits: [], pulls: [], days: 7, now: NOW }).reviews.available, true);
});
