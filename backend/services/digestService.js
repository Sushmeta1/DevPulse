const { computeTeam } = require('./teamService');
const { generateReport, localReport } = require('./aiService');
const { renderDigest } = require('./digestRender');
const { decrypt } = require('../utils/crypto');
const { fetchWithTimeout } = require('../utils/http');

const DAY = 86400000;
const DIGEST_DAYS = 7;
const MIN_GAP_MS = 5 * DAY;      // never more than one digest in a week
const RETRY_AFTER_MS = 10 * 3600000; // a failed attempt is retried by the next daily run
const MAX_DIGEST_REPOS = 10;
const SLACK_URL = /^https:\/\/hooks\.slack\.com\/services\/[A-Za-z0-9/_-]+$/;

const emailConfigured = (config) => Boolean(config.email?.apiKey && config.email?.from);

// ----------------------------------------------------------------------------------------------- delivery
async function sendSlack(webhookUrl, payload) {
  if (!SLACK_URL.test(webhookUrl)) throw new Error('Slack webhook URL is invalid');
  const res = await fetchWithTimeout(webhookUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }, 10000);
  if (!res.ok) throw new Error(`Slack returned ${res.status}`);
}

async function sendEmail(config, { to, subject, html, text }) {
  if (!emailConfigured(config)) throw new Error('E-mail delivery is not configured on this server');
  const res = await fetchWithTimeout('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.email.apiKey}` },
    body: JSON.stringify({ from: config.email.from, to: [to], subject, html, text }),
  }, 10000);
  if (!res.ok) throw new Error(`E-mail provider returned ${res.status}`);
}

// ------------------------------------------------------------------------------------------- scheduling
/** Local weekday (0 = Sunday) for a user whose clock is `tzOffset` minutes east of UTC. */
const localWeekday = (now, tzOffset) => new Date(now.getTime() + tzOffset * 60000).getUTCDay();

/** Is this subscription due at `now`? Pure, so the schedule can be tested without a database or a clock. */
function isDue(d, now = new Date()) {
  if (!d.enabled) return false;
  const lastSent = d.last_sent_at ? new Date(d.last_sent_at).getTime() : null;
  if (lastSent !== null && now.getTime() - lastSent < MIN_GAP_MS) return false;
  if (localWeekday(now, d.tz_offset) === d.weekday) return true;
  // A failed attempt is retried on the next run instead of waiting a whole week.
  const attempt = d.last_attempt_at ? new Date(d.last_attempt_at).getTime() : null;
  return Boolean(d.last_status?.startsWith('error') && attempt !== null && now.getTime() - attempt > RETRY_AFTER_MS);
}

// ------------------------------------------------------------------------------------------ one digest
/** Builds and delivers one user's digest. Returns what happened per channel; never throws for delivery failures. */
async function sendDigestFor(deps, { user, digest, preview = false }) {
  const { db, config } = deps;
  const names = digest.repos?.length
    ? digest.repos
    : (await db.query(
      'SELECT full_name FROM repositories WHERE user_id = $1 AND last_synced_at IS NOT NULL ORDER BY pushed_at DESC NULLS LAST LIMIT $2',
      [user.id, MAX_DIGEST_REPOS],
    )).rows.map((r) => r.full_name);

  const team = await computeTeam(deps, {
    userId: user.id, token: decrypt(user.access_token_enc, config.tokenEncryptionKey), names: names.slice(0, MAX_DIGEST_REPOS),
    days: DIGEST_DAYS, tzOffset: digest.tz_offset ?? 0,
  });

  // Previews and the demo never spend a paid AI call; a failed AI call must not cost anyone their digest.
  let report = localReport(`${team.repos.length} repositories`, team.aggregate);
  report = { provider: 'local', content: report };
  if (!preview && digest.include_ai && config.ai.provider !== 'local') {
    try {
      report = await generateReport(config.ai, `${team.repos.length} repositories`, team.aggregate);
    } catch {
      /* keep the rule-based summary */
    }
  }

  const rendered = renderDigest({ team, report, baseUrl: config.baseUrl });
  if (preview) return { rendered, team, channels: [] };

  const channels = [];
  if (digest.send_email) {
    if (!user.email) channels.push({ channel: 'email', ok: false, error: 'No verified e-mail address on your GitHub account' });
    else {
      try {
        await sendEmail(config, { to: user.email, subject: rendered.subject, html: rendered.html, text: rendered.text });
        channels.push({ channel: 'email', ok: true });
      } catch (err) { channels.push({ channel: 'email', ok: false, error: err.message }); }
    }
  }
  if (digest.slack_webhook_enc) {
    try {
      await sendSlack(decrypt(digest.slack_webhook_enc, config.tokenEncryptionKey), rendered.slack);
      channels.push({ channel: 'slack', ok: true });
    } catch (err) { channels.push({ channel: 'slack', ok: false, error: err.message }); }
  }
  return { rendered, team, channels };
}

