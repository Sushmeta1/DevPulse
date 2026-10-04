const { config, assertProductionConfig } = require('./config/env');
const { createPool } = require('./config/db');
const { migrate } = require('./config/migrate');
const github = require('./services/githubService');
const { createApp } = require('./app');

async function main() {
  assertProductionConfig(config);
  const db = createPool(config);
  await migrate(db);

  const app = createApp({ config, db, github });
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
