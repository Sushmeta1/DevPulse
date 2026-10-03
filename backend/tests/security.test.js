const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const { createApp } = require('../app');
const { fetchWithTimeout } = require('../utils/http');
const { config, userRow } = require('./helpers');

const appWithUser = () => createApp({
  config,
  db: { query: async (sql) => (/FROM users WHERE id/.test(sql) ? { rows: [userRow()] } : { rows: [] }) },
  github: {},
});

test('rejects a forged unsigned (alg: none) session token', async () => {
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const forged = `${b64({ alg: 'none', typ: 'JWT' })}.${b64({ sub: 1, login: 'octo', iss: 'devpulse' })}.`;
  const res = await request(appWithUser()).get('/api/user').set('Cookie', `devpulse_token=${forged}`);
  assert.equal(res.status, 401);
});

test('rejects a token signed with the right secret but the wrong issuer or algorithm', async () => {
  const app = appWithUser();
  const wrongIssuer = jwt.sign({ sub: 1 }, config.jwtSecret, { algorithm: 'HS256', issuer: 'someone-else' });
  const wrongAlg = jwt.sign({ sub: 1 }, config.jwtSecret, { algorithm: 'HS512', issuer: 'devpulse' });
  for (const t of [wrongIssuer, wrongAlg]) {
    assert.equal((await request(app).get('/api/user').set('Cookie', `devpulse_token=${t}`)).status, 401);
  }
});

test('every response carries a request id, and unsafe incoming ids are replaced', async () => {
  const app = appWithUser();
  const good = await request(app).get('/api/health').set('X-Request-Id', 'abc12345-trace');
  assert.equal(good.headers['x-request-id'], 'abc12345-trace');
  const evil = await request(app).get('/api/health').set('X-Request-Id', 'has spaces; and <junk>');
  assert.notEqual(evil.headers['x-request-id'], 'has spaces; and <junk>');
  assert.match(evil.headers['x-request-id'], /^[0-9a-f-]{36}$/);
});

test('request logs never include query strings (the OAuth code lives there)', async (t) => {
  const lines = [];
  t.mock.method(console, 'log', (l) => lines.push(l));
  const app = createApp({ config: { ...config, logRequests: true }, db: { query: async () => ({ rows: [] }) }, github: {} });
  await request(app).get('/api/config?code=SECRET123');
  const entry = JSON.parse(lines.find((l) => l.includes('/api/config')));
  assert.equal(entry.path, '/api/config');
  assert.equal(entry.status, 200);
  assert.ok(!lines.join('').includes('SECRET123'));
});

test('errors are reported with the request id', async () => {
  const res = await request(appWithUser()).get('/api/nope');
  assert.equal(res.status, 404);
  const authed = await request(appWithUser()).get('/api/analytics/summary?repo=bad').set('Cookie', require('./helpers').sessionCookie());
  assert.equal(authed.status, 400);
  assert.ok(authed.body.requestId);
});

test('upstream calls time out instead of hanging', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => { const e = new Error('timeout'); e.name = 'TimeoutError'; throw e; });
  await assert.rejects(fetchWithTimeout('https://example.test'), { status: 504 });
  t.mock.method(globalThis, 'fetch', async () => { throw new TypeError('network down'); });
  await assert.rejects(fetchWithTimeout('https://example.test'), { status: 502 });
});

test('a real stalled server is cut off at the deadline', async () => {
  const http = require('node:http');
  const server = http.createServer(() => {}); // accepts the request and never answers
  await new Promise((r) => server.listen(0, r));
  const started = Date.now();
  await assert.rejects(fetchWithTimeout(`http://127.0.0.1:${server.address().port}`, {}, 150), { status: 504 });
  assert.ok(Date.now() - started < 2000);
  server.closeAllConnections();
  server.close();
});
