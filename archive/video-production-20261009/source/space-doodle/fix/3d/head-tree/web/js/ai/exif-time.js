// Capture-time reader for a photo Blob/File: "when was this taken", read on the device before the picture is recompressed.
// ES module, no dependencies, no network. Project code (ported from the feasibility spike's exif-mini.js; only the exports, the
// header and the `wallMs` field differ). Nothing here uploads or stores anything: it reads a few bytes of the file you hand it.
//
//   import { readCaptureTime, fallbackTime } from './ai/exif-time.js';
//   const t = await readCaptureTime(file);     // null | { epochMs, wallMs, local, offset, offsetFrom, source, format, orientation, ms }
//   const guess = t ? null : fallbackTime(file); // last resort, always approximate
//
// It reads ONE window: blob.slice(0, 128 KB).arrayBuffer(). Only when a needed structure lies further out does it do more
// small, capped reads (<= 1 MB each, <= 64 segment/chunk/box hops): JPEG segments after big APPn blocks, the HEIC Exif item
// (libheif puts it at the END of the file), PNG/WebP chunks behind pixel data (WebP EXIF always follows the image). It never
// throws: a truncated, corrupt, out-of-range or unknown input gives null (a segment/chunk/extent that runs past EOF counts as
// truncated), and every loop is bounded.
//
// Formats : JPEG (every APP1 is tried: Exif vs XMP, several Exif segments), HEIC/HEIF/AVIF (ftyp > meta > iinf 'Exif' item >
//           iloc extent, base_offset, meta after mdat), PNG (eXIf), WebP (EXIF), bare TIFF (tif/dng/most RAW). Big and
//           little endian.
// Tags    : IFD0 > ExifIFD (0x8769) > DateTimeOriginal 0x9003, else DateTimeDigitized 0x9004, else IFD0 DateTime 0x0132
//           (+ SubSecTime* 0x9290-2 -> '.SSS', OffsetTime* 0x9010-2, Orientation 0x0112, GPS date/time via 0x8825).
//
// Result contract (null means "no usable capture time": stripped, blank, garbage or unknown format. That is normal for
// WeChat-compressed images, canvas re-encodes and most screenshots. A PNG "screenshot" may carry the time the screenshot was
// taken, so callers should distrust format === 'png'.)
//   local       'YYYY-MM-DDTHH:mm:ss[.SSS]' wall clock EXACTLY as stored. No timezone applied, NOT UTC: never pass it to
//               new Date() (that reads it in the runtime's zone). Blank / zero / out-of-range strings ('    :  :',
//               '0000:00:00 ...', Feb 30) count as missing.
//   offset      '+08:00' from OffsetTimeOriginal, else OffsetTimeDigitized, else OffsetTime; failing that inferred from the GPS
//               UTC stamp (local minus GPS time, rounded to 15 min, offsetFrom === 'GPS'; the fix can lag the shutter by
//               minutes and Android strips GPS from picker/MediaStore files); else null. offsetFrom names the tag, 'GPS' or null.
//   epochMs     the real instant (ms since 1970-01-01T00:00Z) = local - offset. NULL WHENEVER offset IS NULL: the photo says
//               what the clock on the camera read but not which zone that clock was set to (typical for DSLRs, cropped or
//               partly stripped files). Never guess a zone here.
//   wallMs      the wall clock in `local`, expressed as if it were UTC (ms, sub-second included). Never null when the result
//               is not null. Two photos taken in the same place can be compared by wallMs even when epochMs is null on one or
//               both, on the assumption that both cameras were set to the venue's zone. Prefer epochMs when BOTH cards have it.
//   source      which tag supplied `local`. 'DateTime' is the file's MODIFICATION time: weak evidence of the capture time.
//   orientation 1-8 or null.   format 'jpeg'|'heic'|'avif'|'png'|'webp'|'tiff'.   ms parse time including the Blob read.

const HEAD = 131072; // first read
const MAX = 1 << 20; // cap for any single extra read
const HOPS = 64; //     cap for segment / chunk / box walking

