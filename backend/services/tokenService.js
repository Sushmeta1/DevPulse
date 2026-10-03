const jwt = require('jsonwebtoken');

const COOKIE = 'devpulse_token';
const MAX_AGE_MS = 7 * 24 * 3600 * 1000;

const signSession = (config, user) =>
  jwt.sign({ sub: user.id, login: user.login }, config.jwtSecret, { expiresIn: '7d' });

const verifySession = (config, token) => jwt.verify(token, config.jwtSecret);

const cookieOptions = (config) => ({
  httpOnly: true,
  sameSite: 'lax',
  secure: config.isProd,
  maxAge: MAX_AGE_MS,
  path: '/',
});

module.exports = { COOKIE, signSession, verifySession, cookieOptions };
