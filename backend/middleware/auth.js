const { HttpError } = require('../utils/httpError');
const { COOKIE, verifySession } = require('../services/tokenService');
const { decrypt } = require('../utils/crypto');
const { demoGithub } = require('../services/demoData');

// Resolves the session cookie to a user row and the user's decrypted GitHub token.
async function requireAuth(req, res, next) {
  const deps = req.app.locals.deps;
  const { config, db } = deps;
  const raw = req.cookies?.[COOKIE];
  if (!raw) throw new HttpError(401, 'Authentication required');

  let payload;
  try {
    payload = verifySession(config, raw);
  } catch {
    throw new HttpError(401, 'Session expired. Please log in again.');
  }

  const { rows } = await db.query('SELECT * FROM users WHERE id = $1', [payload.sub]);
  if (!rows[0]) throw new HttpError(401, 'Account not found');

  req.user = rows[0];
  // The shared demo account runs the full pipeline against generated data and never touches GitHub or paid AI APIs.
  req.deps = rows[0].is_demo
    ? { ...deps, github: demoGithub, config: { ...config, ai: { ...config.ai, provider: 'local' } } }
    : deps;
  try {
    req.githubToken = decrypt(rows[0].access_token_enc, config.tokenEncryptionKey);
  } catch {
    throw new HttpError(401, 'Stored GitHub credentials are unreadable. Please log in again.');
  }
  next();
}

module.exports = { requireAuth };
