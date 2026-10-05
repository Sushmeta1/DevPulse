// Needs PostgreSQL: set TEST_DATABASE_URL (CI does).
const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const { createPool } = require('../config/db');
const { migrate } = require('../config/migrate');
const { createApp } = require('../app');
const { encrypt, decrypt } = require('../utils/crypto');
const { loadConfig } = require('../config/env');
const { runDueDigests } = require('../services/digestService');
const { config: baseConfig, sessionCookie } = require('./helpers');

const url = process.env.TEST_DATABASE_URL;
const skip = !url && 'TEST_DATABASE_URL not set';
const HOUR = 3600000;
const ago = (h) => new Date(Date.now() - h * HOUR).toISOString();
const SLACK = 'https://hooks.slack.com/services/T000/B000/secretTOKEN';
const todayWeekday = () => new Date().getUTCDay();

const config = { ...baseConfig, email: { apiKey: 're_test', from: 'DevPulse <digest@pulse.example.edu>' }, cronSecret: 'cron-secret' };
const github = {
  getRepository: async (t, owner, name) => ({ github_id: 1, owner, name, full_name: `${owner}/${name}`, description: null, language: 'JS', stars: 1, forks: 0, open_issues: 0, is_private: false, html_url: 'u', pushed_at: ago(1) }),
  listCommits: async () => ({ truncated: false, commits: [{ sha: 'c1', message: 'm', author_login: 'ann', author_name: 'Ann', committed_at: ago(5), html_url: 'u' }] }),
  listPullRequests: async () => ({ truncated: false, pulls: [{
    number: 4, title: 'Needs eyes', state: 'open', author_login: 'ann', author_is_bot: false, is_draft: false, created_at: ago(30), updated_at: ago(1),
    closed_at: null, merged_at: null, html_url: 'https://github.com/o/a/pull/4', additions: 5, deletions: 1, changed_files: 1,
    first_review_at: null, first_reviewer: null, review_count: 0, reviews: [],
  }] }),
};

async function setup(t, { email = 'ann@example.edu', demo = false } = {}) {
  const db = createPool({ databaseUrl: url });
  t.after(() => db.end());
  await migrate(db);
  await db.query('TRUNCATE users CASCADE');
  const { rows } = await db.query(
    'INSERT INTO users (github_id, login, email, access_token_enc, is_demo) VALUES (1, $1, $2, $3, $4) RETURNING id',
    ['ann', email, encrypt('gh-token', config.tokenEncryptionKey), demo],
  );
  const deps = { config, db, github };
  return { db, deps, app: createApp(deps), cookie: sessionCookie(rows[0].id), userId: rows[0].id };
}

function captureFetch(t, { slackStatus = 200, emailStatus = 200 } = {}) {
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (u, opts = {}) => {
    const href = String(u);
    calls.push({ href, body: opts.body ? JSON.parse(opts.body) : null, headers: opts.headers });
    if (href.startsWith('https://hooks.slack.com')) return new Response('ok', { status: slackStatus });
    if (href.startsWith('https://api.resend.com')) return new Response('{}', { status: emailStatus });
    return new Response('{}', { status: 404 });
  });
  return calls;
}

