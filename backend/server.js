const { config, assertProductionConfig } = require('./config/env');
const { createPool } = require('./config/db');
const { migrate } = require('./config/migrate');
const github = require('./services/githubService');
const { createApp } = require('./app');
const { runDueDigests } = require('./services/digestService');

const DIGEST_LOCK = 727275;

/**
 * Long-running servers send digests themselves (serverless hosts use the cron endpoint instead). It wakes every 30 minutes
 * but only acts during the configured UTC hour, and an advisory lock keeps replicas from running it concurrently.
 */
function startDigestScheduler(deps) {
  const tick = async () => {
    if (new Date().getUTCHours() !== deps.config.digestHourUtc) return;
    const client = await deps.db.connect();
    let locked = false;
    try {
      locked = (await client.query('SELECT pg_try_advisory_lock($1) AS ok', [DIGEST_LOCK])).rows[0].ok;
      if (!locked) return;
      const result = await runDueDigests(deps);
      if (result.due) console.log(JSON.stringify({ level: 'info', msg: 'digests', ...result }));
    } catch (err) {
      console.error(JSON.stringify({ level: 'error', msg: 'digest scheduler failed', error: err.message }));
    } finally {
      // Session-level locks outlive the query, and this connection goes back to the pool: always release it.
      if (locked) await client.query('SELECT pg_advisory_unlock($1)', [DIGEST_LOCK]).catch(() => {});
      client.release();
    }
  };
  const timer = setInterval(tick, 30 * 60 * 1000);
  timer.unref();
  return timer;
}

async function main() {
  assertProductionConfig(config);
  const db = createPool(config);
  await migrate(db);

  const deps = { config, db, github };
  const app = createApp(deps);
  if (config.digestScheduler) startDigestScheduler(deps);
  const server = app.listen(config.port, () => {
    console.log(`DevPulse API listening on :${config.port}`);
  });

  const shutdown = () => server.close(() => db.end().finally(() => process.exit(0)));
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

main().catch((err) => {
  console.error('Failed to start DevPulse:', err);
  process.exit(1);
});
