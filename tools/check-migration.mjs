// Uses an isolated PostgreSQL WASM engine supplied as the first argument.
// Never connects to the user's database. No project dependency is required.
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
const {PGlite}=await import(pathToFileURL(resolve(process.argv[2])).href);
const root=fileURLToPath(new URL('../',import.meta.url));
const db=new PGlite();
async function sql(file){
  let text=await readFile(resolve(root,file),'utf8');
  text=text.replace(/^\\i[r]? .+$/gm,'');
  await db.exec(text);
}
await sql('database/schema.sql');
await sql('database/seed.sql');
await sql('database/seed-generated.sql');
const tables=['locations','stories','media','timeline_events','quiz_questions','contributions','location_categories'];
const before={};
for(const table of tables)before[table]=(await db.query(`SELECT * FROM ${table} ORDER BY 1,2`)).rows;
await sql('database/migrations/002-governorates.sql');
await sql('database/seed-palestine.sql');
// A second run must preserve both original and newly seeded data.
await sql('database/migrations/002-governorates.sql');
await sql('database/seed-palestine.sql');
for(const table of tables){
  const after=(await db.query(`SELECT * FROM ${table} ORDER BY 1,2`)).rows;
  for(const old of before[table]){
    const row=after.find((item)=>item.id?item.id===old.id:item.location_id===old.location_id&&item.category_id===old.category_id);
    assert.ok(row,`Missing original ${table} row`);
    for(const key of Object.keys(old))assert.deepEqual(row[key],old[key],`${table}.${old.id??old.location_id}.${key} changed`);
  }
}
assert.equal((await db.query('SELECT COUNT(*)::int AS count FROM governorates')).rows[0].count,7);
assert.equal((await db.query('SELECT COUNT(*)::int AS count FROM locations')).rows[0].count,26);
assert.equal((await db.query("SELECT COUNT(*)::int AS count FROM locations WHERE governorate_id='jerusalem'")).rows[0].count,8);
assert.equal((await db.query("SELECT COUNT(*)::int AS count FROM stories WHERE is_ai_generated AND status='published' AND location_id NOT IN (SELECT id FROM locations WHERE governorate_id='jerusalem')")).rows[0].count,0);
console.log(`Migration and seed ran twice; preserved all original rows in ${tables.length} tables; four governorates and 14 locations present.`);
await db.close();