test('settings: validated, the Slack webhook is stored encrypted and never returned', { skip }, async (t) => {
  const { app, db, cookie } = await setup(t);
  assert.deepEqual((await request(app).get('/api/digest').set('Cookie', cookie)).body.configured, false);

  for (const bad of [{ slackWebhookUrl: 'https://evil.example/x' }, { weekday: 9 }, { repos: ['../x'] }, { repos: Array.from({ length: 11 }, (_, i) => `o/r${i}`) }, { tzOffset: 5000 }]) {
    assert.equal((await request(app).put('/api/digest').set('Cookie', cookie).send(bad)).status, 400, JSON.stringify(bad));
  }

  const saved = await request(app).put('/api/digest').set('Cookie', cookie).send({ repos: ['o/a', 'o/a', 'o/b'], slackWebhookUrl: SLACK, sendEmail: true, weekday: 3, tzOffset: 330 });
  assert.equal(saved.status, 200, JSON.stringify(saved.body));
  assert.deepEqual(saved.body.repos, ['o/a', 'o/b'], 'duplicates are removed');
  assert.equal(saved.body.slackConnected, true);
  assert.ok(!JSON.stringify(saved.body).includes('secretTOKEN'));
  assert.equal(saved.body.channels.email.address, 'an*@example.edu', 'the address is masked');
  const stored = (await db.query('SELECT slack_webhook_enc FROM digests')).rows[0].slack_webhook_enc;
  assert.ok(!stored.includes('secretTOKEN'));
  assert.equal(decrypt(stored, config.tokenEncryptionKey), SLACK);

  // omitted = keep, empty string = disconnect
  const kept = await request(app).put('/api/digest').set('Cookie', cookie).send({ weekday: 4 });
  assert.equal(kept.body.slackConnected, true);
  assert.equal(kept.body.weekday, 4);
  const gone = await request(app).put('/api/digest').set('Cookie', cookie).send({ slackWebhookUrl: '' });
  assert.equal(gone.body.slackConnected, false);

  assert.equal((await request(app).delete('/api/digest').set('Cookie', cookie)).status, 204);
  assert.equal((await request(app).get('/api/digest').set('Cookie', cookie)).body.configured, false);
});

test('settings: e-mail needs server configuration and a verified address; the demo cannot subscribe', { skip }, async (t) => {
  const noMail = await setup(t);
  const unconfigured = createApp({ ...noMail.deps, config: { ...config, email: { apiKey: '', from: '' } } });
  const r1 = await request(unconfigured).put('/api/digest').set('Cookie', noMail.cookie).send({ sendEmail: true });
  assert.equal(r1.status, 400);
  assert.match(r1.body.error, /not configured/);
  assert.equal((await request(unconfigured).get('/api/digest').set('Cookie', noMail.cookie)).body.channels.email.available, false);

  const noAddress = await setup(t, { email: null });
  const r2 = await request(noAddress.app).put('/api/digest').set('Cookie', noAddress.cookie).send({ sendEmail: true });
  assert.equal(r2.status, 400);
  assert.match(r2.body.error, /verified e-mail/);

  const demo = await setup(t, { demo: true });
  assert.equal((await request(demo.app).put('/api/digest').set('Cookie', demo.cookie).send({ weekday: 2 })).status, 403);
  assert.equal((await request(demo.app).post('/api/digest/send-test').set('Cookie', demo.cookie)).status, 403);
});

test('preview renders the digest from real data without sending anything', { skip }, async (t) => {
  const { app, cookie } = await setup(t);
  const calls = captureFetch(t);
  const res = await request(app).post('/api/digest/preview').set('Cookie', cookie).send({ repos: ['o/a'] });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.match(res.body.subject, /DevPulse weekly: 1 commit/);
  assert.match(res.body.subject, /1 waiting for review/);
  assert.ok(res.body.html.includes('Needs eyes'));
  assert.ok(res.body.text.includes('o/a #4'));
  assert.equal(res.body.slack.blocks[0].type, 'header');
  assert.equal(calls.length, 0, 'a preview delivers nothing');
  assert.equal((await request(app).post('/api/digest/preview').send({})).status, 401);
});

test('the demo workspace can preview a digest end to end with no keys', { skip }, async (t) => {
  const { db } = await setup(t);
  const app = createApp({ config: { ...baseConfig, email: { apiKey: '', from: '' } }, db, github: {} });
  const agent = request.agent(app);
  await agent.post('/api/auth/demo');
  const res = await agent.post('/api/digest/preview').send({ repos: ['acme/web', 'acme/api'] });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.body.repoCount, 2);
  assert.ok(res.body.html.includes('Most active repositories'));
});

