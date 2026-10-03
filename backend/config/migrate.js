const fs = require('fs');
const path = require('path');

const SCHEMA_PATHS = [
  path.resolve(__dirname, '../../database/schema.sql'),
  path.resolve(__dirname, '../database/schema.sql'), // Docker image layout
];

async function migrate(pool) {
  const file = SCHEMA_PATHS.find((p) => fs.existsSync(p));
  if (!file) throw new Error('database/schema.sql not found');
  await pool.query(fs.readFileSync(file, 'utf8'));
}

module.exports = { migrate };
