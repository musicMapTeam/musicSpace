import { D } from './doodle-courtyard.js';

/* PROTOTYPE: the courtyard's printed props (shop sign, sleeves, badge, poster, the record
 * table's sleeve faces) redrawn as marker prints with the self-hosted Doodle faces. They paint
 * at once with fallback faces and again once the faces have arrived (fontsReady). */

const FONT = {
  logo: '"Doodle Logo","Doodle Display","Arial Black",sans-serif',
  display: '"Doodle Display","Doodle Marker","PingFang SC","Microsoft YaHei",sans-serif',
  marker: '"Doodle Marker","PingFang SC","Microsoft YaHei",sans-serif',
};
const LOADS = [
  [`120px ${FONT.logo}`, 'RECORDS MUSIC MAP FOLLOW A VOICE SIDE B ONE MORE SONG ACOUSTIC SESSION 33/45 ?'],
  [`90px ${FONT.display}`, '唱片店'],
];
let ready = null;
/** Resolves true once a Doodle face for the prints has arrived. */
export function fontsReady(doc = globalThis.document) {
  if (ready) return ready;
  const fonts = doc?.fonts;
  ready = typeof fonts?.load === 'function'
    ? Promise.all(LOADS.map(([font, text]) => fonts.load(font, text).then(faces => faces.length > 0, () => false))).then(list => list.some(Boolean))
    : Promise.resolve(false);
  return ready;
}

function random(seed) { let s = seed % 2147483647 || 1; return () => (s = s * 16807 % 2147483647) / 2147483647; }
/** A hand-drawn rectangle: four slightly bent sides. */
export function wobblyRect(ctx, x, y, w, h, jitter, seed) {
  const r = random(seed), j = () => (r() - .5) * 2 * jitter;
  ctx.beginPath(); ctx.moveTo(x + j(), y + j());
  ctx.bezierCurveTo(x + w * .33 + j(), y + j(), x + w * .67 + j(), y + j(), x + w + j(), y + j());
  ctx.bezierCurveTo(x + w + j(), y + h * .33 + j(), x + w + j(), y + h * .67 + j(), x + w + j(), y + h + j());
  ctx.bezierCurveTo(x + w * .67 + j(), y + h + j(), x + w * .33 + j(), y + h + j(), x + j(), y + h + j());
  ctx.bezierCurveTo(x + j(), y + h * .67 + j(), x + j(), y + h * .33 + j(), x + j(), y + j());
  ctx.closePath();
}
function disc(ctx, x, y, radius, fill, line = 0) {
  ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI * 2);
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (line) { ctx.lineWidth = line; ctx.strokeStyle = D.ink; ctx.stroke(); }
}
/** Layered lettering (type.css .ds-title / .ds-sticker): colour shadow, ink outline, fill. */
function layered(ctx, text, x, y, size, { font = FONT.logo, fill = D.ink, outline = null, shadow = D.pink, align = 'left', max } = {}) {
  ctx.font = `${size}px ${font}`; ctx.textAlign = align; ctx.textBaseline = 'alphabetic'; ctx.lineJoin = 'round'; ctx.miterLimit = 2;
  const d = Math.max(2, size * .07);
  if (shadow) { ctx.fillStyle = shadow; ctx.fillText(text, x + d, y + d, max); if (outline) { ctx.strokeStyle = shadow; ctx.lineWidth = size * .12; ctx.strokeText(text, x + d, y + d, max); } }
  if (outline) { ctx.strokeStyle = outline; ctx.lineWidth = size * .12; ctx.strokeText(text, x, y, max); }
  ctx.fillStyle = fill; ctx.fillText(text, x, y, max);
}
function inkFrame(ctx, w, h, line, seed, inset = line) { wobblyRect(ctx, inset, inset, w - inset * 2, h - inset * 2, line * .5, seed); ctx.lineWidth = line; ctx.strokeStyle = D.ink; ctx.lineJoin = 'round'; ctx.stroke(); }
function dots(ctx, x, y, w, h, step, color) { ctx.fillStyle = color; for (let a = x; a < x + w; a += step) for (let b = y; b < y + h; b += step) { ctx.beginPath(); ctx.arc(a, b, step * .16, 0, Math.PI * 2); ctx.fill(); } }

