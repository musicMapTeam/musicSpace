/**
 * The slice of Node's Buffer that runtime-preview/src uses, as a Uint8Array subclass. Used only by the in-browser build (Vite alias for
 * 'node:buffer'); Node keeps its own Buffer. Parity with Node is checked by tests/static-shims.test.js (randomised, every encoding).
 *
 * Supported:
 *   Buffer.from(string | array | Uint8Array/typed array/Buffer | ArrayBuffer[, byteOffset, length], 'utf8' | 'base64' | 'base64url' | 'hex')
 *   Buffer.alloc(size[, fill]), Buffer.concat(list[, total]), Buffer.byteLength(value[, encoding]), Buffer.isBuffer(value)
 *   buf.toString(encoding, start, end), readUInt16BE, writeUInt16BE, equals, includes, subarray / slice (both views, both Buffers)
 * Decoding follows Node: base64 accepts both alphabets, skips whitespace and stray characters, stops at the first '=' and (a Node quirk)
 * looks only at the low byte of each UTF-16 code unit; hex stops at the first invalid pair (also by the low byte); utf8 keeps a leading BOM and replaces
 * invalid sequences with U+FFFD.
 */
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const B64URL = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
const REVERSE = new Int16Array(256).fill(-1);
for (let i = 0; i < 64; i++) { REVERSE[B64.charCodeAt(i)] = i; REVERSE[B64URL.charCodeAt(i)] = i; }
const HEX = Array.from({ length: 256 }, (_, i) => i.toString(16).padStart(2, '0'));
const encoder = new TextEncoder();
const decoder = new TextDecoder('utf-8', { ignoreBOM: true });      // ignoreBOM: true KEEPS the BOM in the output, like Buffer#toString

function unknownEncoding(encoding) {
  const error = new TypeError(`Unknown encoding: ${encoding}`);
  error.code = 'ERR_UNKNOWN_ENCODING';
  return error;
}
const normalise = encoding => {
  const e = encoding === undefined || encoding === null ? 'utf8' : String(encoding).toLowerCase();
  if (e === 'utf8' || e === 'utf-8') return 'utf8';
  if (e === 'base64' || e === 'base64url' || e === 'hex') return e;
  throw unknownEncoding(encoding);
};
const hexValue = code => (code >= 48 && code <= 57 ? code - 48 : code >= 97 && code <= 102 ? code - 87 : code >= 65 && code <= 70 ? code - 55 : -1);

function decodeBase64(text) {
  const out = new Uint8Array((text.length * 3) >>> 2);
  let accumulator = 0, bits = 0, index = 0;
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i) & 255;                            // Node reads only the low byte of each UTF-16 code unit
    if (code === 61) break;                                           // '=' ends the data
    const value = REVERSE[code];
    if (value < 0) continue;                                          // whitespace and stray characters are skipped
    accumulator = (accumulator << 6) | value; bits += 6;
    if (bits >= 8) { bits -= 8; out[index++] = (accumulator >> bits) & 255; }
  }
  return index === out.length ? out : out.subarray(0, index);
}
function encodeBase64(bytes, start, end, alphabet, pad) {
  let out = '';
  for (let i = start; i < end; i += 3) {
    const a = bytes[i], b = i + 1 < end ? bytes[i + 1] : 0, c = i + 2 < end ? bytes[i + 2] : 0;
    out += alphabet[a >> 2] + alphabet[((a & 3) << 4) | (b >> 4)];
    out += i + 1 < end ? alphabet[((b & 15) << 2) | (c >> 6)] : (pad ? '=' : '');
    out += i + 2 < end ? alphabet[c & 63] : (pad ? '=' : '');
  }
  return out;
}
function decodeHex(text) {
  const bytes = new Uint8Array(text.length >>> 1);
  let length = 0;
  for (; length < bytes.length; length++) {
    const high = hexValue(text.charCodeAt(length * 2) & 255), low = hexValue(text.charCodeAt(length * 2 + 1) & 255);
    if (high < 0 || low < 0) break;                                   // Node stops at the first invalid pair
    bytes[length] = (high << 4) | low;
  }
  return length === bytes.length ? bytes : bytes.subarray(0, length);
}
function utf8Length(text) {
  let length = 0;
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (code < 0x80) length += 1;
    else if (code < 0x800) length += 2;
    else if (code >= 0xd800 && code <= 0xdbff && i + 1 < text.length && (text.charCodeAt(i + 1) & 0xfc00) === 0xdc00) { length += 4; i++; }
    else length += 3;                                                 // BMP character, or a lone surrogate (encoded as U+FFFD)
  }
  return length;
}
const bounded = (value, fallback, max) => {
  if (value === undefined) return fallback;
  const n = Math.trunc(Number(value)) || 0;
  return n < 0 ? 0 : n > max ? max : n;
};

