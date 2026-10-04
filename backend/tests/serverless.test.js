// Needs PostgreSQL for the boot path (migrations): set TEST_DATABASE_URL (CI does).
const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const { loadConfig } = require('../config/env');
const { createHandler } = require('../serverless');

const url = process.env.TEST_DATABASE_URL;
const skip = !url && 'TEST_DATABASE_URL not set';

const vercelEnv = (extra = {}) => ({
  NODE_ENV: 'production', VERCEL: '1', VERCEL_PROJECT_PRODUCTION_URL: 'devpulse-demo.vercel.app',
  JWT_SECRET: 's', TOKEN_ENCRYPTION_KEY: 'k', GITHUB_CLIENT_ID: 'id', GITHUB_CLIENT_SECRET: 'secret',
  DATABASE_URL: url, ...extra,
});

test('config derives the public URL and a small connection pool on Vercel', () => {
  const c = loadConfig(vercelEnv({ DATABASE_URL: 'postgres://x' }));
  assert.equal(c.baseUrl, 'https://devpulse-demo.vercel.app');
  assert.equal(c.github.callbackUrl, 'https://devpulse-demo.vercel.app/api/auth/github/callback');
  assert.equal(c.frontendUrl, 'https://devpulse-demo.vercel.app');
  assert.equal(c.dbPoolMax, 3);
  assert.equal(c.isProd, true);
  // An explicit BASE_URL (custom domain) always wins.
  assert.equal(loadConfig(vercelEnv({ BASE_URL: 'https://pulse.example.edu/' })).baseUrl, 'https://pulse.example.edu');
  // Off Vercel nothing changes.
  const local = loadConfig({ PORT: '4000' });
  assert.equal(local.baseUrl, 'http://localhost:4000');
  assert.equal(local.dbPoolMax, 10);
});

test('the serverless handler boots on the first request, migrates, and serves the API', { skip }, async () => {
  const handler = createHandler({ config: loadConfig(vercelEnv()) });
  // Vercel rewrites /api/* to the function but keeps the original URL, which is what Express routes on.
  const health = await request(handler).get('/api/health');
  assert.equal(health.status, 200);
  assert.deepEqual(health.body, { status: 'ok' });

  const cfg = await request(handler).get('/api/config');
  assert.equal(cfg.body.githubLogin, true);
  assert.equal(cfg.body.demo, true);

  const login = await request(handler).get('/api/auth/github');
  assert.equal(login.status, 302);
  assert.ok(login.headers.location.includes(encodeURIComponent('https://devpulse-demo.vercel.app/api/auth/github/callback')));
  assert.match(login.headers['set-cookie'].join(';'), /Secure/, 'cookies are Secure in production');
});

test('the demo workspace works end to end through the serverless handler', { skip }, async () => {
  const handler = createHandler({ config: loadConfig(vercelEnv()) });
  const login = await request(handler).post('/api/auth/demo');
  assert.equal(login.status, 204);
  // Production cookies are Secure, so a plain-HTTP test client would (correctly) not send them back by itself.
  const cookie = login.headers['set-cookie'][0].split(';')[0];
  const repos = await request(handler).get('/api/repositories').set('Cookie', cookie);
  assert.equal(repos.status, 200);
  assert.ok(repos.body.length >= 8);
});

test('a misconfigured deployment answers 503 and recovers once fixed, instead of hanging or crashing', async () => {
  const config = loadConfig({ NODE_ENV: 'production', VERCEL: '1', DATABASE_URL: 'postgres://x' }); // secrets missing
  const handler = createHandler({ config });
  const res = await request(handler).get('/api/health');
  assert.equal(res.status, 503);
  assert.match(res.body.error, /misconfigured/);

  // The failed boot is not cached: supplying the secrets lets the very next request succeed.
  Object.assign(config, loadConfig(vercelEnv({ DATABASE_URL: 'postgres://x' })));
  const fake = { query: async () => ({ rows: [] }), connect: async () => ({ query: async () => ({ rows: [] }), release() {} }) };
  const retry = createHandler({ config: { ...config, migrateOnStart: false }, deps: { db: fake } });
  assert.equal((await request(retry).get('/api/health')).status, 200);
});

test('a boot failure is retried on the next request', async () => {
  let attempts = 0;
  const flaky = {
    query: async () => ({ rows: [] }),
    connect: async () => { attempts += 1; if (attempts === 1) throw new Error('database waking up'); return { query: async () => ({ rows: [] }), release() {} }; },
  };
  const handler = createHandler({ config: loadConfig(vercelEnv({ DATABASE_URL: 'postgres://x' })), deps: { db: flaky } });
  assert.equal((await request(handler).get('/api/health')).status, 503);
  assert.equal((await request(handler).get('/api/health')).status, 200);
});
