// Needs PostgreSQL: set TEST_DATABASE_URL (CI does).
const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const { Pool } = require('pg');
const { createPool } = require('../config/db');
const { migrate } = require('../config/migrate');
const { createApp } = require('../app');
const { encrypt } = require('../utils/crypto');
const { config, sessionCookie } = require('./helpers');

const url = process.env.TEST_DATABASE_URL;
const skip = !url && 'TEST_DATABASE_URL not set';
const fs = require('node:fs');
const path = require('node:path');

const MIGRATIONS = fs.readdirSync(path.resolve(__dirname, '../../database/migrations')).filter((f) => f.endsWith('.sql')).sort();
const DAY = 86400000;
const iso = (daysAgo) => new Date(Date.now() - daysAgo * DAY).toISOString();

async function freshUser(db, githubId = 1, extra = {}) {
  const { rows } = await db.query(
    `INSERT INTO users (github_id, login, access_token_enc, is_demo) VALUES ($1, $2, $3, $4) RETURNING id`,
    [githubId, `user${githubId}`, encrypt('gh-token', config.tokenEncryptionKey), Boolean(extra.demo)],
  );
  return rows[0].id;
}

function recordingGithub(overrides = {}) {
  const calls = { commitsSince: [], pullsSince: [], repoLists: 0 };
  return {
    calls,
    getRepository: async (t, owner, name) => ({
      github_id: 1, owner, name, full_name: `${owner}/${name}`, description: null, language: 'JS', stars: 1, forks: 0,
      open_issues: 0, is_private: false, html_url: 'u', pushed_at: iso(1),
    }),
    listCommits: async (t, o, n, since) => {
      calls.commitsSince.push(since);
      return { truncated: false, commits: [{ sha: `c${calls.commitsSince.length}`, message: 'm', author_login: 'a', author_name: 'A', committed_at: iso(1), html_url: 'u' }] };
    },
    listPullRequests: async (t, o, n, since) => { calls.pullsSince.push(since); return { truncated: false, pulls: [] }; },
    listRepositories: async () => {
      calls.repoLists += 1;
      return ['alpha', 'beta'].map((name, i) => ({
        github_id: i + 1, owner: 'o', name, full_name: `o/${name}`, description: null, language: 'JS', stars: 0, forks: 0,
        open_issues: 0, is_private: false, html_url: 'u', pushed_at: iso(i),
      }));
    },
    revokeGrant: async () => { calls.revoked = true; return true; },
    ...overrides,
  };
}

test('migrations apply once, are recorded, and are safe to run concurrently', { skip }, async (t) => {
  const admin = new Pool({ connectionString: url });
  const name = `devpulse_mig_${process.pid}`;
  await admin.query(`DROP DATABASE IF EXISTS ${name}`);
  await admin.query(`CREATE DATABASE ${name}`);
  const dbUrl = new URL(url);
  dbUrl.pathname = `/${name}`;
  const db = createPool({ databaseUrl: dbUrl.toString() });
  t.after(async () => { await db.end(); await admin.query(`DROP DATABASE IF EXISTS ${name}`); await admin.end(); });

  const runs = await Promise.all([migrate(db), migrate(db), migrate(db)]); // three replicas booting together
  assert.equal(runs.flat().length, MIGRATIONS.length, 'each migration is applied exactly once across all runners');
  const { rows } = await db.query('SELECT version FROM schema_migrations ORDER BY version');
  assert.deepEqual(rows.map((r) => r.version), MIGRATIONS);
  assert.deepEqual(await migrate(db), [], 'a second run applies nothing');
  const cols = await db.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'users' AND column_name IN ('is_demo','repos_synced_at')");
  assert.equal(cols.rowCount, 2);
});

test('a database created before versioned migrations adopts them without errors', { skip }, async (t) => {
  const admin = new Pool({ connectionString: url });
  const name = `devpulse_legacy_${process.pid}`;
  await admin.query(`DROP DATABASE IF EXISTS ${name}`);
  await admin.query(`CREATE DATABASE ${name}`);
  const dbUrl = new URL(url);
  dbUrl.pathname = `/${name}`;
  const db = createPool({ databaseUrl: dbUrl.toString() });
  t.after(async () => { await db.end(); await admin.query(`DROP DATABASE IF EXISTS ${name}`); await admin.end(); });
  const dir = path.resolve(__dirname, '../../database/migrations');
  await db.query(fs.readFileSync(path.join(dir, '001_init.sql'), 'utf8')); // old-style, untracked
  await migrate(db);
  assert.equal((await db.query('SELECT count(*)::int AS n FROM schema_migrations')).rows[0].n, MIGRATIONS.length);
});

