const path = require('path');
const dotenv = require('dotenv');

// Load backend/.env first, then fall back to a repo-root .env (docker-compose / local dev).
dotenv.config({ path: path.resolve(__dirname, '../.env'), quiet: true });
dotenv.config({ path: path.resolve(__dirname, '../../.env'), quiet: true });

function loadConfig(env = process.env) {
  const isProd = env.NODE_ENV === 'production';
  const port = Number(env.PORT) || 4000;
  const baseUrl = (env.BASE_URL || `http://localhost:${port}`).replace(/\/$/, '');

  return {
    isProd,
    port,
    baseUrl,
    frontendUrl: (env.FRONTEND_URL || baseUrl).replace(/\/$/, ''),
    frontendDist: env.FRONTEND_DIST || path.resolve(__dirname, '../../frontend/dist'),
    databaseUrl: env.DATABASE_URL || 'postgresql://devpulse:devpulse@localhost:5432/devpulse',
    databaseSsl: env.DATABASE_SSL === 'true',
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
