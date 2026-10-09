// One-off, macOS-only (/usr/bin/sips): cuts the six bundled demo photos out of the two AI-generated concert images that already live in
// web/assets/ (stage-scene.png, crowd-scene.png; provenance in web/assets/image-provenance.json) and stamps the two sample photos with a
// fictional capture time. The OUTPUTS are committed (web/static-runtime/demo-assets/ with manifest.json); CI and the site build never run this.
// scripts/demo/README.md says what the photos are, where they come from and what was measured on them.
//
//   node scripts/demo/build-demo-photos.mjs                 cut, verify, write the six JPEGs and manifest.json
//   node scripts/demo/build-demo-photos.mjs --check         cut into memory and compare with the committed files (exit 1 on any difference)
//   node scripts/demo/build-demo-photos.mjs --accept-new-sample-pixels
//                                                           only after the sample pixels changed on purpose (see MEASURED_SAMPLE_PIXELS)
//
// Every file records its source, crop box, size, bytes and sha256 in manifest.json; the stamped samples also record the fictional capture
// time and pixelSha256, the hash of the file without the stamped Exif segment (= the pixels the AI was measured on).
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, rmSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { inflateSync } from 'node:zlib';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { stampCaptureTime, stripCaptureTime } from './exif-inject.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
export const ASSETS_DIR = join(root, 'web/assets/');
export const OUT_DIR = join(root, 'web/static-runtime/demo-assets/');
export const SIPS = '/usr/bin/sips';
export const QUALITY = 80;
export const OFFSET = '+08:00';                           // the fictional camera clock is set to Beijing time

/** Boxes are x, y, w, h in the 1536x1024 source. Four photos belong to the cast (roster.js), two are the samples a visitor can pick. */
export const PLAN = Object.freeze([
  { file: 'yao-stage.jpg', source: 'crowd-scene.png', box: { x: 0, y: 60, w: 620, h: 413 } },
  { file: 'man-crowd.jpg', source: 'crowd-scene.png', box: { x: 200, y: 380, w: 620, h: 413 } },
  { file: 'bei-balcony.jpg', source: 'stage-scene.png', box: { x: 1000, y: 0, w: 536, h: 357 } },
  { file: 'man-near.jpg', source: 'crowd-scene.png', box: { x: 0, y: 650, w: 700, h: 374 } },
  { file: 'sample-stage.jpg', source: 'stage-scene.png', box: { x: 340, y: 120, w: 840, h: 560 }, exif: '2026-09-26T21:47:50' },
  { file: 'sample-crowd.jpg', source: 'crowd-scene.png', box: { x: 836, y: 200, w: 700, h: 600 }, exif: '2026-09-26T21:48:10' },
].map(entry => Object.freeze({ ...entry, box: Object.freeze(entry.box) })));

/**
 * The encoder's own bytes for the two samples (the file without the stamped Exif segment), as they were when the on-device model was run on
 * them on 2026-10-05: sample-crowd reads 人海 and sure (margin .033-.038 over five resamplers, gate .02), sample-stage reads unsure
 * (margin .005-.007). Those results belong to these pixels, so a re-encode that changes them must be measured again (architecture 7.5)
 * before it ships; then update the hashes here and the numbers in scripts/demo/README.md.
 */
export const MEASURED_SAMPLE_PIXELS = Object.freeze({
  'sample-stage.jpg': '86378b6e42cfe1e668a2bea8687de54b2175e4c1d23a06b6f07503c79dd7b26a',
  'sample-crowd.jpg': '47d4a138a453f66614fad27224f5d8f55f35e7d0c03c31261cd0ce8e6b85550c',
});

// What the room worker accepts (sanitizeAvatarJpeg in runtime-preview/src/avatar-worker.js).
export const LIMITS = Object.freeze({ bytes: 300 * 1024, edge: 2400, pixels: 4_000_000 });

const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');

/** { width, height } from the first baseline or progressive frame header. */
export function jpegSize(jpeg) {
  for (let at = 2; at + 9 < jpeg.length;) {
    if (jpeg[at] !== 0xff) throw new Error(`JPEG marker expected at byte ${at}`);
    const marker = jpeg[at + 1];
    if (marker === 0xc0 || marker === 0xc2) return { height: jpeg.readUInt16BE(at + 5), width: jpeg.readUInt16BE(at + 7) };
    if (marker === 0xda) break;
    at += 2 + jpeg.readUInt16BE(at + 2);
  }
  throw new Error('no JPEG frame header before the scan');
}

