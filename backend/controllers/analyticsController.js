const { parseFullName, parseDays, parseTzOffset } = require('../utils/validate');
const { syncRepository, SYNC_WINDOW_DAYS } = require('../services/syncService');
const { loadAndSummarize } = require('../services/analyticsService');
const { toDto } = require('./repositoryController');

async function getSummary(req, res) {
  const deps = req.deps;
  const { owner, name } = parseFullName(req.query.repo);
  const days = parseDays(req.query.days);
  const repo = await syncRepository(deps, { userId: req.user.id, token: req.githubToken, owner, name, force: req.query.refresh === 'true' });
  const summary = await loadAndSummarize(deps.db, repo, days, {
    tzOffset: parseTzOffset(req.query.tzOffset),
    syncWindowDays: SYNC_WINDOW_DAYS,
  });
  res.json({ repository: toDto(repo), lastSyncedAt: repo.last_synced_at, ...summary });
}

module.exports = { getSummary };
