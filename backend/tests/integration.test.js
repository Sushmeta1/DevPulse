// Runs against a real PostgreSQL instance. Set TEST_DATABASE_URL to enable (CI does).
const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const { createPool } = require('../config/db');
const { migrate } = require('../config/migrate');
const { createApp } = require('../app');
const { config, sessionCookie } = require('./helpers');
const { encrypt } = require('../utils/crypto');

const url = process.env.TEST_DATABASE_URL;
const iso = (daysAgo) => new Date(Date.now() - daysAgo * 86400000).toISOString();

const fakeGithub = {
  calls: 0,
  getRepository: async (t, owner, name) => ({
    github_id: 1, owner, name, full_name: `${owner}/${name}`, description: 'd', language: 'JS',
    stars: 5, forks: 1, open_issues: 2, is_private: false, html_url: 'https://github.com/o/r', pushed_at: iso(1),
  }),
  listCommits: async function (t, owner, name) {
    fakeGithub.calls++;
    await new Promise((r) => setTimeout(r, 30)); // widen the window for concurrent callers
    return {
      truncated: name === 'big',
      commits: [
        { sha: 'a1', message: 'feat: one', author_login: 'ann', author_name: 'Ann', committed_at: iso(1), html_url: 'u' },
        { sha: 'a2', message: 'fix: two', author_login: 'bob', author_name: 'Bob', committed_at: iso(2), html_url: 'u' },
      ],
    };
  },
  listPullRequests: async () => ({
    truncated: false,
    pulls: [
      { number: 1, title: 'PR one', state: 'merged', author_login: 'ann', created_at: iso(3), updated_at: iso(2), closed_at: iso(2), merged_at: iso(2), html_url: 'u' },
      { number: 2, title: 'PR two', state: 'open', author_login: 'bob', created_at: iso(1), updated_at: iso(1), closed_at: null, merged_at: null, html_url: 'u' },
    ],
  }),
};

test('sync, analytics and AI report against PostgreSQL', { skip: !url && 'TEST_DATABASE_URL not set' }, async (t) => {
  const db = createPool({ databaseUrl: url });
  t.after(() => db.end());
  await migrate(db);
  await migrate(db); // idempotent
  await db.query('TRUNCATE users CASCADE');
  const { rows } = await db.query(
    `INSERT INTO users (github_id, login, access_token_enc) VALUES (1, 'octo', $1) RETURNING id`,
    [encrypt('gh-token', config.tokenEncryptionKey)],
  );
  const cookie = sessionCookie(rows[0].id);
  const app = createApp({ config, db, github: fakeGithub });

  // The dashboard fires several requests at once; they must share a single GitHub sync.
  const [summary] = await Promise.all([
    request(app).get('/api/analytics/summary?repo=o/r&days=7&tzOffset=330').set('Cookie', cookie),
    request(app).get('/api/repositories/o/r/pulls').set('Cookie', cookie),
    request(app).get('/api/repositories/o/r/commits').set('Cookie', cookie),
  ]);
  assert.equal(summary.status, 200, JSON.stringify(summary.body));
  assert.equal(fakeGithub.calls, 1, 'concurrent requests should be deduplicated');
  assert.equal(summary.body.totals.commits, 2);
  assert.equal(summary.body.totals.pullRequests, 2);
  assert.equal(summary.body.totals.mergedPullRequests, 1);
  assert.equal(summary.body.totals.openPullRequests, 1);
  assert.equal(summary.body.daily.length, 7);
  assert.equal(summary.body.range.tzOffset, 330);
  assert.equal(summary.body.previous.commits, 0);
  assert.equal(summary.body.dataQuality.truncated, false);

  // Second call within the freshness window is served from PostgreSQL.
  await request(app).get('/api/analytics/summary?repo=o/r').set('Cookie', cookie);
  assert.equal(fakeGithub.calls, 1);

  const commits = await request(app).get('/api/repositories/o/r/commits').set('Cookie', cookie);
  assert.deepEqual(commits.body.map((c) => c.sha), ['a1', 'a2']);
  const pulls = await request(app).get('/api/repositories/o/r/pulls').set('Cookie', cookie);
  assert.equal(pulls.body.length, 2);

  const created = await request(app).post('/api/ai/sprint-summary').set('Cookie', cookie).send({ repo: 'o/r', days: 7 });
  assert.equal(created.status, 201);
  assert.equal(created.body.provider, 'local');
  const list = await request(app).get('/api/ai/reports?repo=o/r').set('Cookie', cookie);
  assert.equal(list.body.length, 1);

  // When GitHub pagination capped the history, the API says so instead of silently under-reporting.
  const big = await request(app).get('/api/analytics/summary?repo=o/big&days=90').set('Cookie', cookie);
  assert.equal(big.body.dataQuality.truncated, true);
  assert.ok(big.body.dataQuality.historyFrom);
  assert.equal(big.body.range.previousAvailable, true);
  assert.ok(big.body.previous, '90d + the previous 90d fit exactly in the 180d sync window');

  // Another user must not see this user's repository data.
  const other = await db.query(`INSERT INTO users (github_id, login, access_token_enc) VALUES (2, 'eve', $1) RETURNING id`, [encrypt('x', config.tokenEncryptionKey)]);
  const otherReports = await request(app).get('/api/ai/reports?repo=o/r').set('Cookie', sessionCookie(other.rows[0].id));
  assert.deepEqual(otherReports.body, []);
});

