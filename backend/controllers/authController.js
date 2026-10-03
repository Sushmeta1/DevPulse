const crypto = require('crypto');
const { HttpError } = require('../utils/httpError');
const { encrypt } = require('../utils/crypto');
const { COOKIE, signSession, cookieOptions } = require('../services/tokenService');

const STATE_COOKIE = 'devpulse_oauth_state';

function redirectToGithub(req, res) {
  const { config } = req.app.locals.deps;
  if (!config.github.clientId) throw new HttpError(500, 'GitHub OAuth is not configured');

  const state = crypto.randomBytes(16).toString('hex');
  res.cookie(STATE_COOKIE, state, { httpOnly: true, sameSite: 'lax', secure: config.isProd, maxAge: 10 * 60 * 1000 });

  const url = new URL('https://github.com/login/oauth/authorize');
  url.search = new URLSearchParams({
    client_id: config.github.clientId,
    redirect_uri: config.github.callbackUrl,
    scope: config.github.scope,
    state,
  }).toString();
  res.redirect(url.toString());
}

async function handleCallback(req, res) {
  const { config, db, github } = req.app.locals.deps;
  const { code, state } = req.query;
  const expected = req.cookies?.[STATE_COOKIE];
  res.clearCookie(STATE_COOKIE);

  const fail = (reason) => res.redirect(`${config.frontendUrl}/?error=${encodeURIComponent(reason)}`);
  if (typeof code !== 'string' || !expected || state !== expected) return fail('invalid_oauth_state');

  let token;
  let profile;
  try {
    token = await github.exchangeCodeForToken(config.github, code);
    profile = await github.getAuthenticatedUser(token);
  } catch {
    return fail('github_login_failed');
  }

  const { rows } = await db.query(
    `INSERT INTO users (github_id, login, name, email, avatar_url, access_token_enc)
     VALUES ($1,$2,$3,$4,$5,$6)
     ON CONFLICT (github_id) DO UPDATE SET
       login = EXCLUDED.login, name = EXCLUDED.name, email = EXCLUDED.email,
       avatar_url = EXCLUDED.avatar_url, access_token_enc = EXCLUDED.access_token_enc, updated_at = now()
     RETURNING id, login`,
    [profile.id, profile.login, profile.name, profile.email, profile.avatar_url, encrypt(token, config.tokenEncryptionKey)],
  );

  res.cookie(COOKIE, signSession(config, rows[0]), cookieOptions(config));
  res.redirect(`${config.frontendUrl}/dashboard`);
}

function logout(req, res) {
  res.clearCookie(COOKIE, { path: '/' });
  res.status(204).end();
}

module.exports = { redirectToGithub, handleCallback, logout };
