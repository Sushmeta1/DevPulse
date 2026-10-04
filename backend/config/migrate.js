const fs = require('fs');
const path = require('path');

const DIRS = [
  path.resolve(__dirname, '../../database/migrations'),
  path.resolve(__dirname, '../database/migrations'),
];
const LOCK_ID = 727274; // arbitrary, shared by every DevPulse instance

/**
 * Applies database/migrations/*.sql in order, once each, recording them in schema_migrations.
 * A Postgres advisory lock serialises concurrent starts (e.g. two Railway replicas booting together),
 * and each migration runs in its own transaction so a failure leaves nothing half-applied.
 */
async function migrate(pool) {
  const dir = DIRS.find((d) => fs.existsSync(d));
  if (!dir) throw new Error('database/migrations not found');
  const files = fs.readdirSync(dir).filter((f) => /^\d+_.+\.sql$/.test(f)).sort();

  const client = await pool.connect();
  try {
    await client.query('SELECT pg_advisory_lock($1)', [LOCK_ID]);
    await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
      version TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())`);
    const { rows } = await client.query('SELECT version FROM schema_migrations');
    const done = new Set(rows.map((r) => r.version));
    const applied = [];

    for (const file of files) {
      if (done.has(file)) continue;
      await client.query('BEGIN');
      try {
        await client.query(fs.readFileSync(path.join(dir, file), 'utf8'));
        await client.query('INSERT INTO schema_migrations (version) VALUES ($1)', [file]);
        await client.query('COMMIT');
        applied.push(file);
      } catch (err) {
        await client.query('ROLLBACK');
        throw new Error(`Migration ${file} failed: ${err.message}`);
      }
    }
    return applied;
  } finally {
    await client.query('SELECT pg_advisory_unlock($1)', [LOCK_ID]).catch(() => {});
    client.release();
  }
}

module.exports = { migrate };
