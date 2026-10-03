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
  listCommits: async function () {
    fakeGithub.calls++;
    return [
      { sha: 'a1', message: 'feat: one', author_login: 'ann', author_name: 'Ann', committed_at: iso(1), html_url: 'u' },
      { sha: 'a2', message: 'fix: two', author_login: 'bob', author_name: 'Bob', committed_at: iso(2), html_url: 'u' },
    ];
  },
  listPullRequests: async () => [
    { number: 1, title: 'PR one', state: 'merged', author_login: 'ann', created_at: iso(3), updated_at: iso(2), closed_at: iso(2), merged_at: iso(2), html_url: 'u' },
    { number: 2, title: 'PR two', state: 'open', author_login: 'bob', created_at: iso(1), updated_at: iso(1), closed_at: null, merged_at: null, html_url: 'u' },
  ],
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

  const summary = await request(app).get('/api/analytics/summary?repo=o/r&days=7').set('Cookie', cookie);
  assert.equal(summary.status, 200, JSON.stringify(summary.body));
  assert.equal(summary.body.totals.commits, 2);
  assert.equal(summary.body.totals.pullRequests, 2);
  assert.equal(summary.body.totals.mergedPullRequests, 1);
  assert.equal(summary.body.commitsByDay.length, 7);

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

  // Another user must not see this user's repository data.
  const other = await db.query(`INSERT INTO users (github_id, login, access_token_enc) VALUES (2, 'eve', $1) RETURNING id`, [encrypt('x', config.tokenEncryptionKey)]);
  const otherReports = await request(app).get('/api/ai/reports?repo=o/r').set('Cookie', sessionCookie(other.rows[0].id));
  assert.deepEqual(otherReports.body, []);
});
