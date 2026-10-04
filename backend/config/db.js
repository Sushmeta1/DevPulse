const { Pool } = require('pg');

function createPool(config) {
  const pool = new Pool({
    connectionString: config.databaseUrl,
    ssl: config.databaseSsl ? { rejectUnauthorized: false } : undefined,
    max: config.dbPoolMax || 10,
    idleTimeoutMillis: 10000,
    connectionTimeoutMillis: 5000,
    statement_timeout: 20000, // a runaway query must not hold a connection forever
  });
  // An error on an idle client (database restart, network blip) is emitted on the pool; without a
  // listener Node treats it as an uncaught exception and kills the process.
  pool.on('error', (err) => console.error(JSON.stringify({ level: 'error', msg: 'idle postgres client error', error: err.message })));
  return pool;
}

module.exports = { createPool };