test('demo workspace runs the real pipeline on generated data', { skip: !url && 'TEST_DATABASE_URL not set' }, async (t) => {
  const db = createPool({ databaseUrl: url });
  t.after(() => db.end());
  await migrate(db);
  await db.query('TRUNCATE users CASCADE');
  const withKey = { ...config, ai: { ...config.ai, provider: 'gemini', geminiApiKey: 'would-cost-money' } };
  const app = createApp({ config: withKey, db, github: {} }); // real github client would throw: demo must not use it
  const agent = request.agent(app);

  assert.equal((await agent.post('/api/auth/demo')).status, 204);
  const me = await agent.get('/api/user');
  assert.equal(me.body.isDemo, true);

  const repos = await agent.get('/api/repositories');
  assert.equal(repos.status, 200);
  assert.ok(repos.body.length >= 8);

  const web = await agent.get('/api/analytics/summary?repo=acme/web&days=30');
  assert.equal(web.status, 200);
  assert.ok(web.body.totals.commits > 50);
  assert.ok(web.body.topContributors.length >= 5);
  assert.ok(web.body.previous.commits > 0);

  const empty = await agent.get('/api/analytics/summary?repo=acme/empty');
  assert.equal(empty.status, 200);
  assert.equal(empty.body.totals.commits, 0);

  const big = await agent.get('/api/analytics/summary?repo=acme/monorepo&days=90');
  assert.equal(big.body.dataQuality.truncated, true);

  const missing = await agent.get('/api/analytics/summary?repo=acme/nope');
  assert.equal(missing.status, 404);

  // The demo account must never spend a real AI key.
  const report = await agent.post('/api/ai/sprint-summary').send({ repo: 'acme/web', days: 14 });
  assert.equal(report.status, 201);
  assert.equal(report.body.provider, 'local');
});

test('sync tolerates duplicate rows returned by shifting GitHub pagination', { skip: !url && 'TEST_DATABASE_URL not set' }, async (t) => {
  const db = createPool({ databaseUrl: url });
  t.after(() => db.end());
  await migrate(db);
  await db.query('TRUNCATE users CASCADE');
  const { rows } = await db.query(`INSERT INTO users (github_id, login, access_token_enc) VALUES (5, 'dup', $1) RETURNING id`, [encrypt('t', config.tokenEncryptionKey)]);
  const commit = { sha: 'same', message: 'm', author_login: 'a', author_name: 'A', committed_at: iso(1), html_url: 'u' };
  const pull = { number: 7, title: 'T', state: 'open', author_login: 'a', created_at: iso(1), updated_at: iso(1), closed_at: null, merged_at: null, html_url: 'u' };
  const github = {
    getRepository: fakeGithub.getRepository,
    listCommits: async () => ({ commits: [commit, commit], truncated: false }),
    listPullRequests: async () => ({ pulls: [pull, pull], truncated: false }),
  };
  const app = createApp({ config, db, github });
  const res = await request(app).get('/api/analytics/summary?repo=o/dupe').set('Cookie', sessionCookie(rows[0].id));
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.body.totals.commits, 1);
  assert.equal(res.body.totals.pullRequests, 1);
});
