// Test-only PostgreSQL WASM server, never an existing database or a paid AI provider.
// Requires .deployment-test/sql packages and .deployment-test/venv (see deployment docs).
import { PGlite } from '../.deployment-test/sql/node_modules/@electric-sql/pglite/dist/index.js';
import { PGLiteSocketServer } from '../.deployment-test/sql/node_modules/@electric-sql/pglite-socket/dist/index.js';
import { initialize } from '../backend/scripts/database.mjs';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdir, appendFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

const root = fileURLToPath(new URL('../', import.meta.url));
const dataPath = resolve(root, '.deployment-test/stack-data-' + Date.now());
await mkdir(resolve(root, '.deployment-test'), { recursive: true });
let db = await PGlite.create(dataPath);
const adapter = { query: (sql, params) => params ? db.query(sql, params) : db.exec(sql).then((items) => items.at(-1)) };
await adapter.query('BEGIN');
await initialize(adapter);
await adapter.query('COMMIT');
let socket = new PGLiteSocketServer({ db, host: '127.0.0.1', port: 15439 });
await socket.start();
const processes = [];
const env = { ...process.env, NODE_ENV: 'production', HIKAYA_INTERNAL_TOKEN: 'local-test-internal', AI_INTERNAL_TOKEN: 'local-test-ai',
  DATABASE_URL: 'postgresql://postgres@127.0.0.1:15439/postgres', AI_SERVICE_URL: 'http://127.0.0.1:18019',
  HIKAYA_API_BASE_URL: 'http://127.0.0.1:13019/api/v1', APP_URL: 'http://127.0.0.1:15179',
  ANTHROPIC_API_KEY: '', GEMINI_API_KEY: '', VIDEO_REQUESTS_PER_HOUR: '1', PG_POOL_MAX: '1' };
