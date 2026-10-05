// Needs PostgreSQL: set TEST_DATABASE_URL (CI does).
const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const { createPool } = require('../config/db');
const { migrate } = require('../config/migrate');
const { createApp } = require('../app');
const { encrypt } = require('../utils/crypto');
const { mapLimit } = require('../services/teamService');
const { config, sessionCookie } = require('./helpers');

const url = process.env.TEST_DATABASE_URL;
const skip = !url && 'TEST_DATABASE_URL not set';
const HOUR = 3600000;
const ago = (h) => new Date(Date.now() - h * HOUR).toISOString();

const commit = (sha, login, hoursAgo) => ({ sha, message: 'm', author_login: login, author_name: login, committed_at: ago(hoursAgo), html_url: 'u' });
const pull = (number, over = {}) => ({
  number, title: `PR ${number}`, state: 'open', author_login: 'ann', author_is_bot: false, is_draft: false, created_at: ago(30), updated_at: ago(1),
  closed_at: null, merged_at: null, html_url: `https://github.com/o/x/pull/${number}`, additions: 10, deletions: 2, changed_files: 1,
  first_review_at: null, first_reviewer: null, review_count: 0, reviews: [], ...over,
});

const DATA = {
  alpha: { commits: [commit('a1', 'ann', 5), commit('a2', 'bob', 10), commit('a3', 'ann', 30)], pulls: [pull(1)] },
  beta: { commits: [commit('b1', 'ann', 6), commit('b2', 'cy', 20)], pulls: [pull(2, { state: 'merged', merged_at: ago(5), first_review_at: ago(20), first_reviewer: 'bob', review_count: 1, reviews: [{ reviewer_login: 'bob', is_bot: false, state: 'APPROVED', submitted_at: ago(20) }] })] },
};

function fakeGithub() {
  return {
    getRepository: async (t, owner, name) => {
      if (!DATA[name]) { const e = new Error('Repository not found or not accessible'); e.status = 404; throw e; }
      return { github_id: name.length, owner, name, full_name: `${owner}/${name}`, description: null, language: 'JS', stars: 1, forks: 0, open_issues: 0, is_private: false, html_url: 'u', pushed_at: ago(1) };
    },
    listCommits: async (t, o, name) => ({ commits: DATA[name].commits, truncated: false }),
    listPullRequests: async (t, o, name) => ({ pulls: DATA[name].pulls, truncated: false }),
  };
}

async function setup(t) {
  const db = createPool({ databaseUrl: url });
  t.after(() => db.end());
  await migrate(db);
  await db.query('TRUNCATE users CASCADE');
  const { rows } = await db.query("INSERT INTO users (github_id, login, access_token_enc) VALUES (1, 'u1', $1) RETURNING id", [encrypt('t', config.tokenEncryptionKey)]);
  const app = createApp({ config, db, github: fakeGithub() });
  return { db, app, cookie: sessionCookie(rows[0].id), userId: rows[0].id };
}

test('mapLimit keeps order and never exceeds the concurrency limit', async () => {
  let running = 0; let peak = 0;
  const out = await mapLimit([1, 2, 3, 4, 5, 6, 7], 3, async (n) => {
    running += 1; peak = Math.max(peak, running);
    await new Promise((r) => setTimeout(r, 5 * (8 - n)));
    running -= 1;
    return n * 2;
  });
  assert.deepEqual(out, [2, 4, 6, 8, 10, 12, 14]);
  assert.ok(peak <= 3 && peak >= 2);
});