const asc = (v, p, n) => { let s = ''; while (n-- > 0) s += String.fromCharCode(v.getUint8(p++)); return s; };
const uint = (v, p, n) => { let x = 0; while (n-- > 0) x = x * 256 + v.getUint8(p++); return x; };
const sub = (v, k) => new DataView(v.buffer, v.byteOffset + k, v.byteLength - k);
const buf = (b) => (b.arrayBuffer ? b.arrayBuffer() : new Response(b).arrayBuffer()); // old WebViews lack Blob#arrayBuffer

// ---- containers: each async generator yields DataViews whose index 0 is (or precedes) a TIFF header ----------------------

async function* jpeg(get) { // marker segments up to SOS; every APP1 is a candidate (Exif and XMP both use APP1)
  for (let p = 2, i = 0; i < HOPS; i++) {
    const h = await get(p, 4), m = h.getUint8(1);
    if (h.getUint8(0) != 255 || m == 218 || m == 217) return; // lost sync / SOS / EOI
    if (m == 255) p++; //                                          fill byte
    else if (m == 1 || (m > 207 && m < 217)) p += 2; //            TEM, RSTn, SOI: no length
    else { const L = h.getUint16(2); if (m == 225) yield get(p + 4, L - 2, 1); p += 2 + L; }
  }
}

function box(v, p, end) { // ISO-BMFF box header at v[p] -> [type, bodyStart, nextBoxStart]; next <= p means corrupt size
  let n = v.getUint32(p), h = 8;
  if (n == 1) { n = uint(v, p + 8, 8); h = 16; } else if (!n) n = end - p; // 64-bit size / "extends to end of file"
  return [asc(v, p + 4, 4), p + h, n < h ? p : p + n];
}

function* boxes(v, p, end) { // child boxes of [p, end) -> [type, bodyStart, boxEnd]
  while (p + 8 <= end) {
    const [t, s, e] = box(v, p, end);
    if (e <= p) return;
    yield [t, s, Math.min(e, end)];
    p = e;
  }
}

async function* heic(get, size) {
  for (let p = 0, i = 0; p < size && i < HOPS; i++) { // top-level boxes: find 'meta' (may sit after a huge 'mdat')
    const [t, s, e] = box(await get(p, 16), 0, size - p);
    if (e <= 0) return;
    if (t != 'meta') { p += e; continue; }
    const m = await get(p + s + 4, e - s - 4, 1); // skip FullBox version/flags
    let id, loc;
    for (const [t, s, e] of boxes(m, 0, m.byteLength)) {
      if (t == 'iloc') loc = s;
      if (t == 'iinf') // entries: infe v2/v3 = [ver|flags 4][item_ID 2|4][protection 2]['Exif' type 4]
        for (const [t2, s2] of boxes(m, s + (m.getUint8(s) ? 8 : 6), e)) {
          const v = m.getUint8(s2), w = v == 3 ? 4 : 2;
          if (t2 == 'infe' && v > 1 && id == null && asc(m, s2 + 6 + w, 4) == 'Exif') id = uint(m, s2 + 4, w); // FIRST Exif item = primary image's
        }
    }
    if (id == null || loc == null) return;
    let q = loc; const rd = (k) => { const x = uint(m, q, k); q += k; return x; };
    const ver = rd(1), a = (q += 3, rd(1)), b = rd(1), w = ver < 2 ? 2 : 4; // iloc: field widths
    for (let c = rd(w); c-- > 0;) {
      const iid = rd(w), cm = ver ? rd(2) & 15 : 0; // construction_method 0 = absolute file offset
      rd(2); // data_reference_index
      const base = rd(b >> 4);
      for (let k = rd(2), x = 0; x < k; x++) {
        if (ver && b & 15) rd(b & 15); // extent_index
        const o = rd(a >> 4), l = rd(a & 15);
        if (iid == id && x == 0 && !cm) { const d = await get(base + o, l, 1); yield sub(d, 4 + d.getUint32(0)); return; }
      }
    }
    return;
  }
}

