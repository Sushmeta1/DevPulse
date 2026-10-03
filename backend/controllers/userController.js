const { HttpError } = require('../utils/httpError');
const { COOKIE } = require('../services/tokenService');

function getUser(req, res) {
  const { id, login, name, email, avatar_url, is_demo } = req.user;
  res.json({ id, login, name, email, avatarUrl: avatar_url, isDemo: is_demo });
}

// Removes the user and, through ON DELETE CASCADE, every repository, commit, PR and report stored for them.
async function deleteAccount(req, res) {
  const { db, config, github } = req.app.locals.deps;
  if (req.user.is_demo) throw new HttpError(403, 'The shared demo account cannot be deleted');
  const revoked = await github.revokeGrant?.(config.github, req.githubToken);
  await db.query('DELETE FROM users WHERE id = $1', [req.user.id]);
  res.clearCookie(COOKIE, { path: '/' });
  res.set('X-GitHub-Grant-Revoked', revoked ? 'true' : 'false');
  res.status(204).end();
}

module.exports = { getUser, deleteAccount };
