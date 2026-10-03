const test = require('node:test');
const assert = require('node:assert/strict');
const { uniqueBy } = require('../services/syncService');

test('uniqueBy keeps one entry per key and the last occurrence', () => {
  const out = uniqueBy([{ id: 1, v: 'a' }, { id: 2, v: 'b' }, { id: 1, v: 'c' }], (x) => x.id);
  assert.deepEqual(out, [{ id: 1, v: 'c' }, { id: 2, v: 'b' }]);
});
