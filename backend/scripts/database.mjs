// Run from the complete repository checkout, not a Render rootDir=backend shell.
// Credentials come only from DATABASE_URL; never put them in command arguments.
import { readFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

export const databaseDir = fileURLToPath(new URL('../../database/', import.meta.url));
const digest = (sql) => createHash('sha256').update(sql).digest('hex');
// The legacy development SQL is preserved. Production runs inside one transaction
// and omits its destructive reset statements, after verifying an empty schema.
const body = (sql) => sql.replace(/^(?:BEGIN;|COMMIT;)\s*$/gm, '');

export async function initialize(client) {
  const objects = await client.query("SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind IN ('r','p','v','m','S','f')");
  if (objects.rows.length) throw new Error('Initialization refused: public schema is not empty. Use migrations for an existing database.');
  for (const name of ['schema.sql', 'seed.sql', 'seed-generated.sql', 'migrations/002-governorates.sql', 'seed-palestine.sql']) {
    const sql = await readFile(`${databaseDir}/${name}`, 'utf8');
    await client.query(body(sql).replace(/^DROP .+;\s*$/gm, '').replace(/^DELETE .+;\s*$/gm, ''));
  }
  await client.query('CREATE TABLE hikaya_migrations (name text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())');
  const migration = await readFile(`${databaseDir}/migrations/002-governorates.sql`, 'utf8');
  await client.query('INSERT INTO hikaya_migrations(name,checksum) VALUES ($1,$2)', ['002-governorates.sql', digest(migration)]);
  const national = await readFile(`${databaseDir}/seed-palestine.sql`, 'utf8');
  await client.query('INSERT INTO hikaya_migrations(name,checksum) VALUES ($1,$2)', ['003-palestine-reviewed-seed', digest(national)]);
}

export async function migrate(client) {
  // Existing installations must already contain the legacy schema. No seeds run here.
  await client.query('SELECT id FROM locations LIMIT 0');
  await client.query('CREATE TABLE IF NOT EXISTS hikaya_migrations (name text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())');
  const files = (await readdir(`${databaseDir}/migrations`)).filter((name) => /^\d+.*\.sql$/.test(name));
  const migrations = files.map((name) => ({ name, file: `migrations/${name}` }));
  // Existing additive national seed doubles as a tracked data migration.
  migrations.push({ name: '003-palestine-reviewed-seed', file: 'seed-palestine.sql' });
  migrations.sort((a, b) => a.name.localeCompare(b.name));
  for (const { name, file } of migrations) {
    const sql = await readFile(`${databaseDir}/${file}`, 'utf8');
    const old = await client.query('SELECT checksum FROM hikaya_migrations WHERE name=$1', [name]);
    if (old.rows.length) {
      if (old.rows[0].checksum !== digest(sql)) throw new Error(`Applied migration changed: ${name}. Add a new migration instead.`);
      continue;
    }
    await client.query(body(sql));
    await client.query('INSERT INTO hikaya_migrations(name,checksum) VALUES ($1,$2)', [name, digest(sql)]);
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const action = process.argv[2];
  if (!['initialize', 'migrate'].includes(action) || !process.env.DATABASE_URL) {
    console.error('Set DATABASE_URL securely, then run: node backend/scripts/database.mjs initialize|migrate');
    process.exit(1);
  }
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 10000 });
  try {
    await client.connect();
    await client.query('BEGIN');
    await client.query("SELECT pg_advisory_xact_lock(728419561)");
    await (action === 'initialize' ? initialize(client) : migrate(client));
    await client.query('COMMIT');
    console.log(`Database ${action} completed successfully.`);
  } catch {
    await client.query('ROLLBACK').catch(() => {});
    console.error(`Database ${action} failed; transaction rolled back. Check connectivity and whether the public schema is empty. No credentials were logged.`);
    process.exitCode = 1;
  } finally { await client.end().catch(() => {}); }
}
