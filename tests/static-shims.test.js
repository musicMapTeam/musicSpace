// Parity of the in-browser crypto / Buffer shims (web/static-runtime/shims) with Node's own node:crypto and Buffer.
// The workers call hash() and Buffer inline and synchronously, so the browser build replaces node:crypto and node:buffer with these.
// Everything is randomised from one seed (STATIC_SHIMS_SEED=n to replay another); a failure message carries the inputs.
import test from 'node:test';
import assert from 'node:assert/strict';
import nodeCrypto from 'node:crypto';
import * as shimCrypto from '../web/static-runtime/shims/node-crypto.js';
import { Buffer as ShimBuffer } from '../web/static-runtime/shims/node-buffer.js';

const SEED = Number(process.env.STATIC_SHIMS_SEED ?? 20261005);
function prng(seed) {                       // mulberry32: small, fast, deterministic
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const random = prng(SEED);
const int = (max) => Math.floor(random() * max);
const bytes = length => { const out = new Uint8Array(length); for (let i = 0; i < length; i++) out[i] = int(256); return out; };
const hex = value => Buffer.from(value).toString('hex');
const ENCODINGS = ['hex', 'base64', 'base64url'];

test('sha256: every length 0-300 around the 64-byte block edges, three encodings', () => {
  for (let length = 0; length <= 300; length++) {
    const data = bytes(length);
    for (const encoding of ENCODINGS) {
      assert.equal(shimCrypto.createHash('sha256').update(data).digest(encoding), nodeCrypto.createHash('sha256').update(data).digest(encoding), `length ${length} ${encoding}`);
    }
  }
});

test('sha256: large inputs including 1.5 MB', () => {
  for (const length of [1000, 4095, 4096, 65535, 300000, 1_500_000]) {
    const data = bytes(length);
    assert.equal(shimCrypto.createHash('sha256').update(data).digest('hex'), nodeCrypto.createHash('sha256').update(data).digest('hex'), `length ${length}`);
  }
});

test('sha256: strings, multi-byte UTF-8 and edge lengths', () => {
  const samples = ['', 'abc', '同一刻，另一面', 'POST\n/rooms\n{"title":"夜场😀"}', '😀'.repeat(100), 'é'.repeat(129), '\u0000\u0001', 'a'.repeat(55), 'a'.repeat(56), 'a'.repeat(63), 'a'.repeat(64), 'a'.repeat(65), 'a'.repeat(119), 'a'.repeat(120)];
  for (const sample of samples) {
    for (const encoding of ENCODINGS) assert.equal(shimCrypto.createHash('sha256').update(sample).digest(encoding), nodeCrypto.createHash('sha256').update(sample).digest(encoding), JSON.stringify(sample.slice(0, 20)));
  }
});

test('sha256: chunked and mixed updates equal one update', () => {
  const data = bytes(1000);
  for (const step of [1, 7, 37, 63, 64, 65, 128, 999]) {
    const hash = shimCrypto.createHash('sha256');
    for (let i = 0; i < data.length; i += step) hash.update(data.subarray(i, i + step));
    assert.equal(hash.digest('hex'), nodeCrypto.createHash('sha256').update(data).digest('hex'), `step ${step}`);
  }
  const mixed = shimCrypto.createHash('sha256').update('héllo ').update(Buffer.from('wörld')).update(new Uint8Array([1, 2, 3])).update(new Uint8Array([4, 5]).buffer).digest('hex');
  assert.equal(mixed, nodeCrypto.createHash('sha256').update('héllo ').update(Buffer.from('wörld')).update(Uint8Array.of(1, 2, 3)).update(Uint8Array.of(4, 5)).digest('hex'));
});

test('hash and hmac: inputs by view bytes, string input encodings, bad types like Node', () => {
  const words = new Uint16Array([0x0102, 0x0304, 0xfffe]);
  const view = new DataView(new Uint8Array([9, 8, 7, 6, 5]).buffer, 1, 3);
  for (const input of [words, view, new Float32Array([1.5, -2]), Buffer.from('xyz'), new Uint8Array(0)]) {
    assert.equal(shimCrypto.createHash('sha256').update(input).digest('hex'), nodeCrypto.createHash('sha256').update(input).digest('hex'));
    assert.equal(shimCrypto.createHmac('sha256', input).update('m').digest('hex'), nodeCrypto.createHmac('sha256', input).update('m').digest('hex'));
  }
  for (const [text, inputEncoding] of [['00ff10', 'hex'], ['AAEC/w==', 'base64'], ['AAEC_w', 'base64url'], ['héllo', 'utf8'], ['héllo', undefined]]) {
    assert.equal(shimCrypto.createHash('sha256').update(text, inputEncoding).digest('hex'), nodeCrypto.createHash('sha256').update(text, inputEncoding).digest('hex'), `${inputEncoding}`);
  }
  for (const bad of [123, null, undefined, {}, [1, 2]]) {
    assert.throws(() => nodeCrypto.createHash('sha256').update(bad), { code: 'ERR_INVALID_ARG_TYPE' });
    assert.throws(() => shimCrypto.createHash('sha256').update(bad), { name: 'TypeError', code: 'ERR_INVALID_ARG_TYPE' });
  }
  assert.throws(() => shimCrypto.createHash('md5'), /Unsupported hash/);
  assert.throws(() => shimCrypto.createHmac('sha512', 'k'), /Unsupported hmac/);
  assert.equal(shimCrypto.createHash('SHA256').update('x').digest('hex'), nodeCrypto.createHash('sha256').update('x').digest('hex'));
});

test('digest() without an encoding is a Buffer of the same bytes; a second digest or a late update is refused like Node', () => {
  const data = bytes(77);
  const shim = shimCrypto.createHash('sha256').update(data).digest();
  assert.ok(ShimBuffer.isBuffer(shim), 'shim Buffer');
  assert.equal(shim.length, 32);
  assert.equal(hex(shim), nodeCrypto.createHash('sha256').update(data).digest('hex'));
  for (const make of [() => shimCrypto.createHash('sha256').update('a'), () => shimCrypto.createHmac('sha256', 'k').update('a')]) {
    const finished = make(); finished.digest('hex');
    assert.throws(() => finished.digest('hex'), { code: 'ERR_CRYPTO_HASH_FINALIZED' });
    assert.throws(() => finished.update('b'), { code: 'ERR_CRYPTO_HASH_FINALIZED' });
  }
  const real = nodeCrypto.createHash('sha256').update('a'); real.digest();
  assert.throws(() => real.digest(), { code: 'ERR_CRYPTO_HASH_FINALIZED' });
});

test('hmac-sha256: every key length 0-200 against three messages and three encodings', () => {
  const messages = ['', 'session\0bootstrap\0abc', '同一刻'.repeat(30), bytes(129)];
  for (let keyLength = 0; keyLength <= 200; keyLength++) {
    const key = bytes(keyLength);
    const message = messages[keyLength % messages.length];
    for (const encoding of ENCODINGS) {
      assert.equal(shimCrypto.createHmac('sha256', key).update(message).digest(encoding), nodeCrypto.createHmac('sha256', key).update(message).digest(encoding), `key ${keyLength} ${encoding}`);
    }
  }
  for (const message of messages) {
    for (const keyLength of [0, 1, 20, 32, 63, 64, 65, 200]) {
      const key = bytes(keyLength);
      assert.equal(shimCrypto.createHmac('sha256', key).update(message).digest('base64url'), nodeCrypto.createHmac('sha256', key).update(message).digest('base64url'));
    }
  }
});

test('hmac-sha256: string keys, shim Buffer keys from hex (as the avatar worker does), chunked updates, empty message', () => {
  const secret = nodeCrypto.randomBytes(32).toString('hex');
  assert.equal(shimCrypto.createHmac('sha256', ShimBuffer.from(secret, 'hex')).update('x').digest('base64url'), nodeCrypto.createHmac('sha256', Buffer.from(secret, 'hex')).update('x').digest('base64url'));
  assert.equal(shimCrypto.createHmac('sha256', 'a string key').update('m').digest('hex'), nodeCrypto.createHmac('sha256', 'a string key').update('m').digest('hex'));
  const data = bytes(500);
  const hmac = shimCrypto.createHmac('sha256', 'k');
  for (let i = 0; i < data.length; i += 61) hmac.update(data.subarray(i, i + 61));
  assert.equal(hmac.digest('hex'), nodeCrypto.createHmac('sha256', 'k').update(data).digest('hex'));
  assert.equal(shimCrypto.createHmac('sha256', 'k').digest('hex'), nodeCrypto.createHmac('sha256', 'k').digest('hex'));
});

test('sha256: hashing a photo-sized request body stays fast (the workers hash every request body inline)', () => {
  const body = bytes(420 * 1024);
  const started = performance.now();
  for (let i = 0; i < 5; i++) shimCrypto.createHash('sha256').update(body).digest('hex');
  assert.ok((performance.now() - started) / 5 < 80, 'about 5 ms on a desktop, far below 80 ms');
});

test('randomBytes: length, Buffer type, entropy, large sizes and invalid sizes', () => {
  for (const size of [0, 1, 12, 24, 32, 65535, 65536, 65537, 70000]) {
    const out = shimCrypto.randomBytes(size);
    assert.ok(ShimBuffer.isBuffer(out));
    assert.equal(out.length, size);
  }
  assert.equal(shimCrypto.randomBytes(24).toString('base64url').length, 32);
  assert.equal(shimCrypto.randomBytes(32).toString('hex').length, 64);
  assert.notEqual(shimCrypto.randomBytes(32).toString('hex'), shimCrypto.randomBytes(32).toString('hex'));
  assert.ok(new Set(shimCrypto.randomBytes(4096)).size > 200, 'bytes are not constant');
  for (const bad of [-1, 1.5, NaN, '8', undefined, 2 ** 31]) assert.throws(() => shimCrypto.randomBytes(bad), RangeError);
});

test('randomUUID: v4 shape and uniqueness, and the fallback when crypto.randomUUID is missing (insecure http page)', () => {
  const pattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
  const seen = new Set();
  for (let i = 0; i < 200; i++) { const id = shimCrypto.randomUUID(); assert.match(id, pattern); seen.add(id); }
  assert.equal(seen.size, 200);
  const original = Object.getOwnPropertyDescriptor(globalThis, 'crypto');
  try {
    Object.defineProperty(globalThis, 'crypto', { configurable: true, value: { getRandomValues: array => { array.fill(0xff); return array; } } });
    assert.equal(shimCrypto.randomUUID(), 'ffffffff-ffff-4fff-bfff-ffffffffffff', 'version and variant bits are forced');
    Object.defineProperty(globalThis, 'crypto', { configurable: true, value: { getRandomValues: array => { array.fill(0); return array; } } });
    assert.equal(shimCrypto.randomUUID(), '00000000-0000-4000-8000-000000000000');
  } finally { Object.defineProperty(globalThis, 'crypto', original); }
});

test('the default export carries the same four functions', () => {
  assert.deepEqual(Object.keys(shimCrypto.default).sort(), ['createHash', 'createHmac', 'randomBytes', 'randomUUID']);
  assert.equal(shimCrypto.default.createHash, shimCrypto.createHash);
});

// ---- Buffer -----------------------------------------------------------------------------------------------------------------------

test('Buffer: base64 / base64url / hex round trips for every length 0-199', () => {
  for (let length = 0; length < 200; length++) {
    const raw = Buffer.from(bytes(length));
    for (const encoding of ENCODINGS) {
      const text = raw.toString(encoding);
      assert.equal(ShimBuffer.from(raw).toString(encoding), text, `encode ${encoding} ${length}`);
      assert.equal(hex(ShimBuffer.from(text, encoding)), raw.toString('hex'), `decode ${encoding} ${length}`);
      assert.equal(ShimBuffer.byteLength(text, encoding), Buffer.byteLength(text, encoding), `byteLength ${encoding} ${length}`);
    }
  }
});

test('Buffer: decoding hostile and malformed strings matches Node (whitespace, stray characters, padding, case, odd hex)', () => {
  const alphabet = ['A', 'Q', 'z', '9', '+', '/', '-', '_', '=', '=', ' ', '\n', '\t', '!', '#', '中', '0', 'f', 'G', 'é', '😀', '䄰', '䄱', '倽'];   // the last three read as '0', '1' and '=' by their low byte
  for (let i = 0; i < 4000; i++) {
    const text = Array.from({ length: int(24) }, () => alphabet[int(alphabet.length)]).join('');
    for (const encoding of ENCODINGS) {
      assert.equal(hex(ShimBuffer.from(text, encoding)), hex(Buffer.from(text, encoding)), `${encoding} ${JSON.stringify(text)}`);
      assert.equal(ShimBuffer.byteLength(text, encoding), Buffer.byteLength(text, encoding), `byteLength ${encoding} ${JSON.stringify(text)}`);
    }
  }
  for (const text of ['QQ==QQ==', '=QUJD', 'QUJD=QUJD', 'QU==JD', 'QUJD====', '====', '1g', 'ab cd', 'ABcd', '0x12', 'a']) {
    for (const encoding of ENCODINGS) assert.equal(hex(ShimBuffer.from(text, encoding)), hex(Buffer.from(text, encoding)), `${encoding} ${JSON.stringify(text)}`);
  }
});

test('Buffer: utf8 in both directions, lone surrogates, a leading BOM is kept, invalid bytes become U+FFFD', () => {
  const samples = ['', 'abc', '同一刻，另一面', '😀', '\ud800', 'a\udc00b', 'é', '\u0000x', '﻿bom'];
  for (const text of samples) {
    assert.equal(hex(ShimBuffer.from(text)), hex(Buffer.from(text)), JSON.stringify(text));
    assert.equal(hex(ShimBuffer.from(text, 'utf-8')), hex(Buffer.from(text, 'utf-8')));
    assert.equal(ShimBuffer.byteLength(text), Buffer.byteLength(text), JSON.stringify(text));
    assert.equal(ShimBuffer.from(Buffer.from(text)).toString('utf8'), Buffer.from(text).toString('utf8'));
  }
  for (let i = 0; i < 2000; i++) {
    const raw = bytes(int(40));
    assert.equal(ShimBuffer.from(raw).toString(), Buffer.from(raw).toString(), `bytes ${hex(raw)}`);
  }
  assert.equal(ShimBuffer.from([0xef, 0xbb, 0xbf, 0x41]).toString(), '﻿A');
});

test('Buffer.toString(encoding, start, end) matches Node for random ranges', () => {
  for (let i = 0; i < 600; i++) {
    const raw = bytes(int(50));
    const start = random() < 0.2 ? undefined : int(60) - 5, end = random() < 0.2 ? undefined : int(60) - 5;
    for (const encoding of ['hex', 'base64', 'base64url', 'utf8']) {
      assert.equal(ShimBuffer.from(raw).toString(encoding, start, end), Buffer.from(raw).toString(encoding, start, end), `${encoding} ${start} ${end} len ${raw.length}`);
    }
  }
});

test('Buffer.from: arrays, typed arrays by element, views, ArrayBuffer sharing memory, errors', () => {
  assert.equal(hex(ShimBuffer.from([0xff, 0xd9, 256, -1, 3.7])), hex(Buffer.from([0xff, 0xd9, 256, -1, 3.7])));
  assert.equal(hex(ShimBuffer.from(new Uint16Array([1, 256, 258]))), hex(Buffer.from(new Uint16Array([1, 256, 258]))));
  const source = new Uint8Array([1, 2, 3, 4]);
  const copy = ShimBuffer.from(source); source[0] = 99;
  assert.equal(copy[0], 1, 'a typed array is copied');
  const dataView = new DataView(new Uint8Array([5, 6, 7, 8]).buffer, 1, 2);
  assert.equal(hex(ShimBuffer.from(dataView)), '0607', 'a DataView is copied by its bytes');
});

test('Buffer.from(arrayBuffer, offset, length) shares memory like Node', () => {
  const arrayBuffer = new Uint8Array([10, 20, 30, 40, 50]).buffer;
  const shim = ShimBuffer.from(arrayBuffer, 1, 3), real = Buffer.from(arrayBuffer, 1, 3);
  assert.equal(hex(shim), hex(real));
  new Uint8Array(arrayBuffer)[2] = 99;
  assert.equal(shim[1], 99);
  assert.equal(real[1], 99);
  assert.equal(shim.length, 3);
  assert.equal(hex(ShimBuffer.from(arrayBuffer)), hex(Buffer.from(arrayBuffer)));
  assert.throws(() => ShimBuffer.from(42), TypeError);
  assert.throws(() => ShimBuffer.from({}), TypeError);
  assert.throws(() => ShimBuffer.from('x', 'latin9'), { name: 'TypeError', code: 'ERR_UNKNOWN_ENCODING' });
});

test('Buffer.concat, alloc, isBuffer, equals, includes', () => {
  assert.equal(ShimBuffer.concat([ShimBuffer.from('同一'), ShimBuffer.from('刻')]).toString('utf8'), '同一刻');
  assert.equal(ShimBuffer.concat([]).length, 0);
  for (let i = 0; i < 300; i++) {
    const parts = Array.from({ length: int(5) }, () => bytes(int(20)));
    const total = random() < 0.5 ? undefined : int(80);
    assert.equal(hex(ShimBuffer.concat(parts.map(part => ShimBuffer.from(part)), total)), hex(Buffer.concat(parts.map(part => Buffer.from(part)), total)), `total ${total}`);
  }
  assert.equal(hex(ShimBuffer.concat([new Uint8Array([1, 2]), ShimBuffer.from([3])])), '010203', 'plain Uint8Array parts are accepted');
  assert.throws(() => ShimBuffer.concat('nope'), TypeError);
  assert.equal(hex(ShimBuffer.alloc(4)), '00000000');
  assert.equal(hex(ShimBuffer.alloc(3, 7)), '070707');
  assert.ok(ShimBuffer.isBuffer(ShimBuffer.alloc(1)) && !ShimBuffer.isBuffer(new Uint8Array(1)) && !ShimBuffer.isBuffer('x'));
  const a = ShimBuffer.from([1, 2, 3]);
  assert.ok(a.equals(ShimBuffer.from([1, 2, 3])) && a.equals(new Uint8Array([1, 2, 3])) && !a.equals(ShimBuffer.from([1, 2, 4])) && !a.equals(ShimBuffer.from([1, 2])));
  assert.throws(() => a.equals('123'), TypeError);
  const haystack = ShimBuffer.from([1, 2, 3, 4, 5, 6]);
  assert.ok(haystack.includes(ShimBuffer.from([3, 4])) && haystack.includes(6) && haystack.includes(Uint8Array.of(1)) && !haystack.includes(ShimBuffer.from([4, 3])) && !haystack.includes(7) && haystack.includes(ShimBuffer.alloc(0)));
  assert.ok(ShimBuffer.from('hello world').includes('o w') && !ShimBuffer.from('hello').includes('xyz'));
});

test('Buffer.subarray and slice return Buffers that are views; readUInt16BE / writeUInt16BE match Node', () => {
  const buffer = ShimBuffer.from([1, 2, 3, 4, 5]);
  for (const view of [buffer.subarray(1, 3), buffer.slice(1, 3)]) {
    assert.ok(view instanceof ShimBuffer);
    assert.equal(hex(view), '0203');
  }
  buffer.subarray(1, 3)[0] = 9; buffer.slice(2, 4)[0] = 8;
  assert.equal(hex(buffer), '0109080405', 'both are views of the same memory');
  assert.equal(ShimBuffer.concat([buffer.subarray(0, 2), ShimBuffer.from([9])]).toString('hex'), '010909');
  for (let i = 0; i < 200; i++) {
    const raw = bytes(int(8) + 2);
    const offset = int(raw.length + 2) - 1;
    const outcome = fn => { try { return fn(); } catch (error) { return error.constructor.name; } };
    assert.equal(outcome(() => ShimBuffer.from(raw).readUInt16BE(offset)), outcome(() => Buffer.from(raw).readUInt16BE(offset)), `read ${offset} of ${raw.length}`);
    const value = int(70000) - 100;
    const shim = ShimBuffer.alloc(raw.length), real = Buffer.alloc(raw.length);
    assert.equal(outcome(() => shim.writeUInt16BE(value, offset)), outcome(() => real.writeUInt16BE(value, offset)), `write ${value}@${offset}`);
    assert.equal(hex(shim), hex(real));
  }
  assert.equal(ShimBuffer.from([1, 2, 3, 4, 5]).readUInt16BE(1), 0x0203);
});

test('Buffer.byteLength of non-strings and strings in every encoding', () => {
  assert.equal(ShimBuffer.byteLength(new Uint8Array(7)), 7);
  assert.equal(ShimBuffer.byteLength(new ArrayBuffer(9)), 9);
  assert.equal(ShimBuffer.byteLength(ShimBuffer.alloc(3)), 3);
  assert.equal(ShimBuffer.byteLength('同一刻😀'), Buffer.byteLength('同一刻😀'));
  assert.equal(ShimBuffer.byteLength('abc', 'utf8'), 3);
});