test('sync is incremental after the first run, and prunes old data', { skip }, async (t) => {
  const db = createPool({ databaseUrl: url });
  t.after(() => db.end());
  await migrate(db);
  await db.query('TRUNCATE users CASCADE');
  const userId = await freshUser(db);
  const github = recordingGithub();
  const app = createApp({ config, db, github });
  const cookie = sessionCookie(userId);

  await request(app).get('/api/analytics/summary?repo=o/r').set('Cookie', cookie);
  const firstSince = new Date(github.calls.commitsSince[0]).getTime();
  assert.ok(Math.abs(Date.now() - firstSince - 180 * DAY) < 60000, 'first sync fetches the full 180 day window');

  // Plant data that is far outside the retention window, then refresh.
  const repoId = (await db.query('SELECT id FROM repositories')).rows[0].id;
  await db.query("INSERT INTO commits (repository_id, sha, committed_at) VALUES ($1, 'ancient', now() - interval '400 days')", [repoId]);
  await db.query("INSERT INTO pull_requests (repository_id, number, title, state, created_at, merged_at) VALUES ($1, 99, 't', 'merged', now() - interval '400 days', now() - interval '399 days')", [repoId]);
  await db.query("INSERT INTO pull_requests (repository_id, number, title, state, created_at) VALUES ($1, 98, 'old but open', 'open', now() - interval '400 days')", [repoId]);

  await request(app).get('/api/analytics/summary?repo=o/r&refresh=true').set('Cookie', cookie);
  const secondSince = new Date(github.calls.commitsSince[1]).getTime();
  assert.ok(Date.now() - secondSince < 2 * DAY, `incremental sync only asks for the last day or so, got ${(Date.now() - secondSince) / DAY}d`);
  assert.equal(github.calls.pullsSince.length, 2);

  const commits = await db.query("SELECT sha FROM commits WHERE sha = 'ancient'");
  assert.equal(commits.rowCount, 0, 'commits past retention are pruned');
  const prs = await db.query('SELECT number FROM pull_requests ORDER BY number');
  assert.deepEqual(prs.rows.map((r) => r.number), [98], 'old closed PRs are pruned but open PRs are kept');
  // Both commits (from the full and the incremental fetch) are retained.
  assert.equal((await db.query("SELECT count(*)::int AS n FROM commits")).rows[0].n, 2);
});

test('an oversized delta falls back to a full resync instead of leaving a gap', { skip }, async (t) => {
  const db = createPool({ databaseUrl: url });
  t.after(() => db.end());
  await migrate(db);
  await db.query('TRUNCATE users CASCADE');
  const userId = await freshUser(db);
  let call = 0;
  const sinces = [];
  const github = recordingGithub({
    listCommits: async (t2, o, n, since) => {
      call += 1;
      sinces.push(since);
      return { truncated: call === 2, commits: [{ sha: `x${call}`, message: 'm', author_login: 'a', author_name: 'A', committed_at: iso(1), html_url: 'u' }] };
    },
  });
  const app = createApp({ config, db, github });
  const cookie = sessionCookie(userId);
  await request(app).get('/api/analytics/summary?repo=o/r').set('Cookie', cookie);
  await request(app).get('/api/analytics/summary?repo=o/r&refresh=true').set('Cookie', cookie);
  assert.equal(sinces.length, 3, 'the truncated delta triggers one extra full fetch');
  assert.ok(Date.now() - new Date(sinces[2]).getTime() > 170 * DAY);
});

test('the repository list is cached, refreshable, and carries 30-day activity', { skip }, async (t) => {
  const db = createPool({ databaseUrl: url });
  t.after(() => db.end());
  await migrate(db);
  await db.query('TRUNCATE users CASCADE');
  const userId = await freshUser(db);
  const github = recordingGithub();
  const app = createApp({ config, db, github });
  const cookie = sessionCookie(userId);

  const first = await request(app).get('/api/repositories').set('Cookie', cookie);
  assert.equal(first.body.length, 2);
  assert.equal(first.body[0].synced, false);
  assert.equal(first.body[0].activity, null);

  await request(app).get('/api/repositories').set('Cookie', cookie);
  assert.equal(github.calls.repoLists, 1, 'second load is served from PostgreSQL');
  await request(app).get('/api/repositories?refresh=true').set('Cookie', cookie);
  assert.equal(github.calls.repoLists, 2);

  await request(app).get('/api/analytics/summary?repo=o/alpha').set('Cookie', cookie);
  const after = await request(app).get('/api/repositories').set('Cookie', cookie);
  const alpha = after.body.find((r) => r.fullName === 'o/alpha');
  assert.equal(alpha.synced, true);
  assert.equal(alpha.activity.length, 30);
  assert.equal(alpha.commits30, 1);
  assert.equal(alpha.openPulls, 0);
  assert.equal(after.body.find((r) => r.fullName === 'o/beta').activity, null);
});

