import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { createApp } from '../src/app.js';
const env = { GAME_ADMIN_USERNAME: 'test-admin', GAME_ADMIN_PASSWORD: 'test-only-password-'.repeat(4), GAME_PUBLIC_ORIGIN: 'https://game.example.test' };
const auth = 'Basic ' + Buffer.from(`${env.GAME_ADMIN_USERNAME}:${env.GAME_ADMIN_PASSWORD}`).toString('base64');
async function fixture(run, settings = env) {
  const children = [], spawns = []; let time = 100000000;
  const app = createApp({ env: settings, now: () => time,
    EvaluationModel: { getLatestEvaluationDate: async () => null },
    spawn: (...args) => { spawns.push(args); const child = new EventEmitter(); children.push(child); return child; } });
  const server = await new Promise(resolve => { const server = app.listen(0, '127.0.0.1', () => resolve(server)); });
  try { await run({ request: (path, options) => fetch(`http://127.0.0.1:${server.address().port}${path}`, options),
    children, spawns, advance: ms => time += ms }); }
  finally { await new Promise(resolve => server.close(resolve)); }
}
const write = { method: 'POST', headers: { Authorization: auth, Origin: env.GAME_PUBLIC_ORIGIN } };
test('public rankings remain available; admin page and manual execution require authentication', () => fixture(async ({request,spawns}) => {
  for (const path of ['/', '/api/health', '/api/rankings/latest']) assert.equal((await request(path)).status, 200);
  assert.equal((await request('/admin')).status, 401);
  assert.equal((await request('/api/run-evaluation', {method:'POST'})).status, 401);
  assert.equal(spawns.length, 0);
  assert.equal((await request('/admin', {headers:{Authorization:auth}})).status, 200);
}));
test('cross-origin and missing-origin requests never launch a job', () => fixture(async ({request,spawns}) => {
  for (const Origin of [undefined, 'https://attacker.example.test']) {
    assert.equal((await request('/api/run-evaluation',{method:'POST',headers:{Authorization:auth,...(Origin?{Origin}:{})}})).status,403);
  }
  assert.equal(spawns.length, 0);
}));
test('valid administrator launches fixed script, concurrency and cooldown are enforced', () => fixture(async ({request,spawns,children,advance}) => {
  assert.equal((await request('/api/run-evaluation',write)).status,200);
  assert.equal(spawns[0][0], process.execPath);
  assert.equal(spawns[0][1].length,1);
  assert.match(spawns[0][1][0], /collect-and-evaluate\.js$/);
  assert.equal((await request('/api/run-evaluation',write)).status,409);
  children[0].emit('exit',0);
  assert.equal((await request('/api/run-evaluation',write)).status,429);
  advance(600000);
  assert.equal((await request('/api/run-evaluation',write)).status,200);
  children[1].emit('error',new Error('synthetic'));
  assert.equal((await (await request('/api/evaluation-status')).json()).is_running,false);
}));
test('UTC daily count blocks repeated launches even after cooldown', () => fixture(async ({request,children,advance}) => {
  for(let i=0;i<10;i++) { assert.equal((await request('/api/run-evaluation',write)).status,200);children[i].emit('exit',0);advance(600000); }
  assert.equal((await request('/api/run-evaluation',write)).status,429);
}));

test('missing management configuration preserves public reading but fails closed for writes', () => fixture(async ({request,spawns}) => {
  assert.equal((await request('/api/health')).status,200);
  assert.equal((await request('/api/rankings/latest')).status,200);
  assert.equal((await request('/admin')).status,503);
  assert.equal((await request('/api/run-evaluation',write)).status,503);
  assert.equal(spawns.length,0);
}, {}));