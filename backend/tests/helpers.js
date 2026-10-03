const jwt = require('jsonwebtoken');
const { loadConfig } = require('../config/env');
const { encrypt } = require('../utils/crypto');

const config = loadConfig({
  NODE_ENV: 'test',
  JWT_SECRET: 'test-secret',
  TOKEN_ENCRYPTION_KEY: 'test-key',
  GITHUB_CLIENT_ID: 'cid',
  GITHUB_CLIENT_SECRET: 'csecret',
  FRONTEND_DIST: '/nonexistent',
});

const sessionCookie = (userId = 1) =>
  `devpulse_token=${jwt.sign({ sub: userId, login: 'octo' }, config.jwtSecret)}`;

const userRow = (id = 1) => ({
  id, login: 'octo', name: 'Octo', email: null, avatar_url: 'https://a/x.png',
  access_token_enc: encrypt('gh-token', config.tokenEncryptionKey),
});

module.exports = { config, sessionCookie, userRow };
