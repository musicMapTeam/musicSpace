import { D } from './sakura-doodle.js';

/* The courtyard's printed props on paper (shop sign, sleeves, badge, poster, small signs and the
 * record table's sleeve faces): marker prints with layered lettering in the self-hosted Doodle faces.
 * They paint at once with fallback faces and again once the faces have arrived (watchPrintFonts).
 * Every title is invented and names no artist; the table's sleeves carry no names at all (the HTML
 * tags do). Only basic 2D canvas calls are used. */

const FONT = {
  logo: '"Doodle Logo","Doodle Display","Arial Black",sans-serif',
  display: '"Doodle Display","Doodle Marker","Noto Sans CJK SC","Microsoft YaHei",sans-serif',
  marker: '"Doodle Marker","Noto Sans CJK SC","Microsoft YaHei",sans-serif',
};
// The faces are sliced by character, so the texts are named.
const LOADS = [
  [`120px ${FONT.logo}`, 'RECORDS FOLLOW A VOICE SIDE B ONE MORE SONG ACOUSTIC 33 / 45 ?'],
  [`110px ${FONT.display}`, '唱片店'],
  [`30px ${FONT.marker}`, 'SESSION · SIDE B'],
];

/** Calls repaint() once the Doodle faces for the prints have arrived; tries again whenever the page
 *  finishes loading fonts (the stylesheet may come later). Returns a function that stops watching. */
export function watchPrintFonts(repaint, doc = globalThis.document) {
  const fonts = doc?.fonts;
  if (typeof fonts?.load !== 'function') return () => {};
  let stopped = false; let pending = false; let painted = 0;
  const attempt = () => {
    if (stopped || pending) return;
    pending = true;
    Promise.all(LOADS.map(([font, text]) => fonts.load(font, text).then(faces => faces.length > 0, () => false))).then(loaded => {
      pending = false;
      const count = loaded.filter(Boolean).length;
      if (stopped || count <= painted) return;
      painted = count; repaint();
      if (count === LOADS.length) stop();
    });
  };
  const stop = () => { stopped = true; fonts.removeEventListener?.('loadingdone', attempt); };
  fonts.addEventListener?.('loadingdone', attempt);
  attempt();
  return stop;
}