const statusFor = (channels) => {
  if (!channels.length) return 'error: no delivery channel is set up';
  const failed = channels.filter((c) => !c.ok);
  if (!failed.length) return 'sent';
  if (failed.length === channels.length) return `error: ${failed.map((f) => `${f.channel}: ${f.error}`).join('; ')}`;
  return `sent (partial): ${failed.map((f) => `${f.channel}: ${f.error}`).join('; ')}`;
};

// --------------------------------------------------------------------------------------------- the run
/**
 * Sends every digest that is due. Safe to call from a cron endpoint, an in-process timer, or several replicas at
 * once: each subscription is claimed with a single UPDATE, so exactly one runner handles it.
 */
async function runDueDigests(deps, { now = new Date(), budgetMs = 45000 } = {}) {
  const { db } = deps;
  const started = Date.now();
  const { rows } = await db.query(
    `SELECT d.*, u.access_token_enc, u.email, u.login, u.id AS uid FROM digests d JOIN users u ON u.id = d.user_id
     WHERE d.enabled AND NOT u.is_demo AND (d.last_sent_at IS NULL OR d.last_sent_at < $1)
     ORDER BY d.last_sent_at NULLS FIRST LIMIT 200`,
    [new Date(now.getTime() - MIN_GAP_MS)],
  );
  const result = { considered: rows.length, due: 0, sent: 0, failed: 0, skipped: 0, deferred: 0 };

  for (const d of rows) {
    if (!isDue(d, now)) { result.skipped += 1; continue; }
    if (Date.now() - started > budgetMs) { result.deferred += 1; continue; } // next run picks them up
    result.due += 1;

    const claim = await db.query(
      `UPDATE digests SET last_attempt_at = now() WHERE user_id = $1 AND (last_attempt_at IS NULL OR last_attempt_at < $2) RETURNING user_id`,
      [d.user_id, new Date(Date.now() - RETRY_AFTER_MS)],
    );
    if (!claim.rowCount) { result.skipped += 1; continue; } // another runner has it

    let status;
    let ok = false;
    try {
      const out = await sendDigestFor(deps, { user: { id: d.uid, email: d.email, access_token_enc: d.access_token_enc }, digest: d });
      status = statusFor(out.channels);
      ok = out.channels.some((c) => c.ok);
    } catch (err) {
      status = `error: ${err.message}`;
    }
    await db.query(
      'UPDATE digests SET last_status = $2, last_sent_at = CASE WHEN $3 THEN now() ELSE last_sent_at END, updated_at = now() WHERE user_id = $1',
      [d.user_id, status.slice(0, 500), ok],
    );
    if (ok) result.sent += 1; else result.failed += 1;
  }
  return result;
}

module.exports = {
  isDue, localWeekday, runDueDigests, sendDigestFor, sendSlack, sendEmail, emailConfigured, statusFor,
  SLACK_URL, MAX_DIGEST_REPOS, DIGEST_DAYS,
};
