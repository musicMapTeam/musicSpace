// Card API of the room server: capture time, viewpoint and song validation, snapshots, records and the library.
// Starts server/index.js on a free port with a throw-away DATA_DIR and stops it again; set BASE=http://host:port/api/live to test a running server instead.
// Plain node:assert, no framework: `npm test` or `node scripts/test/api.test.mjs`.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));

const freePort = () => new Promise((resolve, reject) => {
  const probe = createServer();
  probe.on('error', reject);
  probe.listen(0, '127.0.0.1', () => { const { port } = probe.address(); probe.close(() => resolve(port)); });
});

async function startServer() {
  const port = await freePort();
  const dataDir = mkdtempSync(join(tmpdir(), 'music-space-api-'));
  const child = spawn(process.execPath, ['server/index.js'], { cwd: root, env: { ...process.env, HOST: '127.0.0.1', PORT: String(port), DATA_DIR: dataDir }, stdio: ['ignore', 'ignore', 'pipe'] });
  let log = '';
  child.stderr.on('data', chunk => { log += chunk; });
  const base = `http://127.0.0.1:${port}/api/live`;
  for (let attempt = 0; attempt < 100; attempt++) {
    if (child.exitCode !== null) throw new Error(`server exited early (${child.exitCode}): ${log}`);
    try { if ((await fetch(`${base}/health`)).ok) break; } catch { /* not listening yet */ }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  const stop = async () => {
    if (child.exitCode === null) { child.kill('SIGTERM'); await new Promise(resolve => child.once('exit', resolve)); }
    rmSync(dataDir, { recursive: true, force: true });
  };
  return { base, stop };
}

async function run(base) {
  async function call(path, { method = 'GET', body, token } = {}) {
    const res = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
    const json = await res.json().catch(() => null);
    return { status: res.status, json };
  }
  const a = (await call('/session', { method: 'POST', body: { name: 'Alice' } })).json;
  const b = (await call('/session', { method: 'POST', body: { name: 'Bob' } })).json;
  const room = (await call('/rooms', { method: 'POST', token: a.token, body: { title: '测试场', eventDate: '2026-09-26', city: '广州', song: '房间的歌' } })).json;
  const roomId = room.room.id;
  await call('/rooms/join', { method: 'POST', token: b.token, body: { code: room.room.code } });
  const put = (token, body) => call(`/rooms/${roomId}/card`, { method: 'PUT', token, body });
  const base0 = { photoKey: 'stage', perspective: 'stage', momentId: 'encore', caption: 'hi', trackId: '', isPublic: true };

  // legacy-style body (no new fields): still valid, fields default
  let r = await put(a.token, base0);
  assert.equal(r.status, 200, JSON.stringify(r.json));
  assert.deepEqual([r.json.ownCard.takenAt, r.json.ownCard.takenSource, r.json.ownCard.song, r.json.ownCard.perspective], [null, null, '', 'stage']);

  // new fields round trip
  const t = Date.parse('2026-09-26T21:47:10+08:00');
  r = await put(a.token, { ...base0, perspective: 'crowd', takenAt: t, takenSource: 'exif', song: '  晴天  ' });
  assert.equal(r.status, 200, JSON.stringify(r.json));
  assert.deepEqual([r.json.ownCard.takenAt, r.json.ownCard.takenSource, r.json.ownCard.song, r.json.ownCard.perspective], [t, 'exif', '晴天', 'crowd']);
  assert.equal(r.json.ownCard.revision, 2);

  // perspective '' means "none chosen" and stays ''
  r = await put(a.token, { ...base0, perspective: '', takenAt: t, takenSource: 'manual' });
  assert.equal(r.status, 200);
  assert.equal(r.json.ownCard.perspective, '');
  // missing perspective still means the example photo's side (old clients)
  r = await put(a.token, { photoKey: 'crowd', momentId: 'encore', caption: 'x', trackId: '', isPublic: true });
  assert.equal(r.json.ownCard.perspective, 'crowd');

  // rejections
  const bad = async (patch, needle) => {
    const res = await put(a.token, { ...base0, ...patch });
    assert.equal(res.status, 400, `${JSON.stringify(patch)} -> ${res.status} ${JSON.stringify(res.json)}`);
    assert.equal(res.json.error.code, 'INVALID_INPUT');
    if (needle) assert.match(res.json.error.message, needle);
  };
  await bad({ takenAt: 'abc', takenSource: 'exif' }, /拍摄时间/);
  await bad({ takenAt: '1758912430000', takenSource: 'exif' });
  await bad({ takenAt: Date.UTC(1999, 11, 31), takenSource: 'exif' }, /拍摄时间/);
  await bad({ takenAt: Date.now() + 2 * 86_400_000, takenSource: 'exif' }, /拍摄时间/);
  await bad({ takenAt: 1e20, takenSource: 'exif' });
  await bad({ takenAt: t, takenSource: 'gps' }, /来源/);
  await bad({ takenAt: t }, /来源/);
  await bad({ takenAt: t, takenSource: 'sample' }, /来源/);
  await bad({ song: 'a'.repeat(41) }, /40/);
  await bad({ song: 'x\u0000y' }, /字符/);
  await bad({ song: 'x\ny' }, /字符/);
  await bad({ song: 'x‮y' }, /字符/);
  await bad({ song: 42 });
  await bad({ perspective: 'sideways' });
  // within limits
  r = await put(a.token, { ...base0, song: '字'.repeat(40), takenAt: Date.now() + 3_600_000, takenSource: 'exif' });
  assert.equal(r.status, 200, JSON.stringify(r.json));
  assert.equal([...r.json.ownCard.song].length, 40);
  // a file's modification time is only a guess: a client that still sends one is not refused, but nothing approximate is stored
  r = await put(a.token, { ...base0, takenAt: t, takenSource: 'file' });
  assert.equal(r.status, 200, JSON.stringify(r.json));
  assert.deepEqual([r.json.ownCard.takenAt, r.json.ownCard.takenSource], [null, null]);
  r = await put(a.token, { ...base0, takenAt: 'not a time', takenSource: 'file' });
  assert.equal(r.status, 200, JSON.stringify(r.json));
  assert.deepEqual([r.json.ownCard.takenAt, r.json.ownCard.takenSource], [null, null]);
  r = await put(a.token, { ...base0, song: '   ', takenAt: null, takenSource: 'exif' });
  assert.equal(r.status, 200);
  assert.deepEqual([r.json.ownCard.song, r.json.ownCard.takenAt, r.json.ownCard.takenSource], ['', null, null]);

  // exchange snapshot + record carry the fields; the other member sees the public card
  await put(a.token, { ...base0, perspective: 'stage', takenAt: t, takenSource: 'exif', song: '晴天' });
  await put(b.token, { ...base0, perspective: 'crowd', takenAt: t + 60_000, takenSource: 'exif', song: '' });
  let state = (await call(`/rooms/${roomId}`, { token: b.token })).json;
  const aliceCard = state.cards.find(c => c.ownerName === 'Alice');
  assert.deepEqual([aliceCard.takenAt, aliceCard.song, aliceCard.perspective], [t, '晴天', 'stage']);
  const ex = await call(`/rooms/${roomId}/exchanges`, { method: 'POST', token: b.token, body: { toCardId: aliceCard.id, fromRevision: state.ownCard.revision, toRevision: aliceCard.revision } });
  assert.equal(ex.status, 201, JSON.stringify(ex.json));
  const exchange = ex.json.exchanges[0];
  assert.equal(exchange.toCard.takenAt, t);
  assert.equal(exchange.toCard.song, '晴天');
  assert.equal(exchange.fromCard.takenSource, 'exif');
  // editing the card afterwards does not rewrite the snapshot
  await put(a.token, { ...base0, perspective: 'stage', takenAt: t + 5 * 60_000, takenSource: 'manual', song: '别的歌' });
  const acc = await call(`/rooms/${roomId}/exchanges/${exchange.id}/decision`, { method: 'POST', token: a.token, body: { decision: 'accepted' } });
  assert.equal(acc.status, 200, JSON.stringify(acc.json));
  const rec = acc.json.records[0];
  assert.equal(rec.toCard.song, '晴天');
  assert.equal(rec.toCard.takenAt, t);
  assert.equal(rec.fromCard.takenAt, t + 60_000);
  const lib = (await call('/library', { token: b.token })).json;
  assert.equal(lib.records[0].toCard.song, '晴天');
  assert.equal(lib.cards[0].takenSource, 'exif');
  console.log('api: all assertions passed');
}

const external = process.env.BASE;
const server = external ? { base: external, stop: async () => {} } : await startServer();
try { await run(server.base); } finally { await server.stop(); }
