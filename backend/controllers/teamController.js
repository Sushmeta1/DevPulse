const { HttpError } = require('../utils/httpError');
const { parseFullName, parseDays, parseTzOffset } = require('../utils/validate');
const { computeTeam, MAX_REPOS } = require('../services/teamService');

function parseRepoList(value) {
  if (value === undefined || value === '') return null; // "all analyzed repositories"
  const names = [...new Set(String(value).split(',').map((s) => s.trim()).filter(Boolean))];
  if (names.length > MAX_REPOS) throw new HttpError(400, `Choose at most ${MAX_REPOS} repositories`);
  return names.map((n) => {
    const { owner, name } = parseFullName(n);
    return `${owner}/${name}`;
  });
}

async function analyzedRepoNames(db, userId) {
  const { rows } = await db.query(
    'SELECT full_name FROM repositories WHERE user_id = $1 AND last_synced_at IS NOT NULL ORDER BY pushed_at DESC NULLS LAST LIMIT $2',
    [userId, MAX_REPOS],
  );
  return rows.map((r) => r.full_name);
}

async function getTeamSummary(req, res) {
  const names = parseRepoList(req.query.repos) ?? await analyzedRepoNames(req.deps.db, req.user.id);
  const result = await computeTeam(req.deps, {
    userId: req.user.id, token: req.githubToken, names,
    days: parseDays(req.query.days), tzOffset: parseTzOffset(req.query.tzOffset), force: req.query.refresh === 'true',
  });
  res.json(result);
}

module.exports = { getTeamSummary, parseRepoList, analyzedRepoNames };