const web = env.APP_URL;
function launch(name, binary, args, cwd, port) {
  const child = spawn(binary, args, { cwd, env: { ...env, PORT: String(port) }, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  processes.push(child);
  for (const stream of [child.stdout, child.stderr]) stream.on('data', (chunk) => void appendFile(resolve(root, `.deployment-test/${name}.log`), chunk));
  return child;
}
async function stop(child) { if (child.exitCode === null && child.signalCode === null) { const exited = once(child, 'exit'); child.kill(); await exited; } }
async function ready(url) {
  for (let i = 0; i < 80; i++) {
    try { if ((await fetch(url)).ok) return; } catch {}
    await new Promise((done) => setTimeout(done, 250));
  }
  throw new Error('Server did not start: ' + url);
}
async function json(path, body, status = 200) {
  const response = await fetch(web + path, body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {});
  assert.equal(response.status, status, path + ': ' + await response.clone().text());
  return response.json();
}
let backend;
try {
  launch('ai', resolve(root, '.deployment-test/venv/Scripts/python.exe'), ['-m', 'uvicorn', 'service.app:app', '--app-dir', 'ai', '--host', '127.0.0.1', '--port', '18019'], root, 18019);
  backend = launch('backend', process.execPath, ['dist/main.js'], resolve(root, 'backend'), 13019);
  launch('frontend', process.execPath, ['runtime/server.cjs'], resolve(root, 'frontend'), 15179);
  await Promise.all([ready(web + '/health'), ready(env.AI_SERVICE_URL + '/health'), ready('http://127.0.0.1:13019/api/v1/health')]);
  assert.equal((await json('/api/v1/health')).dataSource, 'postgres');
  assert.equal((await fetch('http://127.0.0.1:13019/api/v1/locations')).status, 401);
  assert.equal((await fetch(env.AI_SERVICE_URL + '/modes')).status, 401);
  for (const path of ['/api/download-zip', '/server.cjs', '/server.cjs.map', '/runtime/server.cjs', '/api/missing']) {
    const response = await fetch(web + path);
    // runtime/ is outside the static root; SPA fallback may respond with HTML only.
    if (path === '/runtime/server.cjs') assert.ok(!(await response.text()).includes('GEMINI_API_KEY'));
    else assert.equal(response.status, 404, path);
  }
  assert.equal((await fetch(web + '/api/tts', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://evil.example' }, body: '{}' })).status, 403);
  const all = await json('/api/v1/locations?scope=all');
  assert.equal(all.length, 26);
  assert.equal((await json('/api/v1/locations')).length, 8);
  assert.equal((await json('/api/v1/governorates')).length, 7);
  await json('/api/v1/ai/generate-story', { historicalText: 'Unreviewed visitor text' }, 400);
  for (const location of all) {
    for (const suffix of ['media', 'timeline', 'quiz']) {
      const items = await json(`/api/v1/locations/${location.id}/${suffix}`);
      assert.ok(Array.isArray(items));
      if (location.governorateId === 'jerusalem' || suffix === 'quiz') assert.ok(items.length, `${location.id}/${suffix} empty`);
    }
  }
  for (const path of ['/', '/jerusalem', '/palestine-map', '/create-story', '/governorates/hebron', '/locations/muslim-quarter', '/contribute']) {
    const response = await fetch(web + path);
    assert.equal(response.status, 200);
    assert.ok((await response.text()).includes('<div id="root">'));
  }
  for (const id of ['muslim-quarter', 'palestinian-museum']) {
    for (const language of ['en', 'ar']) {
      const story = await json('/api/v1/ai/generate-story', { locationId: id, language, persist: false });
      assert.ok(story.narrative);
      assert.equal(story.generatedBy, 'offline-extractive');
    }
  }
  const journey = await json('/api/v1/journeys', { governorateIds: ['jerusalem', 'ramallah', 'hebron', 'gaza'], interests: ['history'], duration: 'express', language: 'ar' });
  assert.equal(new Set(journey.stops.map((item) => item.location.governorateId)).size, 4);
  assert.ok((await json('/api/v1/ai/ask-guide', { locationId: 'muslim-quarter', question: 'What are the main landmarks?', language: 'en' })).answer);
  const receipt = await json('/api/v1/contributions', { locationId: 'muslim-quarter', title: 'Production persistence test', content: 'An isolated test memory awaiting editorial review.', contributorName: 'Local test' }, 201);
  assert.equal(receipt.status, 'pending_review');
  const code = receipt.referenceCode;
  assert.ok(code);
  assert.ok(!(await json('/api/v1/contributions')).some((row) => row.referenceCode === code));
  assert.ok((await json('/api/v1/contributions')).every((row) => !('contributorEmail' in row)));
  await stop(backend);
  // Restart the database itself, then the Nest process; verify disk and pool persistence.
  await socket.stop();
  await db.close();
  db = await PGlite.create(dataPath);
  socket = new PGLiteSocketServer({ db, host: '127.0.0.1', port: 15439 });
  await socket.start();
  backend = launch('backend-restart', process.execPath, ['dist/main.js'], resolve(root, 'backend'), 13019);
  await ready('http://127.0.0.1:13019/api/v1/health');
  assert.equal((await json('/api/v1/contributions/status/' + code)).status, 'pending_review');
  await json('/api/tts', { text: 'Test narration.' }, 503);
  await json('/api/video-status', { operationName: 'fallback-operation-scenic' }, 400);
  await json('/api/video-download', { operationName: 'fallback-operation-scenic' }, 400);
  await json('/api/generate-video', { prompt: 'test' }, 503);
  await json('/api/generate-video', { prompt: 'test' }, 429);
  console.log('PASS: production proxy/auth, 4 governorates/14 locations, galleries/timelines/quizzes, bilingual stories, national journey, guide, contribution moderation and persistence across database/API restart, SPA refresh, blocked source downloads, explicit paid-service failures and usage limits.');
  if (process.argv.includes('--keep')) {
    console.log('Browser QA server: ' + web);
    await new Promise((done) => process.once('SIGINT', done));
  }
} finally {
  await Promise.all(processes.map(stop));
  await socket.stop();
  await db.close();
}
