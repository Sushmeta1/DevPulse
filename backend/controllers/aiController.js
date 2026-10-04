const { HttpError } = require('../utils/httpError');
const { parseFullName, parseDays, parseTzOffset } = require('../utils/validate');
const { syncRepository, SYNC_WINDOW_DAYS } = require('../services/syncService');
const { loadAndSummarize } = require('../services/analyticsService');
const { generateReport } = require('../services/aiService');

const KEEP_REPORTS = 20;

// Paid providers cost real money, so each user gets a rolling daily allowance. Rule-based reports are free.
async function enforceDailyQuota({ db, config }, userId) {
  const { provider, dailyLimit } = config.ai;
  if (provider === 'local' || !dailyLimit) return;
  const { rows } = await db.query(
    "SELECT count(*)::int AS n FROM ai_reports WHERE user_id = $1 AND provider <> 'local' AND created_at > now() - interval '24 hours'",
    [userId],
  );
  if (rows[0].n >= dailyLimit) {
    throw new HttpError(429, `Daily AI summary limit reached (${dailyLimit}). Try again tomorrow, or use the rule-based summary.`);
  }
}

const toDto = (r) => ({
  id: r.id, provider: r.provider, model: r.model, days: r.range_days,
  content: r.content, createdAt: r.created_at,
});

async function createSprintSummary(req, res) {
  const deps = req.deps;
  const { owner, name } = parseFullName(req.body?.repo);
  const days = parseDays(req.body?.days, 14);
  await enforceDailyQuota(deps, req.user.id);
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
  // Keep the history bounded.
  await deps.db.query(
    `DELETE FROM ai_reports WHERE id IN (
       SELECT id FROM ai_reports WHERE repository_id = $1 AND user_id = $2 ORDER BY created_at DESC OFFSET $3)`,
    [repo.id, req.user.id, KEEP_REPORTS],
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
