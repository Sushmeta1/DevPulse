const test = require('node:test');
const assert = require('node:assert/strict');
const { generateReport, parseReport, localReport, buildPrompt } = require('../services/aiService');
const { buildSummary } = require('../services/analyticsService');

const summary = buildSummary({
  commits: [{ author_login: 'ann', committed_at: '2025-03-10T09:00:00Z' }],
  pulls: [{ state: 'open', author_login: 'ann', created_at: '2025-03-10T00:00:00Z', merged_at: null }],
  days: 7,
  now: new Date('2025-03-10T12:00:00Z'),
});

test('parseReport accepts fenced JSON and normalises fields', () => {
  const r = parseReport('```json\n{"summary":"s","insights":["a"],"suggestions":"nope"}\n```');
  assert.deepEqual(r, { summary: 's', insights: ['a'], suggestions: [] });
  assert.throws(() => parseReport('not json'), { status: 502 });
});

test('falls back to the local report when no API key is configured', async () => {
  const r = await generateReport({ provider: 'gemini', geminiApiKey: '' }, 'octo/repo', summary);
  assert.equal(r.provider, 'local');
  assert.match(r.content.summary, /octo\/repo saw 1 commits/);
  assert.ok(r.content.insights.length && r.content.suggestions.length);
});

test('calls Gemini when configured and parses the response', async (t) => {
  t.mock.method(globalThis, 'fetch', async (url, opts) => {
    assert.match(String(url), /generativelanguage\.googleapis\.com.*gemini-test:generateContent/);
    assert.equal(opts.headers['x-goog-api-key'], 'k');
    const prompt = JSON.parse(opts.body).contents[0].parts[0].text;
    assert.match(prompt, /octo\/repo/);
    return new Response(JSON.stringify({
      candidates: [{ content: { parts: [{ text: '{"summary":"ok","insights":["i"],"suggestions":["s"]}' }] } }],
    }));
  });
  const r = await generateReport({ provider: 'gemini', geminiApiKey: 'k', geminiModel: 'gemini-test' }, 'octo/repo', summary);
  assert.equal(r.provider, 'gemini');
  assert.equal(r.content.summary, 'ok');
});

test('surfaces provider failures as 502', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => new Response('{}', { status: 500 }));
  await assert.rejects(
    generateReport({ provider: 'openai', openaiApiKey: 'k', openaiModel: 'm' }, 'o/r', summary),
    { status: 502 },
  );
});

test('prompt and local report contain the metrics', () => {
  assert.match(buildPrompt('o/r', summary), /"commits":1/);
  assert.equal(localReport('o/r', summary).insights.length > 0, true);
});
