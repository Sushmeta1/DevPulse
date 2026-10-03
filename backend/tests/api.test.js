const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const { createApp } = require('../app');
const { config, sessionCookie, userRow } = require('./helpers');

function makeApp({ github = {}, rows = {} } = {}) {
  const queries = [];
  const db = {
    query: async (sql, params) => {
      queries.push({ sql, params });
      if (/FROM users WHERE id/.test(sql)) return { rows: rows.user ? [rows.user] : [] };
      if (/INSERT INTO users/.test(sql)) return { rows: [{ id: 1, login: 'octo' }] };
      return { rows: [] };
    },
  };
  return { app: createApp({ config, db, github }), queries };
}

test('health check', async () => {
  const { app } = makeApp();
  const res = await request(app).get('/api/health');
  assert.equal(res.status, 200);
  assert.deepEqual(res.body, { status: 'ok' });
});

test('protected routes require a valid session', async () => {
  const { app } = makeApp();
  for (const path of ['/api/user', '/api/repositories', '/api/analytics/summary?repo=a/b', '/api/ai/reports?repo=a/b']) {
    const res = await request(app).get(path);
    assert.equal(res.status, 401, path);
  }
  const bad = await request(app).get('/api/user').set('Cookie', 'devpulse_token=garbage');
  assert.equal(bad.status, 401);
});

test('GET /api/user returns the profile without secrets', async () => {
  const { app } = makeApp({ rows: { user: userRow() } });
  const res = await request(app).get('/api/user').set('Cookie', sessionCookie());
  assert.equal(res.status, 200);
  assert.equal(res.body.login, 'octo');
  assert.equal(JSON.stringify(res.body).includes('access_token'), false);
});

test('OAuth login redirects to GitHub with a state cookie', async () => {
  const { app } = makeApp();
  const res = await request(app).get('/api/auth/github');
  assert.equal(res.status, 302);
  const url = new URL(res.headers.location);
  assert.equal(url.origin + url.pathname, 'https://github.com/login/oauth/authorize');
  assert.equal(url.searchParams.get('client_id'), 'cid');
  const state = url.searchParams.get('state');
  assert.match(res.headers['set-cookie'].join(';'), new RegExp(`devpulse_oauth_state=${state}`));
});

test('OAuth callback rejects a mismatched state', async () => {
  const { app } = makeApp();
  const res = await request(app).get('/api/auth/github/callback?code=abc&state=evil').set('Cookie', 'devpulse_oauth_state=good');
  assert.equal(res.status, 302);
  assert.match(res.headers.location, /error=invalid_oauth_state/);
});

test('OAuth callback creates a session and stores the token encrypted', async () => {
  const github = {
    exchangeCodeForToken: async () => 'gh-token',
    getAuthenticatedUser: async () => ({ id: 42, login: 'octo', name: 'Octo', email: null, avatar_url: 'u' }),
  };
  const { app, queries } = makeApp({ github });
  const res = await request(app).get('/api/auth/github/callback?code=abc&state=s1').set('Cookie', 'devpulse_oauth_state=s1');
  assert.equal(res.status, 302);
  assert.match(res.headers.location, /\/dashboard$/);
  assert.match(res.headers['set-cookie'].join(';'), /devpulse_token=.*HttpOnly/);
  const insert = queries.find((q) => /INSERT INTO users/.test(q.sql));
  assert.notEqual(insert.params[5], 'gh-token');
});

test('validation errors return 400 before touching GitHub', async () => {
  const { app } = makeApp({ rows: { user: userRow() } });
  const bad = await request(app).get('/api/analytics/summary?repo=not-a-repo').set('Cookie', sessionCookie());
  assert.equal(bad.status, 400);
  const days = await request(app).get('/api/analytics/summary?repo=a/b&days=500').set('Cookie', sessionCookie());
  assert.equal(days.status, 400);
  const post = await request(app).post('/api/ai/sprint-summary').set('Cookie', sessionCookie()).send({ repo: '../x' });
  assert.equal(post.status, 400);
});

test('unknown API routes return JSON 404', async () => {
  const { app } = makeApp();
  const res = await request(app).get('/api/nope');
  assert.equal(res.status, 404);
  assert.equal(res.body.error, 'Not found');
});