/** Shop sign above the open front (1024 x 256). Words are a copy decision (see the survey). */
export function paintMarquee(ctx) {
  ctx.fillStyle = D.card; ctx.fillRect(0, 0, 1024, 256);
  dots(ctx, 40, 30, 1000, 220, 22, '#1c1b1a14');
  disc(ctx, 128, 128, 84, D.ink); disc(ctx, 128, 128, 30, D.pink, 6); disc(ctx, 128, 128, 6, D.card);
  ctx.strokeStyle = D.ink3; ctx.lineWidth = 3; for (const r of [48, 64]) { ctx.beginPath(); ctx.arc(128, 128, r, -.4, 1.3); ctx.stroke(); }
  layered(ctx, '唱片店', 252, 150, 112, { font: FONT.display, shadow: D.yellow });
  layered(ctx, 'RECORDS', 610, 160, 92, { fill: D.pink, outline: D.ink, shadow: D.ink });
  inkFrame(ctx, 1024, 256, 10, 41);
}
const SLEEVE_STYLE = [
  { bg: D.yellow, a: D.pink, b: D.mint, title: 'FOLLOW A VOICE', ink: D.ink },
  { bg: D.mint, a: D.yellow, b: D.card, title: 'SIDE B', ink: D.ink },
  { bg: D.pink, a: D.ink, b: D.yellow, title: 'ONE MORE SONG', ink: D.card },
];
/** Decorative album sleeves in the shop (512 x 512); fictional titles, no artists. */
export function paintSleeve(ctx, edition) {
  const s = SLEEVE_STYLE[edition % SLEEVE_STYLE.length];
  ctx.fillStyle = s.bg; ctx.fillRect(0, 0, 512, 512);
  if (edition === 0) {
    disc(ctx, 270, 220, 150, s.a, 10);
    ctx.beginPath(); ctx.moveTo(0, 380); ctx.bezierCurveTo(160, 250, 270, 400, 512, 220); ctx.lineTo(512, 512); ctx.lineTo(0, 512); ctx.closePath();
    ctx.fillStyle = s.b; ctx.fill(); ctx.lineWidth = 10; ctx.strokeStyle = D.ink; ctx.stroke();
  } else if (edition === 1) {
    for (let i = 8; i >= 0; i--) { ctx.beginPath(); ctx.ellipse(256, 230, 40 + i * 20, 70 + i * 13, -.47, 0, Math.PI * 2); ctx.fillStyle = i % 2 ? s.a : s.bg; ctx.fill(); ctx.lineWidth = 5; ctx.strokeStyle = D.ink; ctx.stroke(); }
    disc(ctx, 256, 230, 22, D.pink, 6);
  } else {
    disc(ctx, 256, 230, 150, s.a, 0); disc(ctx, 256, 230, 70, s.b, 8); disc(ctx, 256, 230, 18, D.card, 6);
    ctx.strokeStyle = '#ffffff55'; ctx.lineWidth = 4; for (const r of [100, 120, 138]) { ctx.beginPath(); ctx.arc(256, 230, r, 3.6, 5.2); ctx.stroke(); }
  }
  layered(ctx, s.title, 30, 480, 46, { fill: s.ink === D.card ? D.card : D.ink, outline: s.ink === D.card ? D.ink : null, shadow: s.ink === D.card ? D.ink : D.card });
  inkFrame(ctx, 512, 512, 14, 17 + edition, 7);
}
export function paintBadge(ctx) {
  ctx.fillStyle = D.card; ctx.fillRect(0, 0, 256, 256);
  disc(ctx, 128, 128, 116, D.yellow, 10);
  layered(ctx, 'SIDE', 128, 104, 44, { align: 'center', shadow: D.pink });
  layered(ctx, 'B', 128, 196, 100, { align: 'center', fill: D.pink, outline: D.ink, shadow: D.ink });
}
export function paintPoster(ctx) {
  ctx.fillStyle = D.pink; ctx.fillRect(0, 0, 384, 512);
  disc(ctx, 250, 150, 92, D.yellow, 8);
  ctx.beginPath(); ctx.moveTo(0, 300); ctx.bezierCurveTo(110, 220, 220, 330, 384, 240); ctx.lineTo(384, 512); ctx.lineTo(0, 512); ctx.closePath();
  ctx.fillStyle = D.mint; ctx.fill(); ctx.lineWidth = 8; ctx.strokeStyle = D.ink; ctx.stroke();
  layered(ctx, 'ACOUSTIC', 24, 396, 60, { fill: D.card, outline: D.ink, shadow: D.ink, max: 336 });
  ctx.font = `30px ${FONT.marker}`; ctx.fillStyle = D.ink; ctx.textAlign = 'left'; ctx.fillText('SESSION · SIDE B', 28, 452);
  inkFrame(ctx, 384, 512, 12, 23, 6);
}
/** Small printed signs (768 x 192): ink lettering on card. */
export function paintSign(ctx, text) {
  ctx.fillStyle = D.card; ctx.fillRect(0, 0, 768, 192);
  layered(ctx, text, 384, 132, 92, { align: 'center', shadow: D.mint, max: 690 });
  inkFrame(ctx, 768, 192, 12, text.length * 7);
}
/** A face-up record on the table: the artist's tone, a card-white pattern, an ink frame. */
export function paintCover(ctx, artist) {
  const tone = artist.color || '#ab8c99';
  ctx.fillStyle = D.card; ctx.fillRect(0, 0, 256, 256);
  ctx.fillStyle = tone; ctx.fillRect(10, 10, 236, 236);
  ctx.save(); ctx.beginPath(); ctx.rect(10, 10, 236, 236); ctx.clip();
  ctx.strokeStyle = D.card; ctx.lineWidth = 9;
  const pattern = [...artist.id].reduce((sum, char) => sum + char.charCodeAt(0), 0) % 3;
  if (pattern === 0) { for (let r = 18; r < 300; r += 22) { ctx.beginPath(); ctx.arc(150, 96, r, 0, Math.PI * 2); ctx.stroke(); } }
  else if (pattern === 1) { for (let x = -120; x < 340; x += 28) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.bezierCurveTo(x + 95, 70, x - 25, 170, x + 80, 256); ctx.stroke(); } }
  else { for (let y = -12; y < 262; y += 30) for (let x = -10; x < 280; x += 31) { ctx.beginPath(); ctx.arc(x + (y / 30 % 2) * 15, y, 8, 0, Math.PI * 2); ctx.stroke(); } }
  ctx.restore();
  inkFrame(ctx, 256, 256, 10, artist.id.length * 13, 8);
}
/** The shared back of every face-down record: no name, no colour, no count. */
export function paintBack(ctx) {
  ctx.fillStyle = D.paperDeep; ctx.fillRect(0, 0, 256, 256);
  ctx.strokeStyle = '#1c1b1a1f'; ctx.lineWidth = 2;
  for (let y = -256; y < 256; y += 11) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(256, y + 256); ctx.stroke(); }
  disc(ctx, 128, 128, 80, D.card, 6);
  layered(ctx, '?', 128, 166, 112, { align: 'center', fill: D.ink, shadow: D.pink });
  inkFrame(ctx, 256, 256, 10, 99, 8);
}
