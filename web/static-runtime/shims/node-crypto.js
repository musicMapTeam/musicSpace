/**
 * The slice of node:crypto that runtime-preview/src uses, synchronous like Node's: createHash('sha256'), createHmac('sha256'),
 * randomBytes, randomUUID. Used only by the in-browser build (Vite alias for 'node:crypto').
 * SHA-256 is implemented here because Web Crypto is asynchronous and the workers call hash() inline. Verified against Node's crypto in
 * tests/static-shims.test.js (lengths 0-300 around the block edges, 1.5 MB, multi-byte UTF-8, HMAC keys 0-200 bytes, every encoding).
 * Like Node: update(string | Buffer | typed array | ArrayBuffer[, inputEncoding]) chains, digest([encoding]) returns a Buffer without an
 * encoding, and a hash or hmac cannot be updated or digested again after digest().
 */
import { Buffer } from './node-buffer.js';

const K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);
const encoder = new TextEncoder();
function invalidType(name) {
  const error = new TypeError(`The "${name}" argument must be of type string or an instance of Buffer, TypedArray, DataView or ArrayBuffer.`);
  error.code = 'ERR_INVALID_ARG_TYPE';
  return error;
}
function bytesOf(data, name = 'data', encoding) {
  if (typeof data === 'string') return encoding && String(encoding).toLowerCase() !== 'utf8' && String(encoding).toLowerCase() !== 'utf-8' ? Buffer.from(data, encoding) : encoder.encode(data);
  if (data instanceof Uint8Array) return data;
  if (ArrayBuffer.isView(data)) return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
  if (data instanceof ArrayBuffer) return new Uint8Array(data);
  throw invalidType(name);
}
function finalised() {
  const error = new Error('Digest already called');
  error.code = 'ERR_CRYPTO_HASH_FINALIZED';
  return error;
}

class Sha256 {
  constructor() { this.h = new Uint32Array([0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]); this.block = new Uint8Array(64); this.fill = 0; this.total = 0; this.w = new Uint32Array(64); }
  compress(view) {
    const { h, w } = this;
    for (let i = 0; i < 16; i++) w[i] = (view[i * 4] << 24) | (view[i * 4 + 1] << 16) | (view[i * 4 + 2] << 8) | view[i * 4 + 3];
    for (let i = 16; i < 64; i++) {
      const a = w[i - 15], b = w[i - 2];
      const s0 = ((a >>> 7) | (a << 25)) ^ ((a >>> 18) | (a << 14)) ^ (a >>> 3);
      const s1 = ((b >>> 17) | (b << 15)) ^ ((b >>> 19) | (b << 13)) ^ (b >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0;
    }
    let [a, b, c, d, e, f, g, hh] = h;
    for (let i = 0; i < 64; i++) {
      const S1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7));
      const ch = (e & f) ^ (~e & g);
      const t1 = (hh + S1 + ch + K[i] + w[i]) | 0;
      const S0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10));
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (S0 + maj) | 0;
      hh = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
    }
    h[0] = (h[0] + a) | 0; h[1] = (h[1] + b) | 0; h[2] = (h[2] + c) | 0; h[3] = (h[3] + d) | 0;
    h[4] = (h[4] + e) | 0; h[5] = (h[5] + f) | 0; h[6] = (h[6] + g) | 0; h[7] = (h[7] + hh) | 0;
  }
  update(data) {
    const bytes = bytesOf(data); this.total += bytes.length;
    let offset = 0;
    if (this.fill) {
      const take = Math.min(64 - this.fill, bytes.length);
      this.block.set(bytes.subarray(0, take), this.fill); this.fill += take; offset = take;
      if (this.fill === 64) { this.compress(this.block); this.fill = 0; }
    }
    for (; offset + 64 <= bytes.length; offset += 64) this.compress(bytes.subarray(offset, offset + 64));
    if (offset < bytes.length) { this.block.set(bytes.subarray(offset), 0); this.fill = bytes.length - offset; }
    return this;
  }
  digestBytes() {
    const bits = this.total * 8, pad = new Uint8Array(((this.fill < 56 ? 56 : 120) - this.fill) + 8);
    pad[0] = 0x80;
    const view = new DataView(pad.buffer);
    view.setUint32(pad.length - 8, Math.floor(bits / 0x100000000)); view.setUint32(pad.length - 4, bits >>> 0);
    const total = this.total; this.update(pad); this.total = total;
    const out = new Uint8Array(32), dv = new DataView(out.buffer);
    for (let i = 0; i < 8; i++) dv.setUint32(i * 4, this.h[i]);
    return out;
  }
}
const finish = (bytes, encoding) => { const buffer = Buffer.from(bytes); return encoding ? buffer.toString(encoding) : buffer; };

function checkAlgorithm(algorithm, what) {
  if (String(algorithm).toLowerCase() !== 'sha256') throw new Error(`Unsupported ${what}: ${algorithm}`);
}
export function createHash(algorithm) {
  checkAlgorithm(algorithm, 'hash');
  const sha = new Sha256();
  let done = false;
  return {
    update(data, inputEncoding) { if (done) throw finalised(); sha.update(bytesOf(data, 'data', inputEncoding)); return this; },
    digest(encoding) { if (done) throw finalised(); done = true; return finish(sha.digestBytes(), encoding); },
  };
}
export function createHmac(algorithm, key) {
  checkAlgorithm(algorithm, 'hmac');
  let secret = bytesOf(key, 'key');
  if (secret.length > 64) secret = new Sha256().update(secret).digestBytes();
  const inner = new Uint8Array(64), outer = new Uint8Array(64);
  for (let i = 0; i < 64; i++) { const byte = secret[i] ?? 0; inner[i] = byte ^ 0x36; outer[i] = byte ^ 0x5c; }
  const sha = new Sha256().update(inner);
  let done = false;
  return {
    update(data, inputEncoding) { if (done) throw finalised(); sha.update(bytesOf(data, 'data', inputEncoding)); return this; },
    digest(encoding) { if (done) throw finalised(); done = true; return finish(new Sha256().update(outer).update(sha.digestBytes()).digestBytes(), encoding); },
  };
}
export function randomBytes(size) {
  if (!Number.isInteger(size) || size < 0 || size > 0x7fffffff) throw new RangeError('The value of "size" is out of range. It must be an integer >= 0 and <= 2147483647.');
  const out = Buffer.alloc(size);
  for (let offset = 0; offset < size; offset += 65536) globalThis.crypto.getRandomValues(out.subarray(offset, Math.min(size, offset + 65536)));
  return out;
}
export function randomUUID() {
  if (typeof globalThis.crypto?.randomUUID === 'function') return globalThis.crypto.randomUUID();
  const b = randomBytes(16); b[6] = (b[6] & 0x0f) | 0x40; b[8] = (b[8] & 0x3f) | 0x80;
  const h = b.toString('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}
export default { createHash, createHmac, randomBytes, randomUUID };
