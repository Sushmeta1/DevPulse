const path = require('path');
const dotenv = require('dotenv');

// Load backend/.env first, then fall back to a repo-root .env (docker-compose / local dev).
dotenv.config({ path: path.resolve(__dirname, '../.env'), quiet: true });
dotenv.config({ path: path.resolve(__dirname, '../../.env'), quiet: true });

function loadConfig(env = process.env) {
  const isProd = env.NODE_ENV === 'production';
  const port = Number(env.PORT) || 4000;
  // On Vercel the production domain is injected for us; locally and elsewhere BASE_URL (or localhost) is used.
  const vercelHost = env.VERCEL_PROJECT_PRODUCTION_URL || env.VERCEL_URL;
  const baseUrl = (env.BASE_URL || (vercelHost ? `https://${vercelHost}` : `http://localhost:${port}`)).replace(/\/$/, '');

  return {
    isProd,
    port,
    baseUrl,
    frontendUrl: (env.FRONTEND_URL || baseUrl).replace(/\/$/, ''),
    frontendDist: env.FRONTEND_DIST || path.resolve(__dirname, '../../frontend/dist'),
    databaseUrl: env.DATABASE_URL || 'postgresql://devpulse:devpulse@localhost:5432/devpulse',
    databaseSsl: env.DATABASE_SSL === 'true',
    // A serverless instance should hold few connections; many instances may exist at once.
    dbPoolMax: Number(env.DB_POOL_MAX) || (env.VERCEL ? 3 : 10),
    migrateOnStart: env.MIGRATE_ON_START !== 'false',
    logRequests: env.NODE_ENV !== 'test',
    // Multiplies every rate-limit ceiling. Leave at 1 in production; end-to-end runs log in dozens of times from one IP.
    rateLimitScale: Number(env.RATE_LIMIT_SCALE) > 0 ? Number(env.RATE_LIMIT_SCALE) : 1,
    cronSecret: env.CRON_SECRET || '',
    digestScheduler: env.DIGEST_SCHEDULER !== 'off',
    digestHourUtc: Number(env.DIGEST_HOUR_UTC ?? 7),
    // Email goes through Resend's HTTPS API (free tier is plenty for a weekly digest); Slack needs nothing but a webhook URL.
    email: { apiKey: env.RESEND_API_KEY || '', from: env.DIGEST_FROM || '' },
    demoEnabled: env.DEMO_ENABLED !== 'false',
    github: {
      clientId: env.GITHUB_CLIENT_ID || '',
      clientSecret: env.GITHUB_CLIENT_SECRET || '',
      callbackUrl: env.GITHUB_CALLBACK_URL || `${baseUrl}/api/auth/github/callback`,
      scope: env.GITHUB_SCOPE || 'read:user user:email repo',
    },
    jwtSecret: env.JWT_SECRET || (isProd ? '' : 'dev-only-jwt-secret-change-me'),
    tokenEncryptionKey: env.TOKEN_ENCRYPTION_KEY || env.JWT_SECRET || (isProd ? '' : 'dev-only-encryption-key'),
    ai: {
      provider: (env.AI_PROVIDER || (env.GEMINI_API_KEY ? 'gemini' : env.OPENAI_API_KEY ? 'openai' : 'local')).toLowerCase(),
      geminiApiKey: env.GEMINI_API_KEY || '',
      geminiModel: env.GEMINI_MODEL || 'gemini-2.5-flash',
      openaiApiKey: env.OPENAI_API_KEY || '',
      openaiModel: env.OPENAI_MODEL || 'gpt-4o-mini',
      // Reports per user per rolling 24h from a paid provider (0 = unlimited). Rule-based reports are free.
      dailyLimit: env.AI_DAILY_LIMIT === undefined ? 20 : Number(env.AI_DAILY_LIMIT),
    },
  };
}

// Fail fast on settings that would make the server insecure or unusable in production.
function assertProductionConfig(config) {
  if (!config.isProd) return;
  const missing = [];
  if (!config.jwtSecret) missing.push('JWT_SECRET');
  if (!config.tokenEncryptionKey) missing.push('TOKEN_ENCRYPTION_KEY');
  if (!config.github.clientId) missing.push('GITHUB_CLIENT_ID');
  if (!config.github.clientSecret) missing.push('GITHUB_CLIENT_SECRET');
  if (missing.length) throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
}

module.exports = { loadConfig, assertProductionConfig, config: loadConfig() };