test('send-test delivers to Slack and e-mail, reports failures, and records the outcome', { skip }, async (t) => {
  const { app, db, cookie } = await setup(t);
  assert.equal((await request(app).post('/api/digest/send-test').set('Cookie', cookie)).status, 400, 'nothing saved yet');
  await request(app).put('/api/digest').set('Cookie', cookie).send({ repos: ['o/a'], slackWebhookUrl: SLACK, sendEmail: true });

  const calls = captureFetch(t);
  const ok = await request(app).post('/api/digest/send-test').set('Cookie', cookie);
  assert.equal(ok.status, 200, JSON.stringify(ok.body));
  assert.deepEqual(ok.body.channels.map((c) => [c.channel, c.ok]), [['email', true], ['slack', true]]);
  const slack = calls.find((c) => c.href.startsWith('https://hooks.slack.com'));
  const mail = calls.find((c) => c.href.startsWith('https://api.resend.com'));
  assert.equal(slack.href, SLACK);
  assert.ok(slack.body.blocks.length > 3);
  assert.deepEqual(mail.body.to, ['ann@example.edu']);
  assert.match(mail.body.subject, /^DevPulse weekly/);
  assert.equal((await db.query('SELECT last_status FROM digests')).rows[0].last_status, 'test sent');

  captureFetch(t, { slackStatus: 500, emailStatus: 500 });
  const bad = await request(app).post('/api/digest/send-test').set('Cookie', cookie);
  assert.equal(bad.status, 502);
  assert.ok(bad.body.channels.every((c) => !c.ok));
});

test('scheduled run: sends once per week, even if several runners fire at the same moment', { skip }, async (t) => {
  const { app, db, deps, cookie } = await setup(t);
  await request(app).put('/api/digest').set('Cookie', cookie).send({ repos: ['o/a'], slackWebhookUrl: SLACK, weekday: todayWeekday() });
  const calls = captureFetch(t);

  const [a, b, c] = await Promise.all([runDueDigests(deps), runDueDigests(deps), runDueDigests(deps)]);
  const slackCalls = calls.filter((x) => x.href.startsWith('https://hooks.slack.com'));
  assert.equal(slackCalls.length, 1, 'exactly one delivery');
  assert.equal(a.sent + b.sent + c.sent, 1);

  const row = (await db.query('SELECT last_sent_at, last_status FROM digests')).rows[0];
  assert.ok(row.last_sent_at);
  assert.equal(row.last_status, 'sent');

  const again = await runDueDigests(deps);
  assert.equal(again.considered, 0, 'sent this week: not even considered');
  assert.equal(calls.filter((x) => x.href.startsWith('https://hooks.slack.com')).length, 1);
});

test('scheduled run: skips other weekdays, disabled subscriptions and the demo account', { skip }, async (t) => {
  const { app, db, deps, cookie } = await setup(t);
  const calls = captureFetch(t);
  await request(app).put('/api/digest').set('Cookie', cookie).send({ repos: ['o/a'], slackWebhookUrl: SLACK, weekday: (todayWeekday() + 3) % 7 });
  assert.deepEqual((await runDueDigests(deps)).due, 0);

  await request(app).put('/api/digest').set('Cookie', cookie).send({ weekday: todayWeekday(), enabled: false });
  assert.equal((await runDueDigests(deps)).due, 0);

  await db.query('UPDATE digests SET enabled = TRUE');
  await db.query('UPDATE users SET is_demo = TRUE');
  assert.equal((await runDueDigests(deps)).considered, 0);
  assert.equal(calls.length, 0);
});