export class Buffer extends Uint8Array {
  static from(value, encodingOrOffset, length) {
    if (typeof value === 'string') {
      const encoding = normalise(encodingOrOffset);
      const bytes = encoding === 'base64' || encoding === 'base64url' ? decodeBase64(value) : encoding === 'hex' ? decodeHex(value) : encoder.encode(value);
      return new Buffer(bytes.buffer, bytes.byteOffset, bytes.length);
    }
    if (value instanceof ArrayBuffer || (typeof SharedArrayBuffer === 'function' && value instanceof SharedArrayBuffer)) {
      const offset = encodingOrOffset === undefined ? 0 : Number(encodingOrOffset);
      return new Buffer(value, offset, length === undefined ? undefined : Number(length));      // shares memory, like Node
    }
    if (value instanceof Uint8Array) { const copy = new Buffer(value.length); copy.set(value); return copy; }
    if (ArrayBuffer.isView(value) && !(value instanceof DataView) || Array.isArray(value)) { const copy = new Buffer(value.length); copy.set(value); return copy; }
    if (ArrayBuffer.isView(value)) { const copy = new Buffer(value.byteLength); copy.set(new Uint8Array(value.buffer, value.byteOffset, value.byteLength)); return copy; }
    throw new TypeError('The first argument must be a string, an array, an ArrayBuffer or a typed array.');
  }
  static alloc(size, fill) { const out = new Buffer(size); if (fill !== undefined) out.fill(fill); return out; }
  static concat(list, total) {
    if (!Array.isArray(list)) throw new TypeError('The "list" argument must be an Array of Buffers or Uint8Arrays.');
    if (!list.length) return new Buffer(0);
    const length = total === undefined ? list.reduce((sum, part) => sum + part.length, 0) : total;
    const out = new Buffer(length);
    let offset = 0;
    for (const part of list) {
      if (offset >= length) break;
      const chunk = part.length > length - offset ? part.subarray(0, length - offset) : part;
      out.set(chunk, offset); offset += chunk.length;
    }
    return out;
  }
  static byteLength(value, encoding) {
    if (typeof value !== 'string') return value.byteLength;
    const e = normalise(encoding);
    if (e === 'hex') return value.length >>> 1;
    if (e === 'base64' || e === 'base64url') {                        // Node's estimate: padding is counted off the length, not the data
      let n = value.length;
      if (value.charCodeAt(n - 1) === 61) n--;
      if (n > 1 && value.charCodeAt(n - 1) === 61) n--;
      return (n * 3) >>> 2;
    }
    return utf8Length(value);
  }
  static isBuffer(value) { return value instanceof Buffer; }

  toString(encoding, start, end) {
    const e = normalise(encoding);
    const from = bounded(start, 0, this.length), to = bounded(end, this.length, this.length);
    if (to <= from) return '';
    if (e === 'base64') return encodeBase64(this, from, to, B64, true);
    if (e === 'base64url') return encodeBase64(this, from, to, B64URL, false);
    if (e === 'hex') { let out = ''; for (let i = from; i < to; i++) out += HEX[this[i]]; return out; }
    return decoder.decode(from === 0 && to === this.length ? this : this.subarray(from, to));
  }
  readUInt16BE(offset = 0) {
    if (!Number.isInteger(offset) || offset < 0 || offset + 2 > this.length) throw new RangeError('The value of "offset" is out of range.');
    return (this[offset] << 8) | this[offset + 1];
  }
  writeUInt16BE(value, offset = 0) {
    if (!Number.isInteger(offset) || offset < 0 || offset + 2 > this.length) throw new RangeError('The value of "offset" is out of range.');
    if (!Number.isInteger(value) || value < 0 || value > 0xffff) throw new RangeError('The value of "value" is out of range.');
    this[offset] = value >> 8; this[offset + 1] = value & 255;
    return offset + 2;
  }
  equals(other) {
    if (!(other instanceof Uint8Array)) throw new TypeError('The "otherBuffer" argument must be an instance of Buffer or Uint8Array.');
    if (this.length !== other.length) return false;
    for (let i = 0; i < this.length; i++) if (this[i] !== other[i]) return false;
    return true;
  }
  includes(needle) {
    if (typeof needle === 'number') return super.includes(needle & 255);
    const bytes = typeof needle === 'string' ? encoder.encode(needle) : needle;
    outer: for (let i = 0; i + bytes.length <= this.length; i++) { for (let j = 0; j < bytes.length; j++) if (this[i + j] !== bytes[j]) continue outer; return true; }
    return bytes.length === 0;
  }
  /** Like Node (and unlike Uint8Array.prototype.slice) a view onto the same memory. */
  slice(start, end) { return this.subarray(start, end); }
}
export default { Buffer };
