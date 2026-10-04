const test = require('node:test');
const assert = require('node:assert/strict');
const { renderDigest, change, escHtml, escSlack, safeUrl, HOUR_LABEL } = require('../services/digestRender');
const { isDue, localWeekday, sendSlack, sendEmail, statusFor, emailConfigured } = require('../services/digestService');

// ------------------------------------------------------------------------------------------ fixtures
const waitingPr = (over = {}) => ({ number: 7, title: 'Add retry', authorLogin: 'ann', htmlUrl: 'https://github.com/o/r/pull/7', createdAt: '2025-01-01', hoursWaiting: 52, repo: 'o/r', ...over });
const team = (over = {}) => ({
  repos: [{ fullName: 'o/r', commits: 12, mergedPullRequests: 3, waitingForReview: 1 }, { fullName: 'o/q', commits: 4, mergedPullRequests: 0, waitingForReview: 0 }],
  skipped: [],
  aggregate: {
    totals: { commits: 16, mergedPullRequests: 3, medianMergeHours: 20, stalePullRequests: 2 },
    previous: { commits: 10, mergedPullRequests: 3, medianMergeHours: 40 },
    topContributors: [{ login: 'ann', commits: 9, pullRequests: 2 }],
    reviews: {
      firstReview: { medianHours: 6 }, previousMedianHours: 4, waitingCount: 1, waiting: [waitingPr()],
      reviewers: [{ login: 'bob', reviews: 5, share: 60 }], topReviewerShare: 60,
    },
    dataQuality: { incomplete: false, incompleteRepos: [] },
    ...over,
  },
});
const report = { provider: 'local', content: { summary: 'A calm week.', insights: [], suggestions: ['Review the waiting pull request.'] } };
const base = 'https://pulse.example.edu';

// -------------------------------------------------------------------------------------------- helpers
test('change() formats comparisons and stays silent when there is nothing honest to say', () => {
  assert.equal(change(12, 10), '+20%');
  assert.equal(change(5, 10), '-50%');
  assert.equal(change(10, 10), '');
  assert.equal(change(4, 0), 'new');
  assert.equal(change(0, 0), '');
  assert.equal(change(5, null), '');
  assert.equal(change(null, 5), '');
});

test('HOUR_LABEL matches the dashboard formatting', () => {
  assert.deepEqual([null, 0.5, 7.46, 30, 72].map(HOUR_LABEL), ['-', '30m', '7.5h', '30h', '3d']);
});

test('escaping helpers neutralise markup', () => {
  assert.equal(escHtml('<b>"&\'</b>'), '&lt;b&gt;&quot;&amp;&#39;&lt;/b&gt;');
  assert.equal(escSlack('a & <b> c'), 'a &amp; &lt;b&gt; c');
  assert.equal(safeUrl('https://github.com/o/r/pull/1'), 'https://github.com/o/r/pull/1');
  assert.equal(safeUrl('javascript:alert(1)'), null);
  assert.equal(safeUrl('http://insecure.example'), null);
  assert.equal(safeUrl('https://x.example/a b'), null);
  assert.equal(safeUrl(undefined), null);
});

// ------------------------------------------------------------------------------------------ rendering
test('renders subject, numbers, waiting list and actions for e-mail, text and Slack', () => {
  const out = renderDigest({ team: team(), report, baseUrl: base });
  assert.equal(out.subject, 'DevPulse weekly: 16 commits, 3 merged, 1 waiting for review');
  for (const needle of ['16', '+60%', 'Add retry', 'waiting 2.2d', 'o/r', 'Open the team view', 'A calm week.', 'Review the waiting pull request.']) {
    assert.ok(out.html.includes(needle), `html has ${needle}`);
  }
  assert.ok(out.html.includes(`${base}/dashboard/team?range=7`));
  assert.ok(out.text.includes('- o/r #7 Add retry (2.2d) https://github.com/o/r/pull/7'));
  assert.ok(out.text.includes('Time to first review') || out.text.includes('Median time to first review: 6h (+50%)'));
  const types = out.slack.blocks.map((b) => b.type);
  assert.deepEqual(types.slice(0, 3), ['header', 'context', 'section']);
  assert.equal(types.at(-1), 'actions');
  assert.equal(out.slack.text, out.subject);
  assert.ok(out.slack.blocks.length <= 50);
  assert.ok(out.slack.blocks[2].fields.length === 4 && out.slack.blocks[2].fields.every((f) => f.text.length < 2000));
});