test('scheduled run: a failed delivery is recorded, not counted as sent, and retried later', { skip }, async (t) => {
  const { app, db, deps, cookie } = await setup(t);
  await request(app).put('/api/digest').set('Cookie', cookie).send({ repos: ['o/a'], slackWebhookUrl: SLACK, weekday: todayWeekday() });

  captureFetch(t, { slackStatus: 500 });
  const first = await runDueDigests(deps);
  assert.equal(first.failed, 1);
  let row = (await db.query('SELECT last_sent_at, last_status FROM digests')).rows[0];
  assert.equal(row.last_sent_at, null, 'a failure never counts as a delivery');
  assert.match(row.last_status, /^error: slack: Slack returned 500/);

  // Retrying immediately is blocked (claimed within the last 10 hours) ...
  assert.equal((await runDueDigests(deps)).skipped, 1);
  // ... but a later run, with the service back, delivers it.
  await db.query("UPDATE digests SET last_attempt_at = now() - interval '11 hours'");
  const calls = captureFetch(t);
  const retry = await runDueDigests(deps);
  assert.equal(retry.sent, 1);
  assert.equal(calls.filter((x) => x.href.startsWith('https://hooks.slack.com')).length, 1);
  row = (await db.query('SELECT last_sent_at, last_status FROM digests')).rows[0];
  assert.ok(row.last_sent_at);
  assert.equal(row.last_status, 'sent');
});

test('scheduled run: a subscription with no working channel reports why instead of silently succeeding', { skip }, async (t) => {
  const { app, db, deps, cookie } = await setup(t);
  await request(app).put('/api/digest').set('Cookie', cookie).send({ repos: ['o/a'], weekday: todayWeekday() }); // no e-mail, no Slack
  captureFetch(t);
  const result = await runDueDigests(deps);
  assert.equal(result.failed, 1);
  assert.match((await db.query('SELECT last_status FROM digests')).rows[0].last_status, /no delivery channel/);
});

test('scheduled run respects its time budget and leaves the rest for the next run', { skip }, async (t) => {
  const { app, db, deps, cookie } = await setup(t);
  await request(app).put('/api/digest').set('Cookie', cookie).send({ repos: ['o/a'], slackWebhookUrl: SLACK, weekday: todayWeekday() });
  const calls = captureFetch(t);
  const result = await runDueDigests(deps, { budgetMs: -1 });
  assert.equal(result.deferred, 1);
  assert.equal(calls.length, 0);
  assert.equal((await db.query('SELECT last_attempt_at FROM digests')).rows[0].last_attempt_at, null, 'deferred work is not marked as attempted');
});

test('cron endpoint: hidden without a secret, locked with one, and runs the due digests', { skip }, async (t) => {
  const { app, db, deps, cookie } = await setup(t);
  const open = createApp({ ...deps, config: { ...config, cronSecret: '' } });
  assert.equal((await request(open).get('/api/cron/digest')).status, 404, 'does not exist unless a secret is configured');

  assert.equal((await request(app).get('/api/cron/digest')).status, 401);
  assert.equal((await request(app).get('/api/cron/digest').set('Authorization', 'Bearer wrong')).status, 401);

  await request(app).put('/api/digest').set('Cookie', cookie).send({ repos: ['o/a'], slackWebhookUrl: SLACK, weekday: todayWeekday() });
  const calls = captureFetch(t);
  const res = await request(app).get('/api/cron/digest').set('Authorization', 'Bearer cron-secret');
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.body.sent, 1);
  assert.equal(calls.filter((x) => x.href.startsWith('https://hooks.slack.com')).length, 1);
  assert.equal((await db.query("SELECT last_status FROM digests")).rows[0].last_status, 'sent');
  // POST works too (some schedulers only POST)
  assert.equal((await request(app).post('/api/cron/digest').set('Authorization', 'Bearer cron-secret')).status, 200);
});

test('GitHub e-mail lookup picks the primary verified address and never throws', async (t) => {
  const githubService = require('../services/githubService');
  t.mock.method(globalThis, 'fetch', async () => new Response(JSON.stringify([
    { email: 'old@example.edu', primary: false, verified: true }, { email: 'main@example.edu', primary: true, verified: true }, { email: 'x@example.edu', primary: true, verified: false },
  ])));
  assert.equal(await githubService.getPrimaryEmail('tok'), 'main@example.edu');
  t.mock.method(globalThis, 'fetch', async () => new Response('{}', { status: 403 }));
  assert.equal(await githubService.getPrimaryEmail('tok'), null);
  assert.ok(loadConfig({}).email, 'config exposes e-mail settings');
});