/** Decodes an 8-bit, non-interlaced RGB or RGBA PNG (what the sources and sips's crops are) into { width, height, channels, pixels }. */
export function readPng(png) {
  if (!png.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) throw new Error('not a PNG');
  let header = null;
  const data = [];
  for (let at = 8; at + 12 <= png.length;) {
    const length = png.readUInt32BE(at), kind = png.toString('latin1', at + 4, at + 8), body = png.subarray(at + 8, at + 8 + length);
    if (kind === 'IHDR') header = { width: body.readUInt32BE(0), height: body.readUInt32BE(4), depth: body[8], type: body[9], interlace: body[12] };
    else if (kind === 'IDAT') data.push(body);
    else if (kind === 'IEND') break;
    at += 12 + length;
  }
  const channels = { 2: 3, 6: 4 }[header?.type];
  if (!header || header.depth !== 8 || !channels || header.interlace) throw new Error('only 8-bit non-interlaced RGB/RGBA PNGs are supported');
  const { width, height } = header, stride = width * channels, raw = inflateSync(Buffer.concat(data)), pixels = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)], line = y * (stride + 1) + 1, row = y * stride, above = row - stride;
    for (let i = 0; i < stride; i++) {
      const left = i >= channels ? pixels[row + i - channels] : 0, up = y ? pixels[above + i] : 0, corner = y && i >= channels ? pixels[above + i - channels] : 0;
      let value = raw[line + i];
      if (filter === 1) value += left;
      else if (filter === 2) value += up;
      else if (filter === 3) value += (left + up) >> 1;
      else if (filter === 4) {
        const guess = left + up - corner, dl = Math.abs(guess - left), du = Math.abs(guess - up), dc = Math.abs(guess - corner);
        value += dl <= du && dl <= dc ? left : du <= dc ? up : corner;
      }
      pixels[row + i] = value & 255;
    }
  }
  return { width, height, channels, pixels };
}

/** Whether `crop` is exactly the pixels of `source` inside `box` (colour channels only). */
function isRegion(source, crop, box) {
  if (crop.width !== box.w || crop.height !== box.h) return false;
  for (let row = 0; row < box.h; row++) {
    for (let column = 0; column < box.w; column++) {
      const from = ((box.y + row) * source.width + box.x + column) * source.channels, to = (row * box.w + column) * crop.channels;
      if (source.pixels[from] !== crop.pixels[to] || source.pixels[from + 1] !== crop.pixels[to + 1] || source.pixels[from + 2] !== crop.pixels[to + 2]) return false;
    }
  }
  return true;
}

const inside = (box, width, height) => box.x >= 0 && box.y >= 0 && box.w > 0 && box.h > 0 && box.x + box.w <= width && box.y + box.h <= height;

/** Reads the two source images' recorded size and hash from the provenance file and refuses a source that is not the recorded one. */
function readSources() {
  const provenance = JSON.parse(readFileSync(join(ASSETS_DIR, 'image-provenance.json'), 'utf8'));
  const sources = {};
  for (const asset of provenance.assets) {
    const bytes = readFileSync(join(ASSETS_DIR, asset.file));
    if (sha256(bytes) !== asset.sha256) throw new Error(`${asset.file} is not the image recorded in web/assets/image-provenance.json`);
    sources[asset.file] = { file: asset.file, width: asset.width, height: asset.height, sha256: asset.sha256, decoded: readPng(bytes) };
  }
  return sources;
}

function sips(...args) {
  try { execFileSync(SIPS, args, { stdio: 'pipe' }); }
  catch (error) { throw new Error(`sips failed (${args.slice(0, 3).join(' ')}...): ${String(error.stderr || error.message).trim()}`); }
}

/**
 * The lossless cut, as a PNG: sips -c height width --cropOffset y x. sips answers a crop that starts at the left edge and ends exactly
 * at the bottom edge (x = 0, y + h = image height) with the WHOLE image, so every cut is compared with the source pixels and, when it is
 * not that box, repeated on the mirrored image (flip both ways, crop the mirrored box, flip back: all lossless). A cut that matches
 * neither way stops the build.
 */
function cutPng(entry, source, tmp) {
  const { box, file } = entry, name = file.replace(/\.jpg$/, '');
  const plain = join(tmp, `${name}.png`);
  sips('-c', String(box.h), String(box.w), '--cropOffset', String(box.y), String(box.x), join(ASSETS_DIR, entry.source), '--out', plain);
  if (isRegion(source.decoded, readPng(readFileSync(plain)), box)) return plain;
  const mirrored = join(tmp, `${name}-mirrored.png`), cropped = join(tmp, `${name}-mirrored-crop.png`), back = join(tmp, `${name}-back.png`);
  sips('-f', 'horizontal', '-f', 'vertical', join(ASSETS_DIR, entry.source), '--out', mirrored);
  sips('-c', String(box.h), String(box.w), '--cropOffset', String(source.height - box.y - box.h), String(source.width - box.x - box.w), mirrored, '--out', cropped);
  sips('-f', 'horizontal', '-f', 'vertical', cropped, '--out', back);
  if (isRegion(source.decoded, readPng(readFileSync(back)), box)) return back;
  throw new Error(`${file}: sips did not cut the box ${JSON.stringify(box)} out of ${entry.source}`);
}

