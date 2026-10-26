// npm install --prefix .deployment-test/sql --no-save @electric-sql/pglite
// node tools/check-production-database.mjs
import { PGlite } from '../.deployment-test/sql/node_modules/@electric-sql/pglite/dist/index.js';
import { initialize, migrate } from '../backend/scripts/database.mjs';
import assert from 'node:assert/strict';
const db = new PGlite();
const client = { query: (sql, params) => params ? db.query(sql, params) : db.exec(sql).then((items) => items.at(-1)) };
try {
  await client.query('BEGIN');
  await initialize(client);
  await client.query('COMMIT');
  assert.equal((await db.query('SELECT COUNT(*)::int AS count FROM locations')).rows[0].count, 26);
  const before = (await db.query('SELECT * FROM contributions ORDER BY id')).rows;
  await assert.rejects(initialize(client), /not empty/);
  await client.query('BEGIN');
  await migrate(client);
  await migrate(client);
  await client.query('COMMIT');
  assert.deepEqual((await db.query('SELECT * FROM contributions ORDER BY id')).rows, before);
  console.log('PASS: safe initialization, 14 locations, repeat initialization refused, migrations twice preserve contributions.');
} finally { await db.close(); }