async function* png(get, size) { // length | type | data | crc
  for (let p = 8, i = 0; p < size && i < HOPS; i++) {
    const h = await get(p, 8), n = h.getUint32(0);
    if (asc(h, 4, 4) == 'eXIf') { yield get(p + 8, n, 1); return; }
    p += 12 + n;
  }
}

async function* webp(get, size) { // RIFF chunks; EXIF comes AFTER the image data, so this hops over big chunks
  for (let p = 12, i = 0; p < size && i < HOPS; i++) {
    const h = await get(p, 8), n = h.getUint32(4, true);
    if (asc(h, 0, 4) == 'EXIF') { yield get(p + 8, n, 1); return; }
    p += 8 + n + (n & 1);
  }
}

// ---- TIFF/Exif block -> result (or undefined) --------------------------------------------------------------------------

const DATE = /^(\d{4})\D(\d\d)\D(\d\d)\D(\d\d)\D(\d\d)\D(\d\d)/; // tolerates 2024-05-01 20:15:30 and trailing junk
const OFFS = /^([+-])(\d\d):?(\d\d)$/;

function tiff(v) {
  if (asc(v, 0, 4) == 'Exif') v = sub(v, 6); // 'Exif\0\0' prefix (JPEG APP1, sloppy PNG/WebP writers)
  const le = v.getUint16(0) == 0x4949;
  if (!le && v.getUint16(0) != 0x4d4d || v.getUint16(2, le) != 42) return; // not TIFF (e.g. an XMP APP1)
  const u16 = (p) => v.getUint16(p, le), u32 = (p) => v.getUint32(p, le);
  const ifd = (o) => { const t = {}; try { for (let i = 0, n = u16(o); i < n && i < 512; i++) t[u16(o + 2 + 12 * i)] = o + 2 + 12 * i; } catch (e) { } return t; };
  const val = (t, tag, f, d) => { try { return t[tag] ? f(t[tag]) : d; } catch (e) { return d; } }; // missing/out-of-range -> default
  const str = (t, tag) => val(t, tag, (e) => { const n = u32(e + 4); return asc(v, n > 4 ? u32(e + 8) : e + 8, Math.min(n, 64)).split('\0')[0].trim(); }, '');
  const num = (t, tag) => val(t, tag, (e) => u16(e + 8), 0); // SHORT
  const ptr = (t, tag) => val(t, tag, (e) => u32(e + 8), -1); // LONG: sub-IFD / value offset
  const i0 = ifd(u32(4)), ex = ifd(ptr(i0, 0x8769));

  for (const [source, t, tag, ss] of [['DateTimeOriginal', ex, 0x9003, 0x9291], ['DateTimeDigitized', ex, 0x9004, 0x9292], ['DateTime', i0, 0x132, 0x9290]]) {
    const m = DATE.exec(str(t, tag));
    if (!m) continue;
    const local = `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}`;
    let wall = Date.UTC(m[1], m[2] - 1, m[3], m[4], m[5], m[6]);
    if (new Date(wall).toISOString().slice(0, 19) != local) continue; // 0000:00:00, month 13, Feb 30, 25:61:61 ...
    const frac = /^\d+/.exec(str(ex, ss)); // SubSecTime: digits of a fraction of a second
    const sfx = frac ? '.' + (frac[0] + '00').slice(0, 3) : '';
    wall += frac ? +sfx.slice(1) : 0;

    let off = null, offsetFrom = null, mins = 0;
    for (const [name, tg] of [['OffsetTimeOriginal', 0x9011], ['OffsetTimeDigitized', 0x9012], ['OffsetTime', 0x9010]]) {
      const o = OFFS.exec(str(ex, tg));
      if (!o) continue;
      const k = (o[1] == '-' ? -1 : 1) * (o[2] * 60 + +o[3]);
      if (o[3] < 60 && k >= -720 && k <= 840) { mins = k; offsetFrom = name; break; }
    }
    if (!offsetFrom) { // no OffsetTime*: local minus GPS UTC, rounded to 15 min
      try {
        const gps = ifd(ptr(i0, 0x8825)), d = /^(\d{4}):(\d\d):(\d\d)/.exec(str(gps, 0x1d)), r = ptr(gps, 7); // r = -1 if absent -> u32() throws
        const q = (i) => u32(r + 8 * i) / u32(r + 8 * i + 4);
        const k = Math.round((wall - Date.UTC(d[1], d[2] - 1, d[3], q(0), q(1), q(2))) / 9e5) * 15;
        if (k >= -720 && k <= 840) { mins = k; offsetFrom = 'GPS'; }
      } catch (e) { }
    }
    if (offsetFrom) off = (mins < 0 ? '-' : '+') + String(Math.trunc(Math.abs(mins) / 60)).padStart(2, '0') + ':' + String(Math.abs(mins) % 60).padStart(2, '0');
    const or = num(i0, 0x112);
    return {
      local: local + sfx, offset: off, epochMs: off ? wall - mins * 6e4 : null, wallMs: wall, source,
      orientation: or > 0 && or < 9 ? or : null, offsetFrom,
    };
  }
}