/** A token colour with an alpha, for canvas strokes. */
export function withAlpha(hex, alpha) {
  const value = parseInt(hex.slice(1), 16);
  return `rgba(${value >> 16 & 255},${value >> 8 & 255},${value & 255},${alpha})`;
}
function random(seed) { let s = seed % 2147483647 || 1; return () => (s = s * 16807 % 2147483647) / 2147483647; }
/** A hand-drawn rectangle: four slightly bent sides. */
function wobblyRect(ctx, x, y, w, h, jitter, seed) {
  const r = random(seed); const j = () => (r() - .5) * 2 * jitter;
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
/** Layered lettering, as type.css .ds-title / .ds-sticker: a colour offset shadow, an ink outline, the fill. */
function layered(ctx, text, x, y, size, { font = FONT.logo, fill = D.ink, outline = null, shadow = D.pink, align = 'left', max } = {}) {
  ctx.font = `${size}px ${font}`; ctx.textAlign = align; ctx.textBaseline = 'alphabetic'; ctx.lineJoin = 'round'; ctx.miterLimit = 2;
  const offset = Math.max(2, size * .07);
  if (shadow) {
    ctx.fillStyle = shadow; ctx.fillText(text, x + offset, y + offset, max);
    if (outline) { ctx.strokeStyle = shadow; ctx.lineWidth = size * .12; ctx.strokeText(text, x + offset, y + offset, max); }
  }
  if (outline) { ctx.strokeStyle = outline; ctx.lineWidth = size * .12; ctx.strokeText(text, x, y, max); }
  ctx.fillStyle = fill; ctx.fillText(text, x, y, max);
}
function inkFrame(ctx, w, h, line, seed, inset = line) {
  wobblyRect(ctx, inset, inset, w - inset * 2, h - inset * 2, line * .5, seed);
  ctx.lineWidth = line; ctx.strokeStyle = D.ink; ctx.lineJoin = 'round'; ctx.stroke();
}
function dots(ctx, x, y, w, h, step, color) {
  ctx.fillStyle = color;
  for (let a = x; a < x + w; a += step) for (let b = y; b < y + h; b += step) { ctx.beginPath(); ctx.arc(a, b, step * .16, 0, Math.PI * 2); ctx.fill(); }
}

/** Shop sign over the open front (1024 x 256). */
export function paintMarquee(ctx) {
  ctx.fillStyle = D.card; ctx.fillRect(0, 0, 1024, 256);
  dots(ctx, 40, 30, 970, 210, 22, withAlpha(D.ink, .08));
  disc(ctx, 128, 128, 84, D.ink); disc(ctx, 128, 128, 30, D.pink, 6); disc(ctx, 128, 128, 6, D.card);
  ctx.strokeStyle = D.ink3; ctx.lineWidth = 3;
  for (const radius of [48, 64]) { ctx.beginPath(); ctx.arc(128, 128, radius, -.4, 1.3); ctx.stroke(); }
  layered(ctx, '唱片店', 250, 160, 112, { font: FONT.display, shadow: D.yellow, max: 340 });
  layered(ctx, 'RECORDS', 610, 164, 88, { fill: D.pink, outline: D.ink, shadow: D.ink, max: 370 });
  inkFrame(ctx, 1024, 256, 10, 41);
}

const SLEEVE_STYLE = [
  { bg: D.yellow, a: D.pink, b: D.mint, title: 'FOLLOW A VOICE', onDark: false },
  { bg: D.mint, a: D.yellow, b: D.card, title: 'SIDE B', onDark: false },
  { bg: D.pink, a: D.ink, b: D.yellow, title: 'ONE MORE SONG', onDark: true },
];
/** The shop's decorative album sleeves (512 x 512): invented titles, no artists. */
export function paintSleeve(ctx, edition) {
  const style = SLEEVE_STYLE[edition % SLEEVE_STYLE.length];
  ctx.fillStyle = style.bg; ctx.fillRect(0, 0, 512, 512);
  if (edition % 3 === 0) {
    disc(ctx, 270, 220, 150, style.a, 10);
    ctx.beginPath(); ctx.moveTo(0, 380); ctx.bezierCurveTo(160, 250, 270, 400, 512, 220); ctx.lineTo(512, 512); ctx.lineTo(0, 512); ctx.closePath();
    ctx.fillStyle = style.b; ctx.fill(); ctx.lineWidth = 10; ctx.strokeStyle = D.ink; ctx.stroke();
  } else if (edition % 3 === 1) {
    for (let i = 8; i >= 0; i--) {
      ctx.beginPath(); ctx.ellipse(256, 230, 40 + i * 20, 70 + i * 13, -.47, 0, Math.PI * 2);
      ctx.fillStyle = i % 2 ? style.a : style.bg; ctx.fill(); ctx.lineWidth = 5; ctx.strokeStyle = D.ink; ctx.stroke();
    }
    disc(ctx, 256, 230, 22, D.pink, 6);
  } else {
    disc(ctx, 256, 230, 150, style.a); disc(ctx, 256, 230, 70, style.b, 8); disc(ctx, 256, 230, 18, D.card, 6);
    ctx.strokeStyle = withAlpha(D.card, .35); ctx.lineWidth = 4;
    for (const radius of [100, 120, 138]) { ctx.beginPath(); ctx.arc(256, 230, radius, 3.6, 5.2); ctx.stroke(); }
  }
  layered(ctx, style.title, 30, 480, 46, style.onDark ? { fill: D.card, outline: D.ink, shadow: D.ink, max: 452 } : { fill: D.ink, shadow: D.card, max: 452 });
  inkFrame(ctx, 512, 512, 14, 17 + edition, 7);
}
/** The hanging record's badge (256 x 256). */
export function paintBadge(ctx) {
  ctx.fillStyle = D.card; ctx.fillRect(0, 0, 256, 256);
  disc(ctx, 128, 128, 116, D.yellow, 10);
  layered(ctx, 'SIDE', 128, 104, 44, { align: 'center', shadow: D.pink });
  layered(ctx, 'B', 128, 196, 100, { align: 'center', fill: D.pink, outline: D.ink, shadow: D.ink });
}
/** The wall poster inside the shop (384 x 512). */
export function paintPoster(ctx) {
  ctx.fillStyle = D.pink; ctx.fillRect(0, 0, 384, 512);
  disc(ctx, 250, 150, 92, D.yellow, 8);
  ctx.beginPath(); ctx.moveTo(0, 300); ctx.bezierCurveTo(110, 220, 220, 330, 384, 240); ctx.lineTo(384, 512); ctx.lineTo(0, 512); ctx.closePath();
  ctx.fillStyle = D.mint; ctx.fill(); ctx.lineWidth = 8; ctx.strokeStyle = D.ink; ctx.stroke();
  layered(ctx, 'ACOUSTIC', 24, 396, 60, { fill: D.card, outline: D.ink, shadow: D.ink, max: 336 });
  ctx.font = `30px ${FONT.marker}`; ctx.fillStyle = D.ink; ctx.textAlign = 'left'; ctx.fillText('SESSION · SIDE B', 28, 452, 330);
  inkFrame(ctx, 384, 512, 12, 23, 6);
}
/** Small printed signs (768 x 192): ink lettering on card. */
export function paintSign(ctx, text) {
  ctx.fillStyle = D.card; ctx.fillRect(0, 0, 768, 192);
  layered(ctx, text, 384, 132, 92, { align: 'center', shadow: D.mint, max: 690 });
  inkFrame(ctx, 768, 192, 12, text.length * 7);
}
const patternOf = id => [...String(id)].reduce((sum, char) => sum + char.charCodeAt(0), 0) % 3;
/** A face-up record on the table (256 x 256): the artist's catalogue colour, a card-white pattern and
 *  an ink frame. No name: names stay on the HTML tags. */
export function paintCover(ctx, artist) {
  const tone = artist.color || D.ink3;
  ctx.fillStyle = D.card; ctx.fillRect(0, 0, 256, 256);
  ctx.fillStyle = tone; ctx.fillRect(10, 10, 236, 236);
  ctx.save(); ctx.beginPath(); ctx.rect(10, 10, 236, 236); ctx.clip();
  ctx.strokeStyle = D.card; ctx.lineWidth = 9;
  const pattern = patternOf(artist.id);
  if (pattern === 0) { for (let radius = 18; radius < 300; radius += 22) { ctx.beginPath(); ctx.arc(150, 96, radius, 0, Math.PI * 2); ctx.stroke(); } }
  else if (pattern === 1) { for (let x = -120; x < 340; x += 28) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.bezierCurveTo(x + 95, 70, x - 25, 170, x + 80, 256); ctx.stroke(); } }
  else { for (let y = -12; y < 262; y += 30) for (let x = -10; x < 280; x += 31) { ctx.beginPath(); ctx.arc(x + (y / 30 % 2) * 15, y, 8, 0, Math.PI * 2); ctx.stroke(); } }
  ctx.restore();
  inkFrame(ctx, 256, 256, 10, String(artist.id).length * 13, 8);
}
/** The one shared back of every face-down record (256 x 256): no name, no colour, no count. */
export function paintBack(ctx) {
  ctx.fillStyle = D.paperDeep; ctx.fillRect(0, 0, 256, 256);
  ctx.strokeStyle = withAlpha(D.ink, .12); ctx.lineWidth = 2;
  for (let y = -256; y < 256; y += 11) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(256, y + 256); ctx.stroke(); }
  disc(ctx, 128, 128, 80, D.card, 6);
  layered(ctx, '?', 128, 166, 112, { align: 'center', fill: D.ink, shadow: D.pink });
  inkFrame(ctx, 256, 256, 10, 99, 8);
}
