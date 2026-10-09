/**
 * R2-compatible PHOTOS binding over a store with the idb-store surface: put(key, bytes, options), get(key) -> { body } | null,
 * delete(key). The bytes live in the 'blobs' object store. `body` is a Uint8Array, which `new Response(body)` accepts and which has no
 * cancel(), exactly what the workers' `object.body?.cancel?.()` tolerates. Options (httpMetadata) are accepted and ignored: every
 * object here is a sanitised JPEG and the workers set the response content type themselves.
 */
const encoder = new TextEncoder();

function toBytes(value) {
  if (typeof value === 'string') return encoder.encode(value);
  if (value instanceof ArrayBuffer) return new Uint8Array(value.slice(0));
  if (ArrayBuffer.isView(value)) return new Uint8Array(value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength));
  throw new TypeError('PHOTOS.put expects a string, an ArrayBuffer or a typed array.');
}

export function createPhotos(storage) {
  return {
    // The copy keeps the caller's (shim Buffer, shared-ArrayBuffer-backed) bytes from changing what is stored.
    async put(key, bytes) { await storage.put('blobs', key, toBytes(bytes)); },
    async get(key) { const bytes = await storage.get('blobs', key); return bytes ? { body: bytes } : null; },
    async delete(key) { await storage.delete('blobs', key); },
  };
}