test('colours a change by whether it is good: lower time-to-merge is green, higher is red', () => {
  const html = renderDigest({ team: team(), report, baseUrl: base }).html;
  // medianMergeHours went 40h -> 20h (-50%): lower is better, so it must be green
  const idx = html.indexOf('Median time to merge');
  assert.match(html.slice(idx, idx + 400), /#0a6847/);
  const worse = renderDigest({ team: team({ previous: { commits: 10, mergedPullRequests: 3, medianMergeHours: 10 } }), report, baseUrl: base }).html;
  const j = worse.indexOf('Median time to merge');
  assert.match(worse.slice(j, j + 400), /#b3121d/);
});

test('untrusted text from GitHub can never inject markup or links', () => {
  const evil = team();
  evil.aggregate.reviews.waiting = [waitingPr({ title: '<script>alert(1)</script> & "quotes"', repo: '"><img src=x onerror=alert(1)>', htmlUrl: 'javascript:alert(1)' })];
  evil.aggregate.topContributors = [{ login: '<b>x</b>', commits: 1, pullRequests: 0 }];
  evil.repos = [{ fullName: '<i>repo</i>', commits: 1, mergedPullRequests: 0, waitingForReview: 0 }];
  const out = renderDigest({ team: evil, report: { provider: 'local', content: { summary: '<script>x</script>', suggestions: ['<a href=x>'] } }, baseUrl: base });
  assert.ok(!out.html.includes('<script>'));
  assert.ok(!out.html.includes('<img'));
  assert.ok(!out.html.includes('<b>x</b>'));
  assert.ok(!out.html.includes('javascript:'));
  assert.ok(!out.html.includes('<i>repo'));
  assert.ok(out.html.includes('&lt;script&gt;'));
  const slackText = JSON.stringify(out.slack);
  assert.ok(!slackText.includes('javascript:'));
  assert.ok(slackText.includes('&lt;script&gt;'));
});

test('a quiet week still renders cleanly with no empty sections', () => {
  const quiet = team({ totals: { commits: 0, mergedPullRequests: 0, medianMergeHours: null, stalePullRequests: 0 }, previous: null });
  quiet.aggregate.reviews = { firstReview: { medianHours: null }, previousMedianHours: null, waitingCount: 0, waiting: [], reviewers: [], topReviewerShare: null };
  quiet.aggregate.topContributors = [];
  quiet.repos = [];
  const out = renderDigest({ team: quiet, report: null, baseUrl: base });
  assert.equal(out.subject, 'DevPulse weekly: 0 commits, 0 merged');
  assert.ok(!out.html.includes('Waiting for a first review'));
  assert.ok(!out.html.includes('Most active repositories'));
  assert.ok(!out.text.includes('Summary'));
  assert.ok(out.slack.blocks.every((b) => b.type !== 'section' || !/Waiting/.test(JSON.stringify(b))));
});

test('flags repositories whose history GitHub truncated', () => {
  const out = renderDigest({ team: team({ dataQuality: { incomplete: true, incompleteRepos: ['o/big'] } }), report, baseUrl: base });
  assert.ok(out.html.includes('History is incomplete for o/big'));
  assert.ok(out.text.includes('o/big'));
});

// --------------------------------------------------------------------------------------------- schedule
test('isDue: weekday, time zone, minimum gap, disabled and retry rules', () => {
  const monday10utc = new Date('2025-03-10T10:00:00Z'); // a Monday
  const d = (over) => ({ enabled: true, weekday: 1, tz_offset: 0, last_sent_at: null, last_attempt_at: null, last_status: null, ...over });
  assert.equal(localWeekday(monday10utc, 0), 1);
  assert.equal(isDue(d(), monday10utc), true);
  assert.equal(isDue(d({ weekday: 2 }), monday10utc), false);
  assert.equal(isDue(d({ enabled: false }), monday10utc), false);
  // 22:00 UTC Monday is already Tuesday in India (UTC+5:30)
  const mon22 = new Date('2025-03-10T22:00:00Z');
  assert.equal(isDue(d({ weekday: 2, tz_offset: 330 }), mon22), true);
  assert.equal(isDue(d({ weekday: 1, tz_offset: 330 }), mon22), false);
  // never twice in a week
  assert.equal(isDue(d({ last_sent_at: '2025-03-07T07:00:00Z' }), monday10utc), false);
  assert.equal(isDue(d({ last_sent_at: '2025-03-03T07:00:00Z' }), monday10utc), true);
  // a failed attempt is retried on a later day even though it is not the chosen weekday
  const failed = d({ weekday: 5, last_status: 'error: slack: Slack returned 500', last_attempt_at: '2025-03-09T07:00:00Z' });
  assert.equal(isDue(failed, monday10utc), true);
  assert.equal(isDue({ ...failed, last_attempt_at: '2025-03-10T09:00:00Z' }, monday10utc), false, 'not within 10h of the last attempt');
  assert.equal(isDue({ ...failed, last_status: 'sent' }, monday10utc), false);
});

test('statusFor summarises per-channel outcomes', () => {
  assert.equal(statusFor([]), 'error: no delivery channel is set up');
  assert.equal(statusFor([{ channel: 'slack', ok: true }]), 'sent');
  assert.equal(statusFor([{ channel: 'slack', ok: false, error: 'x' }]), 'error: slack: x');
  assert.match(statusFor([{ channel: 'slack', ok: true }, { channel: 'email', ok: false, error: 'y' }]), /^sent \(partial\): email: y/);
});

// -------------------------------------------------------------------------------------------- delivery
test('sendSlack posts JSON to Slack only, and surfaces failures', async (t) => {
  const url = 'https://hooks.slack.com/services/T000/B000/abcDEF123';
  let seen;
  t.mock.method(globalThis, 'fetch', async (u, opts) => { seen = { u: String(u), body: JSON.parse(opts.body), method: opts.method }; return new Response('ok'); });
  await sendSlack(url, { text: 'hi', blocks: [] });
  assert.deepEqual(seen, { u: url, body: { text: 'hi', blocks: [] }, method: 'POST' });
  await assert.rejects(sendSlack('https://evil.example/hook', {}), /invalid/);
  await assert.rejects(sendSlack('http://hooks.slack.com/services/a/b/c', {}), /invalid/);
  t.mock.method(globalThis, 'fetch', async () => new Response('no', { status: 500 }));
  await assert.rejects(sendSlack(url, {}), /Slack returned 500/);
});

test('sendEmail needs configuration and sends through Resend with a bearer key', async (t) => {
  assert.equal(emailConfigured({ email: { apiKey: '', from: '' } }), false);
  await assert.rejects(sendEmail({ email: { apiKey: '', from: '' } }, {}), /not configured/);
  let seen;
  t.mock.method(globalThis, 'fetch', async (u, opts) => { seen = { u: String(u), auth: opts.headers.Authorization, body: JSON.parse(opts.body) }; return new Response('{}'); });
  const config = { email: { apiKey: 're_123', from: 'DevPulse <digest@pulse.example.edu>' } };
  await sendEmail(config, { to: 'ann@example.edu', subject: 'S', html: '<p>h</p>', text: 't' });
  assert.equal(seen.u, 'https://api.resend.com/emails');
  assert.equal(seen.auth, 'Bearer re_123');
  assert.deepEqual(seen.body.to, ['ann@example.edu']);
  assert.equal(seen.body.from, config.email.from);
  t.mock.method(globalThis, 'fetch', async () => new Response('{}', { status: 422 }));
  await assert.rejects(sendEmail(config, { to: 'a@b.c', subject: 'S', html: 'h', text: 't' }), /returned 422/);
});
