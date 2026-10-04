const { createPool } = require('./config/db');
const { migrate } = require('./config/migrate');
const { assertProductionConfig } = require('./config/env');
const github = require('./services/githubService');
const { createApp } = require('./app');

/**
 * Adapts the Express app to a serverless platform (Vercel). The function is created once per instance, on the first
 * request: it connects, applies any pending migrations (safe under the advisory lock when several cold starts race)
 * and then serves every later request from the same warm app. A failed boot is not cached, so the next request retries.
 */
function createHandler({ config, deps = {} }) {
  let booting;

  const boot = () => {
    booting ??= (async () => {
      assertProductionConfig(config);
      const db = deps.db ?? createPool(config);
      if (config.migrateOnStart) await migrate(db);
      return createApp({ config, db, github: deps.github ?? github });
    })().catch((err) => {
      booting = undefined;
      throw err;
    });
    return booting;
  };

  return async function handler(req, res) {
    try {
      const app = await boot();
      return app(req, res);
    } catch (err) {
      console.error(JSON.stringify({ level: 'error', msg: 'serverless boot failed', error: err.message }));
      res.statusCode = 503;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'The service is starting up or misconfigured. Please try again shortly.' }));
    }
  };
}

module.exports = { createHandler };