test('repositories that vanish from GitHub are forgotten unless synced', { skip }, async (t) => {
  const db = createPool({ databaseUrl: url });
  t.after(() => db.end());
  await migrate(db);
  await db.query('TRUNCATE users CASCADE');
  const userId = await freshUser(db);
  let names = ['alpha', 'beta'];
  const github = recordingGithub({
    listRepositories: async () => names.map((name, i) => ({
      github_id: i + 1, owner: 'o', name, full_name: `o/${name}`, description: null, language: null, stars: 0, forks: 0,
      open_issues: 0, is_private: false, html_url: 'u', pushed_at: iso(i),
    })),
  });
  const app = createApp({ config, db, github });
  const cookie = sessionCookie(userId);
  await request(app).get('/api/repositories').set('Cookie', cookie);
  await request(app).get('/api/analytics/summary?repo=o/beta').set('Cookie', cookie); // beta now has synced data
  names = [];
  const res = await request(app).get('/api/repositories?refresh=true').set('Cookie', cookie);
  assert.deepEqual(res.body.map((r) => r.fullName), ['o/beta']);
});

test('deleting an account removes every trace and revokes the GitHub grant', { skip }, async (t) => {
  const db = createPool({ databaseUrl: url });
  t.after(() => db.end());
  await migrate(db);
  await db.query('TRUNCATE users CASCADE');
  const userId = await freshUser(db);
  const other = await freshUser(db, 2);
  const github = recordingGithub();
  const app = createApp({ config, db, github });
  const cookie = sessionCookie(userId);
  await request(app).get('/api/analytics/summary?repo=o/r').set('Cookie', cookie);
  await request(app).post('/api/ai/sprint-summary').set('Cookie', cookie).send({ repo: 'o/r' });
  await request(app).get('/api/analytics/summary?repo=o/r').set('Cookie', sessionCookie(other));

  const res = await request(app).delete('/api/account').set('Cookie', cookie);
  assert.equal(res.status, 204);
  assert.equal(github.calls.revoked, true);
  assert.match(res.headers['set-cookie'].join(';'), /devpulse_token=;/);
  for (const table of ['commits', 'pull_requests', 'ai_reports']) {
    const n = (await db.query(`SELECT count(*)::int AS n FROM ${table} WHERE repository_id IN (SELECT id FROM repositories WHERE user_id = $1)`, [userId])).rows[0].n;
    assert.equal(n, 0, table);
  }
  assert.equal((await db.query('SELECT count(*)::int AS n FROM users WHERE id = $1', [userId])).rows[0].n, 0);
  assert.equal((await db.query('SELECT count(*)::int AS n FROM repositories WHERE user_id = $1', [other])).rows[0].n, 1, 'other users are untouched');
  assert.equal((await request(app).get('/api/user').set('Cookie', cookie)).status, 401);
});

test('the shared demo account cannot be deleted', { skip }, async (t) => {
  const db = createPool({ databaseUrl: url });
  t.after(() => db.end());
  await migrate(db);
  await db.query('TRUNCATE users CASCADE');
  const app = createApp({ config, db, github: {} });
  const agent = request.agent(app);
  await agent.post('/api/auth/demo');
  assert.equal((await agent.delete('/api/account')).status, 403);
  assert.equal((await agent.get('/api/user')).status, 200);
});

test('paid AI reports are limited per user per day; rule-based ones are free', { skip }, async (t) => {
  const db = createPool({ databaseUrl: url });
  t.after(() => db.end());
  await migrate(db);
  await db.query('TRUNCATE users CASCADE');
  const userId = await freshUser(db);
  const cookie = sessionCookie(userId);
  const paid = { ...config, ai: { ...config.ai, provider: 'gemini', geminiApiKey: 'k', geminiModel: 'm', dailyLimit: 2 } };
  t.mock.method(globalThis, 'fetch', async () => new Response(JSON.stringify({
    candidates: [{ content: { parts: [{ text: '{"summary":"s","insights":[],"suggestions":[]}' }] } }],
  })));
  const app = createApp({ config: paid, db, github: recordingGithub() });

  assert.equal((await request(app).post('/api/ai/sprint-summary').set('Cookie', cookie).send({ repo: 'o/r' })).status, 201);
  assert.equal((await request(app).post('/api/ai/sprint-summary').set('Cookie', cookie).send({ repo: 'o/r' })).status, 201);
  const blocked = await request(app).post('/api/ai/sprint-summary').set('Cookie', cookie).send({ repo: 'o/r' });
  assert.equal(blocked.status, 429);
  assert.match(blocked.body.error, /Daily AI summary limit/);

  const free = createApp({ config: { ...config, ai: { ...config.ai, provider: 'local', dailyLimit: 1 } }, db, github: recordingGithub() });
  for (let i = 0; i < 3; i++) {
    assert.equal((await request(free).post('/api/ai/sprint-summary').set('Cookie', cookie).send({ repo: 'o/r' })).status, 201);
  }
});

