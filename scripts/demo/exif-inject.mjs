// Writes an Exif APP1 segment (DateTimeOriginal + OffsetTimeOriginal) into a JPEG that has no capture time. Used once, by
// build-demo-photos.mjs, to stamp the two bundled sample photos with their (fictional) capture time, so the on-device reader
// (web/js/ai/exif-time.js) has real bytes to parse. Node only (Buffer); nothing here is bundled into the site.
//
// Layout written (big endian): SOI | [JFIF APP0] | APP1 'Exif\0\0' + TIFF | the rest of the file, untouched.
//   TIFF  0 header 'MM' 42 -> IFD0 at 8
//         8 IFD0      1 entry: 0x8769 ExifIFD pointer -> 26                         (next IFD: none)
//        26 ExifIFD   2 entries: 0x9003 DateTimeOriginal (20 bytes, at 56), 0x9011 OffsetTimeOriginal (7 bytes, at 76)
//        56 'YYYY:MM:DD HH:MM:SS\0'   76 '+08:00\0' (+ one pad byte)
// macOS sips already writes an Exif APP1 of its own (ColorSpace and pixel size, no time). It stays where it is, BEHIND the stamped one:
// the reader tries every APP1 in order, and these are the exact bytes whose AI result was measured on 2026-10-05.
// The image data is never decoded or re-encoded: a stamped file differs from the encoder's output by that one segment, which
// stripCaptureTime() removes again (manifest.json's pixelSha256 is the hash of the file without it).

const TIME = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2}):(\d{2})$/;
const OFFSET = /^[+-]\d{2}:\d{2}$/;
const TIME_TEXT = /\d{4}:\d{2}:\d{2} \d{2}:\d{2}:\d{2}\0/;      // how an Exif ASCII date-time reads inside a segment
const EXIF_HEADER = Buffer.from('Exif\0\0', 'latin1');

const SOI = 0xd8, SOS = 0xda, APP0 = 0xe0, APP1 = 0xe1;

/** Marker segments up to the first scan: { marker, start, end } with end exclusive; start points at the 0xFF of the marker. */
function* segments(jpeg) {
  if (jpeg.length < 4 || jpeg[0] !== 0xff || jpeg[1] !== SOI) throw new Error('not a JPEG');
  let at = 2;
  while (at + 4 <= jpeg.length) {
    if (jpeg[at] !== 0xff) throw new Error(`JPEG marker expected at byte ${at}`);
    const marker = jpeg[at + 1];
    if (marker === 0xff) { at += 1; continue; }                     // fill byte
    const end = at + 2 + jpeg.readUInt16BE(at + 2);
    if (end > jpeg.length) throw new Error('truncated JPEG segment');
    yield { marker, start: at, end };
    if (marker === SOS) return;
    at = end;
  }
}
const isExif = (jpeg, { marker, start }) => marker === APP1 && jpeg.subarray(start + 4, start + 4 + EXIF_HEADER.length).equals(EXIF_HEADER);
/** An Exif segment that holds a date-time string, i.e. one a stamp (or a camera) wrote; sips's own has none. */
const carriesTime = (jpeg, segment) => isExif(jpeg, segment) && TIME_TEXT.test(jpeg.subarray(segment.start, segment.end).toString('latin1'));

/** Whether the file already has a capture time in an Exif segment. */
export function hasCaptureTime(jpeg) {
  for (const segment of segments(jpeg)) if (carriesTime(jpeg, segment)) return true;
  return false;
}

/** The file without its capture-time segment: for a stamped sample exactly the bytes the encoder wrote, which is what the AI measured. */
export function stripCaptureTime(jpeg) {
  const parts = [];
  let from = 0;
  for (const segment of segments(jpeg)) {
    if (!carriesTime(jpeg, segment)) continue;
    parts.push(jpeg.subarray(from, segment.start));
    from = segment.end;
  }
  parts.push(jpeg.subarray(from));
  return Buffer.concat(parts);
}

/** The Exif APP1 segment (marker, length, 'Exif\0\0', TIFF) for a local wall-clock time and the UTC offset the camera clock was set to. */
export function exifSegment({ local, offset = '+08:00' }) {
  const match = TIME.exec(local);
  if (!match || !OFFSET.test(offset)) throw new Error(`bad time format: ${local} ${offset}`);
  const stamp = Buffer.from(`${match[1]}:${match[2]}:${match[3]} ${match[4]}:${match[5]}:${match[6]}\0`, 'latin1');   // 20 bytes
  const zone = Buffer.from(`${offset}\0`, 'latin1');                                                                  // 7 bytes
  const IFD0 = 8, EXIF_IFD = 26, STAMP_AT = 56, ZONE_AT = 76;
  const tiff = Buffer.alloc(ZONE_AT + 8);
  tiff.write('MM', 0, 'latin1'); tiff.writeUInt16BE(42, 2); tiff.writeUInt32BE(IFD0, 4);
  // IFD0: one entry, a pointer to the Exif IFD; no next IFD
  tiff.writeUInt16BE(1, IFD0);
  tiff.writeUInt16BE(0x8769, IFD0 + 2); tiff.writeUInt16BE(4, IFD0 + 4); tiff.writeUInt32BE(1, IFD0 + 6); tiff.writeUInt32BE(EXIF_IFD, IFD0 + 10);
  tiff.writeUInt32BE(0, IFD0 + 14);
  // Exif IFD: tags in ascending order, both values too long for the 4-byte field so they live after the IFD
  tiff.writeUInt16BE(2, EXIF_IFD);
  tiff.writeUInt16BE(0x9003, EXIF_IFD + 2); tiff.writeUInt16BE(2, EXIF_IFD + 4); tiff.writeUInt32BE(stamp.length, EXIF_IFD + 6); tiff.writeUInt32BE(STAMP_AT, EXIF_IFD + 10);
  tiff.writeUInt16BE(0x9011, EXIF_IFD + 14); tiff.writeUInt16BE(2, EXIF_IFD + 16); tiff.writeUInt32BE(zone.length, EXIF_IFD + 18); tiff.writeUInt32BE(ZONE_AT, EXIF_IFD + 22);
  tiff.writeUInt32BE(0, EXIF_IFD + 26);
  stamp.copy(tiff, STAMP_AT);
  zone.copy(tiff, ZONE_AT);
  const body = Buffer.concat([EXIF_HEADER, tiff]);
  const head = Buffer.from([0xff, APP1, 0, 0]);
  head.writeUInt16BE(body.length + 2, 2);
  return Buffer.concat([head, body]);
}

/** `jpeg` with a capture-time Exif segment added after its JFIF APP0 (spec order). Refuses a file that already has a capture time. */
export function stampCaptureTime(jpeg, { local, offset = '+08:00' }) {
  if (hasCaptureTime(jpeg)) throw new Error('the JPEG already has a capture time; stamp the file the encoder wrote');
  const segment = exifSegment({ local, offset });
  let at = 2;
  if (jpeg[2] === 0xff && jpeg[3] === APP0) at = 4 + jpeg.readUInt16BE(4);
  return Buffer.concat([jpeg.subarray(0, at), segment, jpeg.subarray(at)]);
}
