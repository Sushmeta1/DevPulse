const test = require('node:test');
const assert = require('node:assert/strict');
const { encrypt, decrypt } = require('../utils/crypto');
const { parseRepo, parseFullName, parseDays } = require('../utils/validate');

test('crypto round-trips and rejects tampering / wrong key', () => {
  const enc = encrypt('ghp_secret', 'k1');
  assert.notEqual(enc, 'ghp_secret');
  assert.equal(decrypt(enc, 'k1'), 'ghp_secret');
  assert.throws(() => decrypt(enc, 'other-key'));
  const [iv, tag, data] = enc.split('.');
  assert.throws(() => decrypt([iv, tag, Buffer.from('xx').toString('base64url')].join('.'), 'k1'));
  assert.ok(data);
});

test('repo name validation', () => {
  assert.deepEqual(parseFullName('octo/hello-world.js'), { owner: 'octo', name: 'hello-world.js' });
  assert.throws(() => parseFullName('octo'), { status: 400 });
  assert.throws(() => parseFullName('a/b/c'), { status: 400 });
  assert.throws(() => parseRepo('../etc', 'passwd'), { status: 400 });
  assert.throws(() => parseFullName('../x'), { status: 400 });
  assert.throws(() => parseFullName('o/..'), { status: 400 });
  assert.throws(() => parseRepo('octo', 'x?y=1'), { status: 400 });
});

test('days validation', () => {
  assert.equal(parseDays(undefined), 30);
  assert.equal(parseDays('7'), 7);
  assert.throws(() => parseDays('0'), { status: 400 });
  assert.throws(() => parseDays('91'), { status: 400 });
  assert.throws(() => parseDays('abc'), { status: 400 });
});