test('only the 20 newest reports per repository are kept', { skip }, async (t) => {
  const db = createPool({ databaseUrl: url });
  t.after(() => db.end());
  await migrate(db);
  await db.query('TRUNCATE users CASCADE');
  const userId = await freshUser(db);
  const cookie = sessionCookie(userId);
  const app = createApp({ config, db, github: recordingGithub() });
  for (let i = 0; i < 23; i++) await request(app).post('/api/ai/sprint-summary').set('Cookie', cookie).send({ repo: 'o/r' });
  const list = await request(app).get('/api/ai/reports?repo=o/r').set('Cookie', cookie);
  assert.equal((await db.query('SELECT count(*)::int AS n FROM ai_reports')).rows[0].n, 20);
  assert.equal(list.body.length, 10);
});

test('an idle database connection error does not crash the process', { skip }, async (t) => {
  const db = createPool({ databaseUrl: url });
  t.after(() => db.end());
  t.mock.method(console, 'error', () => {});
  assert.doesNotThrow(() => db.emit('error', new Error('terminating connection due to administrator command')));
});

test('review activity is stored, summarised, and repositories synced before it existed are fully backfilled once', { skip }, async (t) => {
  const db = createPool({ databaseUrl: url });
  t.after(() => db.end());
  await migrate(db);
  await db.query('TRUNCATE users CASCADE');
  const userId = await freshUser(db);
  const sinces = [];
  const reviewed = (n, hoursAgo, firstHours) => {
    const created = new Date(Date.now() - hoursAgo * 3600000).toISOString();
    const firstAt = new Date(Date.now() - (hoursAgo - firstHours) * 3600000).toISOString();
    return {
      number: n, title: `PR ${n}`, state: 'merged', author_login: 'ann', author_is_bot: false, is_draft: false, created_at: created,
      updated_at: firstAt, closed_at: firstAt, merged_at: firstAt, html_url: 'u', additions: 40, deletions: 10, changed_files: 2,
      first_review_at: firstAt, first_reviewer: 'bob', review_count: 1,
      reviews: [{ reviewer_login: 'bob', is_bot: false, state: 'APPROVED', submitted_at: firstAt }],
    };
  };
  const waiting = {
    number: 9, title: 'Nobody has looked', state: 'open', author_login: 'ann', author_is_bot: false, is_draft: false,
    created_at: new Date(Date.now() - 50 * 3600000).toISOString(), updated_at: new Date().toISOString(), closed_at: null, merged_at: null,
    html_url: 'u9', additions: 5, deletions: 1, changed_files: 1, first_review_at: null, first_reviewer: null, review_count: 0, reviews: [],
  };
  const fixture = [reviewed(1, 30, 3), reviewed(2, 40, 7), waiting];
  const github = recordingGithub({
    listCommits: async (t2, o, n, since) => { sinces.push(since); return { commits: [], truncated: false }; },
    listPullRequests: async () => ({ truncated: false, pulls: fixture }), // stable timestamps, like GitHub's
  });
  const app = createApp({ config, db, github });
  const cookie = sessionCookie(userId);

  const res = await request(app).get('/api/analytics/summary?repo=o/r&days=30').set('Cookie', cookie);
  assert.equal(res.status, 200, JSON.stringify(res.body));
  const reviews = res.body.reviews;
  assert.equal(reviews.available, true);
  assert.equal(reviews.firstReview.reviewedCount, 2);
  assert.equal(reviews.firstReview.medianHours, 3);
  assert.equal(reviews.waitingCount, 1);
  assert.equal(reviews.waiting[0].number, 9);
  assert.equal(reviews.reviewers[0].login, 'bob');
  assert.equal(reviews.reviewers[0].reviews, 2);
  assert.equal((await db.query('SELECT count(*)::int AS n FROM pull_request_reviews')).rows[0].n, 2);

  // Re-syncing must not duplicate review rows.
  await request(app).get('/api/analytics/summary?repo=o/r&days=30&refresh=true').set('Cookie', cookie);
  assert.equal((await db.query('SELECT count(*)::int AS n FROM pull_request_reviews')).rows[0].n, 2);
  const incrementalSince = new Date(sinces.at(-1)).getTime();
  assert.ok(Date.now() - incrementalSince < 2 * DAY, 'normal refreshes stay incremental');

  // A repository synced before review data existed has version 0, so the next sync reads the whole window again.
  await db.query('UPDATE repositories SET review_data_version = 0');
  await request(app).get('/api/analytics/summary?repo=o/r&days=30&refresh=true').set('Cookie', cookie);
  assert.ok(Date.now() - new Date(sinces.at(-1)).getTime() > 170 * DAY, 'one-off full backfill');
  assert.equal((await db.query('SELECT review_data_version FROM repositories')).rows[0].review_data_version, 1);
});