/** Cuts and stamps everything in memory. Returns { manifest, files: Map(file -> Buffer) }; throws on anything that would ship a wrong file. */
export function buildDemoPhotos() {
  if (!existsSync(SIPS)) throw new Error('This one-off tool needs macOS sips (/usr/bin/sips). The outputs are committed; you only need it to re-cut them.');
  const sources = readSources();
  const tmp = mkdtempSync(join(tmpdir(), 'space-demo-photos-'));
  try {
    const files = new Map(), entries = [];
    for (const entry of PLAN) {
      const source = sources[entry.source];
      if (!source) throw new Error(`${entry.file}: unknown source ${entry.source}`);
      if (!inside(entry.box, source.width, source.height)) throw new Error(`${entry.file}: the box leaves ${entry.source} (${source.width}x${source.height})`);
      const jpeg = join(tmp, entry.file);
      sips('-s', 'format', 'jpeg', '-s', 'formatOptions', String(QUALITY), cutPng(entry, source, tmp), '--out', jpeg);
      const encoded = readFileSync(jpeg);
      const bytes = entry.exif ? stampCaptureTime(encoded, { local: entry.exif, offset: OFFSET }) : encoded;
      const { width, height } = jpegSize(bytes);
      if (width !== entry.box.w || height !== entry.box.h) throw new Error(`${entry.file}: encoded ${width}x${height}, the box says ${entry.box.w}x${entry.box.h}`);
      if (bytes.length > LIMITS.bytes || width > LIMITS.edge || height > LIMITS.edge || width * height > LIMITS.pixels) throw new Error(`${entry.file}: over the worker's photo limits`);
      files.set(entry.file, bytes);
      entries.push({
        file: entry.file, source: entry.source, box: { ...entry.box }, width, height, bytes: bytes.length, sha256: sha256(bytes),
        fictionalExifTime: entry.exif ? `${entry.exif}${OFFSET}` : null,
        ...(entry.exif ? { pixelSha256: sha256(stripCaptureTime(bytes)) } : {}),
      });
    }
    const manifest = {
      generatedBy: 'scripts/demo/build-demo-photos.mjs',
      provenance: 'Crops of the two AI-generated images in web/assets/ (provenance: web/assets/image-provenance.json, OpenAI image_gen, synthetic fictional concert imagery, 2026-09-26). No third-party image.',
      encoder: `macOS sips, JPEG quality ${QUALITY}`,
      sources: Object.values(sources).map(({ decoded, ...recorded }) => recorded),
      files: entries,
    };
    return { manifest, files };
  } finally { rmSync(tmp, { recursive: true, force: true }); }
}

const render = manifest => `${JSON.stringify(manifest, null, 2)}\n`;

function main(argv) {
  const check = argv.includes('--check'), accept = argv.includes('--accept-new-sample-pixels');
  const { manifest, files } = buildDemoPhotos();
  const moved = manifest.files.filter(entry => entry.pixelSha256 && entry.pixelSha256 !== MEASURED_SAMPLE_PIXELS[entry.file]);
  if (moved.length && !accept && !check) {
    console.error(`REFUSED: the pixels of ${moved.map(entry => entry.file).join(', ')} are not the ones measured on 2026-10-05.\nThe AI result belongs to those pixels. Measure again (architecture 7.5), update MEASURED_SAMPLE_PIXELS and README.md, then run with --accept-new-sample-pixels.`);
    process.exit(2);
  }
  const manifestPath = join(OUT_DIR, 'manifest.json');
  const committed = existsSync(manifestPath) ? readFileSync(manifestPath, 'utf8') : '';
  const was = new Map((committed ? JSON.parse(committed).files : []).map(entry => [entry.file, entry.sha256]));
  const changed = manifest.files.filter(entry => was.get(entry.file) !== entry.sha256).map(entry => entry.file);
  if (check) {
    const same = !changed.length && committed === render(manifest);
    console.log(same ? 'identical to the committed outputs' : `DIFFERENT from the committed outputs: ${changed.join(', ') || 'manifest.json only'}`);
    process.exit(same ? 0 : 1);
  }
  mkdirSync(OUT_DIR, { recursive: true });
  for (const [file, bytes] of files) writeFileSync(join(OUT_DIR, file), bytes);
  writeFileSync(manifestPath, render(manifest));
  for (const entry of manifest.files) console.log(`${entry.file.padEnd(18)} ${String(entry.width).padStart(4)}x${String(entry.height).padEnd(4)} ${String(entry.bytes).padStart(7)} B  ${entry.sha256.slice(0, 12)}${entry.fictionalExifTime ? `  EXIF ${entry.fictionalExifTime}` : ''}`);
  if (changed.length) console.log(`\nchanged since the committed manifest: ${changed.join(', ')}\nA changed cast photo needs a new SEED_REV in web/static-runtime/showcase/roster.js (browsers keep the photos they were seeded with).`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main(process.argv.slice(2));
