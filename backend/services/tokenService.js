const jwt = require('jsonwebtoken');

const COOKIE = 'devpulse_token';
const MAX_AGE_MS = 7 * 24 * 3600 * 1000;
const ISSUER = 'devpulse';
const ALGORITHM = 'HS256'; // pinned on both sign and verify, so a forged "alg: none" token is rejected

const signSession = (config, user, expiresIn = '7d') =>
  jwt.sign({ sub: user.id, login: user.login }, config.jwtSecret, { algorithm: ALGORITHM, issuer: ISSUER, expiresIn });

const verifySession = (config, token) =>
  jwt.verify(token, config.jwtSecret, { algorithms: [ALGORITHM], issuer: ISSUER });

const cookieOptions = (config) => ({
  httpOnly: true,
  sameSite: 'lax',
  secure: config.isProd,
  maxAge: MAX_AGE_MS,
  path: '/',
});

module.exports = { COOKIE, signSession, verifySession, cookieOptions };
