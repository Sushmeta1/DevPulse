const { parseFullName, parseDays, parseTzOffset } = require('../utils/validate');
const { syncRepository, SYNC_WINDOW_DAYS } = require('../services/syncService');
const { loadAndSummarize } = require('../services/analyticsService');
const { generateReport } = require('../services/aiService');

const toDto = (r) => ({
  id: r.id, provider: r.provider, model: r.model, days: r.range_days,
  content: r.content, createdAt: r.created_at,
});

async function createSprintSummary(req, res) {
  const deps = req.deps;
  const { owner, name } = parseFullName(req.body?.repo);
  const days = parseDays(req.body?.days, 14);
  const repo = await syncRepository(deps, { userId: req.user.id, token: req.githubToken, owner, name });
  const summary = await loadAndSummarize(deps.db, repo, days, {
    tzOffset: parseTzOffset(req.body?.tzOffset),
    syncWindowDays: SYNC_WINDOW_DAYS,
  });
  const report = await generateReport(deps.config.ai, repo.full_name, summary);

  const { rows } = await deps.db.query(
    `INSERT INTO ai_reports (repository_id, user_id, provider, model, range_days, content, metrics)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
    [repo.id, req.user.id, report.provider, report.model, days, JSON.stringify(report.content), JSON.stringify(summary.totals)],
  );
  res.status(201).json(toDto(rows[0]));
}

async function listReports(req, res) {
  const { db } = req.deps;
  const { owner, name } = parseFullName(req.query.repo);
  const { rows } = await db.query(
    `SELECT a.* FROM ai_reports a JOIN repositories r ON r.id = a.repository_id
     WHERE r.user_id = $1 AND lower(r.full_name) = lower($2)
     ORDER BY a.created_at DESC LIMIT 10`,
    [req.user.id, `${owner}/${name}`],
  );
  res.json(rows.map(toDto));
}

module.exports = { createSprintSummary, listReports };