test('team totals equal the sum of the repositories, and people are merged across them', { skip }, async (t) => {
  const { app, cookie } = await setup(t);
  const res = await request(app).get('/api/team/summary?repos=o/alpha,o/beta&days=7').set('Cookie', cookie);
  assert.equal(res.status, 200, JSON.stringify(res.body));
  const { aggregate, repos, skipped } = res.body;

  assert.deepEqual(skipped, []);
  assert.equal(repos.length, 2);
  assert.equal(aggregate.totals.commits, 5);
  assert.equal(repos.reduce((n, r) => n + r.commits, 0), aggregate.totals.commits);
  assert.equal(aggregate.totals.pullRequests, 2);
  assert.equal(aggregate.totals.openPullRequests, 1);
  assert.equal(aggregate.totals.mergedPullRequests, 1);
  assert.equal(aggregate.totals.contributors, 3, 'ann appears in both repositories but is one person');
  const ann = aggregate.topContributors.find((p) => p.login === 'ann');
  assert.equal(ann.commits, 3);
  assert.equal(repos[0].fullName, 'o/alpha', 'repositories are ordered by activity');
  assert.equal(repos[0].daily.length, 7);
  assert.equal(aggregate.reviews.waitingCount, 1);
  assert.equal(aggregate.reviews.waiting[0].repo, 'o/alpha', 'waiting PRs say which repository they are in');
  assert.equal(aggregate.reviews.reviewers[0].login, 'bob');
});

test('team: a repository that cannot be read is reported, not fatal', { skip }, async (t) => {
  const { app, cookie } = await setup(t);
  const res = await request(app).get('/api/team/summary?repos=o/alpha,o/ghost&days=7').set('Cookie', cookie);
  assert.equal(res.status, 200);
  assert.equal(res.body.repos.length, 1);
  assert.deepEqual(res.body.skipped.map((s) => s.repo), ['o/ghost']);
  assert.match(res.body.skipped[0].reason, /not found/i);
});

test('team: with no repos given it uses every analyzed repository, and nothing else', { skip }, async (t) => {
  const { app, cookie } = await setup(t);
  const empty = await request(app).get('/api/team/summary').set('Cookie', cookie);
  assert.equal(empty.status, 200);
  assert.equal(empty.body.repos.length, 0);
  assert.equal(empty.body.aggregate.totals.commits, 0);

  await request(app).get('/api/analytics/summary?repo=o/alpha').set('Cookie', cookie); // analyzes alpha only
  const some = await request(app).get('/api/team/summary?days=7').set('Cookie', cookie);
  assert.deepEqual(some.body.repos.map((r) => r.fullName), ['o/alpha']);
});

test('team: validation and limits', { skip }, async (t) => {
  const { app, cookie } = await setup(t);
  assert.equal((await request(app).get('/api/team/summary?repos=../x').set('Cookie', cookie)).status, 400);
  assert.equal((await request(app).get('/api/team/summary?repos=justaname').set('Cookie', cookie)).status, 400);
  const tooMany = Array.from({ length: 16 }, (_, i) => `o/r${i}`).join(',');
  assert.equal((await request(app).get(`/api/team/summary?repos=${tooMany}`).set('Cookie', cookie)).status, 400);
  assert.equal((await request(app).get('/api/team/summary')).status, 401);

  // Only a handful of never-analyzed repositories are synced per request.
  const names = Array.from({ length: 8 }, (_, i) => `o/missing${i}`).join(',');
  const res = await request(app).get(`/api/team/summary?repos=${names}&days=7`).set('Cookie', cookie);
  assert.equal(res.status, 200);
  assert.equal(res.body.skipped.length, 8);
  assert.equal(res.body.skipped.filter((s) => /Only 5 new/.test(s.reason)).length, 3);
});

test("team: one user's analyzed repositories are never visible to another", { skip }, async (t) => {
  const { db, app, cookie } = await setup(t);
  await request(app).get('/api/analytics/summary?repo=o/alpha').set('Cookie', cookie);
  const { rows } = await db.query("INSERT INTO users (github_id, login, access_token_enc) VALUES (2, 'u2', $1) RETURNING id", [encrypt('t', config.tokenEncryptionKey)]);
  const res = await request(app).get('/api/team/summary').set('Cookie', sessionCookie(rows[0].id));
  assert.deepEqual(res.body.repos, []);
});
