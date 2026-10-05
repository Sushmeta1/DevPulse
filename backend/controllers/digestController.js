const crypto = require('crypto');
const { HttpError } = require('../utils/httpError');
const { encrypt } = require('../utils/crypto');
const { parseFullName, parseTzOffset } = require('../utils/validate');
const { sendDigestFor, runDueDigests, emailConfigured, SLACK_URL, MAX_DIGEST_REPOS } = require('../services/digestService');

const dto = (row, req) => {
  const { config } = req.app.locals.deps;
  return {
    configured: Boolean(row),
    enabled: row?.enabled ?? true,
    repos: row?.repos ?? [],
    sendEmail: row?.send_email ?? false,
    slackConnected: Boolean(row?.slack_webhook_enc),
    weekday: row?.weekday ?? 1,
    tzOffset: row?.tz_offset ?? 0,
    includeAi: row?.include_ai ?? true,
    lastSentAt: row?.last_sent_at ?? null,
    lastStatus: row?.last_status ?? null,
    channels: {
      email: { available: emailConfigured(config), address: req.user.email ? maskEmail(req.user.email) : null },
      slack: { available: true },
    },
  };
};

function maskEmail(email) {
  const [name, domain] = email.split('@');
  return `${name.slice(0, 2)}${'*'.repeat(Math.max(1, name.length - 2))}@${domain}`;
}

async function load(req) {
  const { rows } = await req.app.locals.deps.db.query('SELECT * FROM digests WHERE user_id = $1', [req.user.id]);
  return rows[0];
}

const getDigest = async (req, res) => res.json(dto(await load(req), req));

function parseBody(body = {}) {
  const repos = body.repos === undefined ? undefined : [...new Set((Array.isArray(body.repos) ? body.repos : []).map((r) => {
    const { owner, name } = parseFullName(String(r));
    return `${owner}/${name}`;
  }))];
  if (repos && repos.length > MAX_DIGEST_REPOS) throw new HttpError(400, `Choose at most ${MAX_DIGEST_REPOS} repositories`);
  const weekday = body.weekday === undefined ? undefined : Number(body.weekday);
  if (weekday !== undefined && (!Number.isInteger(weekday) || weekday < 0 || weekday > 6)) throw new HttpError(400, 'weekday must be 0 (Sunday) to 6 (Saturday)');
  const slack = body.slackWebhookUrl;
  if (typeof slack === 'string' && slack !== '' && !SLACK_URL.test(slack)) throw new HttpError(400, 'That does not look like a Slack incoming-webhook URL (https://hooks.slack.com/services/...)');
  return { repos, weekday, slack, tzOffset: body.tzOffset === undefined ? undefined : parseTzOffset(body.tzOffset) };
}

async function putDigest(req, res) {
  const { db, config } = req.app.locals.deps;
  if (req.user.is_demo) throw new HttpError(403, 'The demo workspace cannot send digests. Preview works.');
  const b = req.body || {};
  const parsed = parseBody(b);
  const existing = await load(req);

  const sendEmail = b.sendEmail === undefined ? existing?.send_email ?? false : Boolean(b.sendEmail);
  if (sendEmail && !emailConfigured(config)) throw new HttpError(400, 'E-mail delivery is not configured on this server. Use Slack, or ask the admin to set RESEND_API_KEY.');
  if (sendEmail && !req.user.email) throw new HttpError(400, 'Your GitHub account has no verified e-mail address to send to.');

  // undefined = keep what is stored; '' / null = disconnect Slack; a URL = replace (stored encrypted).
  let slackEnc = existing?.slack_webhook_enc ?? null;
  if (parsed.slack === '' || b.slackWebhookUrl === null) slackEnc = null;
  else if (typeof parsed.slack === 'string') slackEnc = encrypt(parsed.slack, config.tokenEncryptionKey);

  const { rows } = await db.query(
    `INSERT INTO digests (user_id, repos, enabled, send_email, slack_webhook_enc, weekday, tz_offset, include_ai)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     ON CONFLICT (user_id) DO UPDATE SET repos = $2, enabled = $3, send_email = $4, slack_webhook_enc = $5,
       weekday = $6, tz_offset = $7, include_ai = $8, updated_at = now()
     RETURNING *`,
    [
      req.user.id, parsed.repos ?? existing?.repos ?? [], b.enabled === undefined ? existing?.enabled ?? true : Boolean(b.enabled),
      sendEmail, slackEnc, parsed.weekday ?? existing?.weekday ?? 1, parsed.tzOffset ?? existing?.tz_offset ?? 0,
      b.includeAi === undefined ? existing?.include_ai ?? true : Boolean(b.includeAi),
    ],
  );
  res.json(dto(rows[0], req));
}

async function deleteDigest(req, res) {
  await req.app.locals.deps.db.query('DELETE FROM digests WHERE user_id = $1', [req.user.id]);
  res.status(204).end();
}

/** Renders what would be sent, from the saved settings or from `repos` in the body. Never delivers anything. */
async function previewDigest(req, res) {
  const existing = await load(req);
  const parsed = parseBody(req.body);
  const digest = {
    repos: parsed.repos ?? existing?.repos ?? [], tz_offset: parsed.tzOffset ?? existing?.tz_offset ?? 0,
    include_ai: false, send_email: false, slack_webhook_enc: null,
  };
  const out = await sendDigestFor(req.deps, { user: req.user, digest, preview: true });
  res.json({
    subject: out.rendered.subject, text: out.rendered.text, html: out.rendered.html, slack: out.rendered.slack,
    skipped: out.team.skipped, repoCount: out.team.repos.length,
    note: 'Preview uses the free rule-based summary. When the digest is sent, the AI summary is used if you enabled it.',
  });
}

async function sendTest(req, res) {
  if (req.user.is_demo) throw new HttpError(403, 'The demo workspace cannot send digests. Preview works.');
  const existing = await load(req);
  if (!existing) throw new HttpError(400, 'Save your digest settings first.');
  const out = await sendDigestFor(req.deps, { user: req.user, digest: existing });
  if (!out.channels.length) throw new HttpError(400, 'Turn on e-mail or connect Slack first.');
  const ok = out.channels.some((c) => c.ok);
  await req.app.locals.deps.db.query('UPDATE digests SET last_status = $2, last_attempt_at = now(), updated_at = now() WHERE user_id = $1', [req.user.id, ok ? 'test sent' : 'error: test failed']);
  res.status(ok ? 200 : 502).json({ channels: out.channels });
}

/** Cron entry point (Vercel Cron or any scheduler): GET/POST /api/cron/digest with `Authorization: Bearer $CRON_SECRET`. */
async function cronDigest(req, res) {
  const { config } = req.app.locals.deps;
  if (!config.cronSecret) throw new HttpError(404, 'Not found'); // the endpoint does not exist unless a secret is set
  const given = crypto.createHash('sha256').update(String(req.get('authorization') || '').replace(/^Bearer /i, '')).digest();
  const wanted = crypto.createHash('sha256').update(config.cronSecret).digest();
  if (!crypto.timingSafeEqual(given, wanted)) throw new HttpError(401, 'Unauthorized');
  res.json(await runDueDigests(req.app.locals.deps));
}

module.exports = { getDigest, putDigest, deleteDigest, previewDigest, sendTest, cronDigest };