// ---- entry points ------------------------------------------------------------------------------------------------------

/** Read the capture time of a photo File/Blob. Resolves null when the file carries no usable one; never rejects. */
export async function readCaptureTime(file) {
  const t0 = performance.now();
  try {
    const size = file.size, head = await buf(file.slice(0, HEAD));
    const get = async (p, n, whole) => { // DataView over file bytes [p, p+n), clipped to the file and to MAX; index 0 === offset p
      if (whole && p + n > size) throw 0; // a declared segment/chunk/extent that runs past EOF = truncated file
      n = Math.min(n, MAX, size - p);
      if (!(n > 0 && p >= 0)) throw 0;
      return p + n <= head.byteLength ? new DataView(head, p, n) : new DataView(await buf(file.slice(p, p + n)));
    };
    const h = await get(0, 12), w = h.getUint16(0);
    const [format, walk] =
      w == 0xffd8 ? ['jpeg', jpeg] :
      asc(h, 4, 4) == 'ftyp' ? [asc(h, 8, 3) == 'avi' ? 'avif' : 'heic', heic] :
      h.getUint32(0) == 0x89504e47 ? ['png', png] :
      asc(h, 0, 4) == 'RIFF' && asc(h, 8, 4) == 'WEBP' ? ['webp', webp] :
      w == 0x4949 || w == 0x4d4d ? ['tiff', async function* (g) { yield g(0, HEAD); }] : [];
    if (walk) for await (const v of walk(get, size)) {
      let r; try { r = tiff(v); } catch (e) { } // a broken candidate must not hide a later one
      if (r) return { ...r, format, ms: +(performance.now() - t0).toFixed(2) };
    }
  } catch (e) { /* truncated / corrupt / unreadable: fall through */ }
  return null;
}

/**
 * Last resort ONLY. File.lastModified is the file's mtime as the OS/picker reports it: on Android usually the save/download/
 * edit time, on iOS often the picker's export time (~ "now"), on desktop the copy/export time. It is NOT the capture time,
 * and its wall clock is rendered in the DEVICE's current zone. Callers must present it as approximate and let people
 * confirm or ignore it; do not match two cards on it. Returns null when the file has no usable lastModified.
 */
export function fallbackTime(file) {
  const ms = file && file.lastModified;
  if (!(ms > 0 && ms < 8.6e15)) return null;
  const min = -new Date(ms).getTimezoneOffset(), a = Math.abs(min);
  return {
    local: new Date(ms + min * 6e4).toISOString().slice(0, 19), // device-local wall clock
    offset: (min < 0 ? '-' : '+') + String(Math.trunc(a / 60)).padStart(2, '0') + ':' + String(a % 60).padStart(2, '0'),
    epochMs: ms, wallMs: ms + min * 6e4, source: 'lastModified', orientation: null, format: null, offsetFrom: 'device', approximate: true,
  };
}
