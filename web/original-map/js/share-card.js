import qrcode from 'qrcode-generator';
import { artistById, artistName, songs } from './map-data.js';

/*
 * Two keepsakes, drawn on this device and never uploaded:
 * - 寻声战绩卡: the puzzle (start and target) and how the player did. The stops in between are
 *   face-down sleeves, so a friend who scans the code still has the whole puzzle to solve.
 * - 发现卡片 (PRD 5.8): one roam's start, the singers met on the way and the songs kept.
 * Both are a Doodle page: dotted paper, an ink-framed ticket with a hard shadow and tape, marker colours read from the page's
 * tokens.css (the PNG and the page never drift) and the Doodle faces, loaded for the card's own text before it is drawn.
 * 1080 × 1350 (4:5) keeps the portrait crop of WeChat Moments and 小红书.
 */
const W = 1080;
const H = 1350;
const FOOTER = '每条连线都是一首合唱录音';
const FONT = {
  logo: '"Doodle Logo", "Doodle Display", sans-serif',
  display: '"Doodle Display", "Doodle Marker", "PingFang SC", "Microsoft YaHei", sans-serif',
  ui: '"Doodle Marker", "PingFang SC", "Microsoft YaHei", sans-serif',
  hand: '"Doodle Hand", "Doodle Marker", "PingFang SC", "Microsoft YaHei", sans-serif',
  digits: '"Doodle Digits", "Doodle Logo", sans-serif',
};
const TOKENS = ['paper', 'paper-card', 'paper-deep', 'ink', 'ink-2', 'ink-3', 'pink', 'pink-soft', 'mint', 'mint-soft', 'yellow', 'yellow-soft', 'sky', 'sky-soft', 'orange'];
// Only one preview is open at a time; the next one (or leaving the page) releases the last.
let closePreview = null;

const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const pad2 = value => String(value).padStart(2, '0');
const stampDate = timestamp => { const date = new Date(timestamp); return `${date.getFullYear()}.${pad2(date.getMonth() + 1)}.${pad2(date.getDate())}`; };
const fileDate = timestamp => { const date = new Date(timestamp); return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`; };
const longDate = timestamp => new Date(timestamp).toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' });
const slug = id => String(id || '').replace(/^real-/, '').replace(/[^a-z0-9-]/gi, '') || 'map';
const toneOf = id => artistById[id]?.color;

/** The Doodle palette from the page's tokens (camelCase keys: paperCard, ink2 …). */
function palette() {
  const style = getComputedStyle(document.documentElement);
  return Object.fromEntries(TOKENS.map(name => [name.replace(/-(\w)/g, (_, c) => c.toUpperCase()), style.getPropertyValue(`--ds-${name}`).trim()]));
}
/** Loads the faces, and the slices of them, that the card's own text uses; a face that cannot load falls back, never blocks. */
async function loadFaces(texts) {
  const fonts = document.fonts;
  if (!fonts?.load) return;
  await Promise.all(Object.entries(texts).map(([role, text]) => fonts.load(`40px ${FONT[role]}`, text || 'A').catch(() => [])));
}

/* ---------- Links: only the puzzle travels, never the route, the keeps or the history ---------- */

/** `<page>?from=<start>&to=<target>#/explore`: the same puzzle for whoever opens it. */
export function challengeUrl(start, target, base = globalThis.location?.href) {
  const url = new URL(base);
  url.search = '';
  url.searchParams.set('from', start);
  url.searchParams.set('to', target);
  url.hash = '/explore';
  return url.href;
}
/** The front door, without any puzzle or view. */
export function homeUrl(base = globalThis.location?.href) {
  const url = new URL(base);
  url.search = ''; url.hash = '';
  return url.href;
}
/** A readable address for print: host and path, no scheme, no query. */
export function shortUrl(href) {
  const url = new URL(href);
  return `${url.host}${url.pathname}`.replace(/\/$/, '') || url.href;
}
export const challengeText = (start, target) => `${artistName(start)} 和 ${artistName(target)} 之间隔着几首歌？来 Music Space 翻翻看`;

/** Hand the puzzle to a friend, only on the player's click: the system share sheet when there is
 *  one, else the clipboard, else `showLink(url, text)` puts the link in a field to copy by hand.
 *  Resolves to 'shared' | 'cancelled' | 'copied' | 'shown'. */
export async function shareChallengeLink({ start, target }, { toast, showLink }) {
  const url = challengeUrl(start, target);
  const text = challengeText(start, target);
  if (typeof navigator.share === 'function') {
    try { await navigator.share({ title: 'Music Space · 寻声', text, url }); return 'shared'; }
    catch (error) { if (error?.name === 'AbortError') return 'cancelled'; }
  }
  if (navigator.clipboard?.writeText) {
    try { await navigator.clipboard.writeText(url); toast?.('题目链接已复制'); return 'copied'; }
    catch { /* No permission: the link is shown instead. */ }
  }
  showLink?.(url, text);
  return 'shown';
}

/* ---------- Canvas primitives ---------- */

function setFont(ctx, size, family = FONT.ui) { ctx.font = `400 ${size}px ${family}`; }
function spacing(ctx, value) { if ('letterSpacing' in ctx) ctx.letterSpacing = `${value}px`; }

/** Shrinks in the caller's own family until the line fits. */
function fitLine(ctx, text, x, y, width, size, { family = FONT.ui, min = 20 } = {}) {
  let current = size;
  setFont(ctx, current, family);
  while (ctx.measureText(text).width > width && current > min) { current -= 2; setFont(ctx, current, family); }
  ctx.fillText(text, x, y, width);
  return current;
}
// Chinese line breaking: closing punctuation hangs at the line end instead of starting the next line.
const NO_LINE_START = new Set([...'，。、；：！？）」』》〉】”’…,.;:!?)']);
function lines(ctx, text, width) {
  const rows = [];
  let line = '';
  for (const char of text) {
    if (char === '\n') { rows.push(line); line = ''; continue; }
    if (line && ctx.measureText(line + char).width > width && !NO_LINE_START.has(char)) { rows.push(line); line = char; }
    else line += char;
  }
  if (line) rows.push(line);
  return rows;
}
function wrapText(ctx, text, x, y, width, lineHeight, maxRows = Infinity) {
  const rows = lines(ctx, text, width);
  rows.slice(0, maxRows).forEach((row, index) => {
    const clipped = index === maxRows - 1 && rows.length > maxRows ? `${row.slice(0, -1)}…` : row;
    ctx.fillText(clipped, x, y + index * lineHeight, width + 30);
  });
  return Math.min(rows.length, maxRows);
}
/** A hand-cut box: each corner a slightly different radius, the way the page's --ds-radius-card is drawn. */
function handBox(ctx, x, y, w, h, radii = [22, 8, 26, 10]) {
  ctx.beginPath();
  if (ctx.roundRect) { ctx.roundRect(x, y, w, h, radii); return; }
  const [a, b, c, d] = radii;
  ctx.moveTo(x + a, y); ctx.arcTo(x + w, y, x + w, y + h, b); ctx.arcTo(x + w, y + h, x, y + h, c);
  ctx.arcTo(x, y + h, x, y, d); ctx.arcTo(x, y, x + w, y, a); ctx.closePath();
}
/** Ink outline over a fill, with the page's hard offset shadow under it. */
function inkShape(ctx, P, path, { fill, shadow = P.ink, offset = [10, 11], line = 5 }) {
  ctx.save();
  if (offset) { ctx.translate(offset[0], offset[1]); path(); ctx.fillStyle = shadow; ctx.fill(); ctx.translate(-offset[0], -offset[1]); }
  path(); ctx.fillStyle = fill; ctx.fill();
  ctx.lineWidth = line; ctx.strokeStyle = P.ink; ctx.lineJoin = 'round'; ctx.stroke();
  ctx.restore();
}

/* ---------- The page: dotted paper with a few doodles ---------- */

function paperPage(ctx, P) {
  ctx.fillStyle = P.paper; ctx.fillRect(0, 0, W, H);
  ctx.save(); ctx.fillStyle = P.ink; ctx.globalAlpha = .14;
  for (let y = 24; y < H; y += 44) for (let x = 24; x < W; x += 44) { ctx.beginPath(); ctx.arc(x, y, 2.3, 0, Math.PI * 2); ctx.fill(); }
  ctx.restore();
  // two doodles above the heading, two in the footer band (the tallest ticket ends at 1234)
  star(ctx, P, 86, 120, 34, P.yellow, -.2);
  sparkle(ctx, P, 990, 112, 20);
  star(ctx, P, 1012, 1294, 24, P.mint, .3);
  note(ctx, P, 44, 1270, 34, P.pink);
}
function star(ctx, P, cx, cy, r, color, turn = 0) {
  const points = Array.from({ length: 10 }, (_, i) => { const a = turn - Math.PI / 2 + i * Math.PI / 5; const rr = i % 2 ? r * .45 : r; return [cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]; });
  const path = () => { ctx.beginPath(); points.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath(); };
  inkShape(ctx, P, path, { fill: color, offset: [4, 4], line: 4 });
}
function sparkle(ctx, P, cx, cy, r) {
  ctx.save(); ctx.fillStyle = P.ink; ctx.beginPath();
  ctx.moveTo(cx, cy - r); ctx.quadraticCurveTo(cx, cy, cx + r, cy); ctx.quadraticCurveTo(cx, cy, cx, cy + r); ctx.quadraticCurveTo(cx, cy, cx - r, cy); ctx.quadraticCurveTo(cx, cy, cx, cy - r);
  ctx.fill(); ctx.restore();
}
function note(ctx, P, x, y, size, color) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(-.18); ctx.fillStyle = color; ctx.strokeStyle = P.ink; ctx.lineWidth = 4; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(size * .3, size * .7); ctx.lineTo(size * .3, -size * .2); ctx.lineTo(size, -size * .36); ctx.lineTo(size, size * .55); ctx.stroke();
  [[size * .12, size * .74], [size * .82, size * .58]].forEach(([nx, ny]) => { ctx.beginPath(); ctx.ellipse(nx, ny, size * .2, size * .15, -.35, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); });
  ctx.restore();
}
/** Translucent marker tape with torn ends. */
function tape(ctx, P, cx, cy, w, h, color, turn = -.05) {
  ctx.save(); ctx.translate(cx, cy); ctx.rotate(turn); ctx.globalAlpha = .7; ctx.fillStyle = color;
  ctx.beginPath(); ctx.moveTo(-w / 2, -h / 2);
  for (let i = 0; i <= 6; i += 1) ctx.lineTo(-w / 2 + (i % 2 ? 5 : 0), -h / 2 + h * i / 6);
  for (let i = 6; i >= 0; i -= 1) ctx.lineTo(w / 2 - (i % 2 ? 5 : 0), -h / 2 + h * i / 6);
  ctx.closePath(); ctx.fill(); ctx.restore();
}

/* ---------- Heading: the MUSIC SPACE letters as on the masthead, the 音乐探索 sticker, the card's kicker ---------- */

function logoLetters(ctx, P, text, cx, y, size) {
  ctx.save(); ctx.translate(cx, y); ctx.rotate(-.025); ctx.textAlign = 'center'; ctx.lineJoin = 'round';
  setFont(ctx, size, FONT.logo); spacing(ctx, 1);
  ctx.fillStyle = P.pink; ctx.fillText(text, size * .13, size * .13);
  ctx.fillStyle = P.ink; ctx.fillText(text, size * .07, size * .07);
  ctx.lineWidth = size * .12; ctx.strokeStyle = P.ink; ctx.strokeText(text, 0, 0);
  ctx.fillStyle = P.yellow; ctx.fillText(text, 0, 0);
  ctx.restore();
  return (setFont(ctx, size, FONT.logo), ctx.measureText(text).width);
}
/** A marker pill with ink text, turned a little. Returns its width. */
function pill(ctx, P, text, x, y, { fill = P.mint, size = 26, family = FONT.ui, align = 'left', turn = -.04, ink = P.ink } = {}) {
  ctx.save(); setFont(ctx, size, family); spacing(ctx, 1);
  const width = ctx.measureText(text).width + size * 1.1; const height = size * 1.55;
  const left = align === 'right' ? x - width : align === 'center' ? x - width / 2 : x;
  ctx.translate(left + width / 2, y); ctx.rotate(turn);
  inkShape(ctx, P, () => handBox(ctx, -width / 2, -height / 2, width, height, height / 2), { fill, offset: [4, 4], line: 3.5 });
  ctx.fillStyle = ink; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, 0, size * .06);
  ctx.restore();
  return width;
}
function heading(ctx, P, kicker) {
  const width = logoLetters(ctx, P, 'MUSIC SPACE', W / 2 - 70, 176, 84);
  pill(ctx, P, '音乐探索', W / 2 - 70 + width / 2 + 26, 150, { fill: P.mint, size: 30, turn: -.07 });
  ctx.save(); ctx.textAlign = 'center'; ctx.fillStyle = P.ink2; setFont(ctx, 30, FONT.ui); spacing(ctx, 3);
  ctx.fillText(kicker, W / 2, 268, W - 180);
  ctx.restore();
}

/* ---------- Ticket, seal and sleeves ---------- */

function ticket(ctx, P, T) {
  inkShape(ctx, P, () => handBox(ctx, T.x, T.y, T.w, T.h), { fill: P.paperCard, offset: [14, 16], line: 5 });
  // the stub below the tear is kraft
  ctx.save(); handBox(ctx, T.x, T.y, T.w, T.h); ctx.clip();
  ctx.fillStyle = P.paperDeep; ctx.fillRect(T.x, T.tear, T.w, T.y + T.h - T.tear);
  ctx.restore();
  ctx.save(); handBox(ctx, T.x, T.y, T.w, T.h); ctx.lineWidth = 5; ctx.strokeStyle = P.ink; ctx.stroke(); ctx.restore();
  // notches and the perforation
  ctx.save();
  [[T.x, T.tear], [T.x + T.w, T.tear]].forEach(([x, y]) => {
    ctx.fillStyle = P.paper; ctx.beginPath(); ctx.arc(x, y, 22, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = P.ink; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(x, y, 22, x === T.x ? -Math.PI / 2 : Math.PI / 2, x === T.x ? Math.PI / 2 : Math.PI * 1.5); ctx.stroke();
  });
  ctx.strokeStyle = P.ink; ctx.lineWidth = 4; ctx.setLineDash([16, 12]);
  ctx.beginPath(); ctx.moveTo(T.x + 40, T.tear); ctx.lineTo(T.x + T.w - 40, T.tear); ctx.stroke();
  ctx.restore();
  tape(ctx, P, T.x + T.w / 2, T.y + 2, 190, 46, P.yellow, -.04);
}
/** The round stamp: 抵达 / 揭晓 / 发现 and the date in digits. */
function seal(ctx, P, x, y, title, date, fill) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(-.18);
  inkShape(ctx, P, () => { ctx.beginPath(); ctx.ellipse(0, 0, 76, 72, .1, 0, Math.PI * 2); }, { fill, offset: [6, 7], line: 5 });
  ctx.fillStyle = P.ink; ctx.textAlign = 'center';
  setFont(ctx, 40, FONT.display); spacing(ctx, 4); ctx.fillText(title, 2, 6);
  setFont(ctx, 20, FONT.digits); spacing(ctx, 1); ctx.fillText(date, 0, 38, 110);
  ctx.restore();
}
/** A face-up sleeve: the singer's colour, an ink frame, the record inside. */
function artistSleeve(ctx, P, cx, cy, size, color, tilt = 0) {
  ctx.save(); ctx.translate(cx, cy); ctx.rotate(tilt);
  inkShape(ctx, P, () => handBox(ctx, -size / 2, -size / 2, size, size, [8, 4, 9, 5]), { fill: color || P.pinkSoft, offset: [6, 7], line: 4.5 });
  const disc = size * .31;
  ctx.fillStyle = P.ink; ctx.beginPath(); ctx.arc(0, 0, disc, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = P.ink2; ctx.lineWidth = 1.6;
  for (let r = disc * .45; r < disc - 2; r += 4) { ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.stroke(); }
  ctx.fillStyle = color || P.pink; ctx.beginPath(); ctx.arc(0, 0, disc * .34, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = P.paperCard; ctx.beginPath(); ctx.arc(0, 0, 3, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}
/** A face-down sleeve: kraft, ink hatching and a ？. It never says who is inside. */
function sealedSleeve(ctx, P, cx, cy, size, tilt = 0, glyph = '？') {
  ctx.save(); ctx.translate(cx, cy); ctx.rotate(tilt);
  inkShape(ctx, P, () => handBox(ctx, -size / 2, -size / 2, size, size, [8, 4, 9, 5]), { fill: P.paperDeep, offset: [5, 6], line: 4 });
  ctx.save(); handBox(ctx, -size / 2, -size / 2, size, size, [8, 4, 9, 5]); ctx.clip();
  ctx.strokeStyle = P.ink; ctx.globalAlpha = .18; ctx.lineWidth = 2;
  for (let d = -size; d < size; d += 11) { ctx.beginPath(); ctx.moveTo(d, -size / 2); ctx.lineTo(d + size, size / 2); ctx.stroke(); }
  ctx.restore();
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  setFont(ctx, Math.round(size * (glyph.length > 2 ? .3 : .5)), FONT.display);
  ctx.fillStyle = P.pink; ctx.fillText(glyph, 3, 5);
  ctx.fillStyle = P.ink; ctx.fillText(glyph, 0, 2);
  ctx.restore();
}
function drawQr(ctx, P, text, x, y, size) {
  const qr = qrcode(0, 'M');
  qr.addData(text); qr.make();
  const count = qr.getModuleCount();
  const quiet = 3;
  const cell = Math.floor(size / (count + quiet * 2));
  const drawn = cell * (count + quiet * 2);
  const ox = Math.round(x + (size - drawn) / 2) + quiet * cell; const oy = Math.round(y + (size - drawn) / 2) + quiet * cell;
  // The code stays square and unturned, dark on light, so it still scans.
  inkShape(ctx, P, () => handBox(ctx, x, y, size, size, 12), { fill: P.paperCard, offset: [6, 7], line: 4 });
  ctx.save(); ctx.fillStyle = P.ink;
  for (let row = 0; row < count; row += 1) for (let col = 0; col < count; col += 1) if (qr.isDark(row, col)) ctx.fillRect(ox + col * cell, oy + row * cell, cell, cell);
  ctx.restore();
}
function footer(ctx, P, address) {
  ctx.save();
  ctx.textAlign = 'center';
  ctx.fillStyle = P.ink3; setFont(ctx, 24, FONT.ui); spacing(ctx, 1);
  ctx.fillText(address, W / 2, 1278, W - 200);
  ctx.fillStyle = P.ink; setFont(ctx, 30, FONT.hand); spacing(ctx, 3);
  ctx.fillText(FOOTER, W / 2, 1322);
  // a wavy marker line under the footer
  const width = Math.min(ctx.measureText(FOOTER).width, W - 200); const left = W / 2 - width / 2;
  ctx.strokeStyle = P.pink; ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.beginPath();
  for (let x = 0; x <= width; x += 4) { const yy = 1334 + Math.sin(x / 9) * 3; if (x) ctx.lineTo(left + x, yy); else ctx.moveTo(left, yy); }
  ctx.stroke();
  ctx.restore();
}
function canvasBase() {
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  return { canvas, ctx: canvas.getContext('2d') };
}

/* ---------- 寻声战绩卡 ---------- */

const usedHints = session => (session.hints || []).filter(hint => hint.level < 3).length;

/** The route row: start, the stops in between face down, target. `broken` leaves a dashed gap
 *  before the target (the round was revealed before the player got there). */
function challengeRow(ctx, P, { start, target, middle, broken }, x0, x1, cy) {
  const END = 118; const MID = 86;
  const room = broken ? 5 : 6;
  const items = [{ kind: 'artist', id: start }];
  const shown = middle > room ? room - 1 : middle;
  for (let i = 0; i < shown; i += 1) items.push({ kind: 'sealed' });
  if (middle > room) items.push({ kind: 'more', count: middle - shown });
  if (broken) items.push({ kind: 'gap' });
  items.push({ kind: 'artist', id: target });
  const widths = items.map(item => item.kind === 'artist' ? END : MID);
  const gap = Math.max(10, ((x1 - x0) - widths.reduce((sum, w) => sum + w, 0)) / Math.max(1, items.length - 1));
  let x = x0;
  const centres = items.map((item, index) => { const centre = x + widths[index] / 2; x += widths[index] + gap; return centre; });
  // The thread the route hangs on (marker orange, as on the table); dashed ink where the player never walked.
  ctx.save();
  ctx.lineWidth = 7; ctx.strokeStyle = P.orange; ctx.lineCap = 'round';
  const gapIndex = items.findIndex(item => item.kind === 'gap');
  const solidEnd = gapIndex >= 0 ? centres[gapIndex - 1] : centres[centres.length - 1];
  ctx.beginPath(); ctx.moveTo(centres[0], cy); ctx.lineTo(solidEnd, cy); ctx.stroke();
  if (gapIndex >= 0) {
    ctx.setLineDash([12, 12]); ctx.strokeStyle = P.ink; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(solidEnd, cy); ctx.lineTo(centres[centres.length - 1], cy); ctx.stroke();
  }
  ctx.restore();
  const tilts = [-.05, .04, -.03, .05, -.04, .03, -.05, .04];
  items.forEach((item, index) => {
    const cx = centres[index]; const tilt = tilts[index % tilts.length];
    if (item.kind === 'artist') artistSleeve(ctx, P, cx, cy, END, toneOf(item.id), tilt);
    else if (item.kind === 'sealed') sealedSleeve(ctx, P, cx, cy, MID, tilt);
    else if (item.kind === 'more') sealedSleeve(ctx, P, cx, cy, MID, tilt, `+${item.count}`);
    else pill(ctx, P, '未走到', cx, cy, { fill: P.paperCard, size: 22, align: 'center', turn: .03 });
  });
}

/** 寻声战绩卡 for a finished round (arrived or revealed). Draws only the start, the target and
 *  face-down sleeves for the stops the player passed: no singer in between, no song title. */
export async function buildChallengeCard(session) {
  const P = palette();
  const arrived = session.status === 'complete';
  const steps = Math.max(0, session.path.length - 1);
  const hints = usedHints(session);
  const url = challengeUrl(session.start, session.target);
  const eyebrow = session.friend ? '朋友出的题 · 寻声' : '寻声';
  const detail = arrived
    ? `抵达终点 · ${hints ? `用了 ${hints} 次提示` : '没用提示'}`
    : `已揭晓 · 没有走到终点${hints ? ` · 用了 ${hints} 次提示` : ''}`;
  await loadFaces({
    logo: 'MUSIC SPACE', digits: `${stampDate(session.updated || Date.now())}+0123456789`,
    display: `${artistName(session.start)}${artistName(session.target)}抵达揭晓我走了步？${steps}`,
    ui: `音乐探索寻声 · 两位歌手之间，隔着几首歌？起点终点我的战绩${eyebrow}未走到${shortUrl(url)}`,
    hand: `中间的歌手，翻开才知道${detail}扫码走同一道题${FOOTER}`,
  });
  const { canvas, ctx } = canvasBase();
  paperPage(ctx, P);
  heading(ctx, P, '寻声 · 两位歌手之间，隔着几首歌？');
  const T = { x: 72, y: 318, w: 936, h: 900, tear: 930 };
  ticket(ctx, P, T);
  const left = T.x + 64; const right = T.x + T.w - 64;
  pill(ctx, P, eyebrow, left, T.y + 72, { fill: P.ink, ink: P.paperCard, size: 24, turn: -.04 });
  ctx.save();
  ctx.textAlign = 'left'; ctx.fillStyle = P.ink; spacing(ctx, 2);
  fitLine(ctx, artistName(session.start), left, T.y + 204, right - left - 200, 92, { family: FONT.display, min: 48 });
  ctx.fillStyle = P.ink3; setFont(ctx, 26, FONT.ui); spacing(ctx, 3);
  ctx.fillText('起点', left + 2, T.y + 246);
  ctx.restore();
  seal(ctx, P, right - 74, T.y + 118, arrived ? '抵达' : '揭晓', stampDate(session.updated || Date.now()), arrived ? P.yellow : P.skySoft);
  // An arrival passes steps − 1 singers between start and target; a revealed round passes every stop it walked.
  challengeRow(ctx, P, { start: session.start, target: session.target, middle: arrived ? Math.max(0, steps - 1) : steps, broken: !arrived }, left, right, T.y + 352);
  ctx.save();
  ctx.textAlign = 'right'; ctx.fillStyle = P.ink3; setFont(ctx, 26, FONT.ui); spacing(ctx, 3);
  ctx.fillText('终点', right - 2, T.y + 462);
  spacing(ctx, 2);
  const targetName = artistName(session.target);
  setFont(ctx, 92, FONT.display);
  ctx.fillStyle = P.ink; fitLine(ctx, targetName, right + 5, T.y + 549, right - left, 92, { family: FONT.display, min: 48 });
  ctx.fillStyle = P.pink; fitLine(ctx, targetName, right, T.y + 544, right - left, 92, { family: FONT.display, min: 48 });
  ctx.fillStyle = P.ink2; setFont(ctx, 30, FONT.hand); spacing(ctx, 2);
  ctx.fillText('中间的歌手，翻开才知道', right, T.y + 594);
  ctx.restore();
  // Stub: the score, and the code that opens the same puzzle.
  const sy = T.tear;
  const qrSize = 220;
  const textWidth = right - qrSize - 40 - left;
  pill(ctx, P, '我的战绩', left, sy + 64, { fill: P.yellow, size: 24, turn: -.03 });
  ctx.save();
  ctx.textAlign = 'left'; spacing(ctx, 2);
  ctx.fillStyle = P.ink;
  fitLine(ctx, `我走了 ${steps} 步`, left, sy + 156, textWidth, 66, { family: FONT.display, min: 40 });
  ctx.fillStyle = P.ink2; setFont(ctx, 30, FONT.hand); spacing(ctx, 1);
  wrapText(ctx, detail, left, sy + 208, textWidth, 38, 1);
  ctx.fillStyle = P.ink3; setFont(ctx, 26, FONT.hand); spacing(ctx, 1);
  wrapText(ctx, '扫码走同一道题', left, sy + 262, textWidth, 32, 1);
  ctx.restore();
  drawQr(ctx, P, url, right - qrSize, sy + 34, qrSize);
  footer(ctx, P, shortUrl(url));
  return canvas;
}
export const challengeCardName = session => `music-space-map-xunsheng-${slug(session.start)}-${slug(session.target)}.png`;

/* ---------- 发现卡片 (PRD 5.8) ---------- */

/** Singers in the order they were first met; each knows whether it was walked to from the one before. */
function metInOrder(session) {
  const order = [session.start];
  for (const event of session.events || []) if (event.type === 'move' && !order.includes(event.to)) order.push(event.to);
  const walked = new Set((session.events || []).filter(event => event.type === 'move').map(event => `${event.from}>${event.to}`));
  return order.map((id, index) => ({ id, walked: index > 0 && walked.has(`${order[index - 1]}>${id}`) }));
}
/** Distinct songs kept on this roam, in the order they were first kept. */
const keptSongs = session => (session.saved || []).filter((item, index, list) => list.findIndex(other => other.id === item.id) === index && songs[item.id]);
/** A discovery card prints every singer met up to this many, and every kept song up to MAX_KEPT; past either it prints an excerpt, tagged 节选. */
const MAX_MET = 6; const MAX_KEPT = 5;
/** Whether a roam's discovery card is an excerpt, so the preview only mentions 节选 when the image carries one. */
export const discoveryExcerpted = session => metInOrder(session).length > MAX_MET || keptSongs(session).length > MAX_KEPT;

/** 发现卡片 for a roam: the start, the singers met (an excerpt when long) and up to five kept songs. */
export async function buildDiscoveryCard(session) {
  const P = palette();
  const met = metInOrder(session);
  const kept = keptSongs(session);
  const when = session.updated || session.created || Date.now();
  const listed = kept.slice(0, MAX_KEPT);
  const status = `探索 · ${session.status === 'ended' ? '回顾' : '进行中'}`;
  await loadFaces({
    logo: 'MUSIC SPACE', digits: `${stampDate(when)}0123456789`,
    display: `从出发发现${artistName(session.start)}`,
    ui: `音乐探索发现卡片 · 从喜欢，走向未知${status}留下的歌节选 · 共位首等另${met.map(item => artistName(item.id)).join('')}${listed.map(item => songs[item.id].title).join('')}${shortUrl(homeUrl())}`,
    hand: `途经位 · 留下首${longDate(when)}按遇见的先后 · →：沿合唱走过去 ↩：退回后换个方向这次还没留下歌${listed.map(item => songs[item.id].artists.map(artistName).join(' / ')).join('')}${FOOTER}`,
  });
  const { canvas, ctx } = canvasBase();
  paperPage(ctx, P);
  heading(ctx, P, '发现卡片 · 从喜欢，走向未知');
  // The ticket is as tall as what it carries: the singers' row above the tear, and a stub as tall as its
  // list (five songs and 等 N 首 fill 400px). A short list makes a shorter ticket, centred between the heading and the footer.
  const rows = listed.length ? listed.length + (kept.length > MAX_KEPT ? 1 : 0) : 2;
  const stubHeight = 170 + (rows - 1) * 46;
  const UPPER = 500; const TALLEST = 900;
  const T = { x: 72, w: 936, h: UPPER + stubHeight };
  T.y = 318 + Math.round((TALLEST - T.h) / 2);
  T.tear = T.y + UPPER;
  ticket(ctx, P, T);
  const left = T.x + 64; const right = T.x + T.w - 64;
  pill(ctx, P, status, left, T.y + 72, { fill: P.ink, ink: P.paperCard, size: 24, turn: -.04 });
  // 从 <start> 出发, the name in the display letters.
  ctx.save();
  spacing(ctx, 2);
  setFont(ctx, 44, FONT.display); ctx.fillStyle = P.ink2; ctx.textAlign = 'left';
  ctx.fillText('从', left, T.y + 192);
  const nameX = left + ctx.measureText('从').width + 16;
  ctx.fillStyle = P.ink;
  const size = fitLine(ctx, artistName(session.start), nameX, T.y + 192, right - nameX - 260, 84, { family: FONT.display, min: 44 });
  setFont(ctx, size, FONT.display);
  const nameWidth = Math.min(ctx.measureText(artistName(session.start)).width, right - nameX - 260);
  setFont(ctx, 44, FONT.display); ctx.fillStyle = P.ink2;
  ctx.fillText('出发', nameX + nameWidth + 16, T.y + 192);
  ctx.fillStyle = P.ink2; setFont(ctx, 28, FONT.hand); spacing(ctx, 1);
  ctx.fillText(`途经 ${met.length} 位 · 留下 ${kept.length} 首 · ${longDate(when)}`, left, T.y + 250, right - left - 190);
  ctx.restore();
  seal(ctx, P, right - 74, T.y + 118, '发现', stampDate(when), P.mint);
  // The singers met, first to last. Long walks keep the first three and the last two (节选).
  const excerpt = met.length > MAX_MET;
  const slots = excerpt ? [...met.slice(0, 3), { gap: true }, ...met.slice(-2)] : met;
  const slotWidth = (right - left) / Math.max(slots.length, 4);
  const rowLeft = left + ((right - left) - slotWidth * slots.length) / 2;
  const cy = T.y + 326; const sleeve = 92;
  const tilts = [-.05, .04, -.03, .05, -.04, .03];
  // → between two singers walked one to the next; ↩ where the walk went back before reaching the next one.
  const glyphOf = (slot, index) => index === 0 || slot.gap || slots[index - 1].gap ? '' : slot.walked ? '→' : '↩';
  const turned = slots.some((slot, index) => glyphOf(slot, index) === '↩');
  slots.forEach((slot, index) => {
    const cx = rowLeft + slotWidth * (index + .5);
    const glyph = glyphOf(slot, index);
    if (glyph) {
      ctx.save(); ctx.textAlign = 'center'; ctx.fillStyle = P.orange; setFont(ctx, 34, FONT.ui);
      ctx.fillText(glyph, cx - slotWidth / 2, cy + 12);
      ctx.restore();
    }
    if (slot.gap) {
      ctx.save(); ctx.textAlign = 'center'; ctx.fillStyle = P.ink2; setFont(ctx, 36, FONT.ui); spacing(ctx, 4);
      ctx.fillText('···', cx, cy + 10);
      setFont(ctx, 22, FONT.ui); spacing(ctx, 1); ctx.fillText(`另 ${met.length - 5} 位`, cx, cy + sleeve);
      ctx.restore();
      return;
    }
    artistSleeve(ctx, P, cx, cy, sleeve, toneOf(slot.id), tilts[index % tilts.length]);
    ctx.save(); ctx.textAlign = 'center'; ctx.fillStyle = slot.id === session.start ? P.ink : P.ink2;
    fitLine(ctx, artistName(slot.id), cx, cy + sleeve + 4, slotWidth - 12, 28, { family: FONT.ui, min: 18 });
    ctx.restore();
  });
  // The key under the row names each mark it uses. Beside a 节选 tag a long key drops its opening words.
  ctx.save();
  setFont(ctx, 22, FONT.ui); spacing(ctx, 1);
  const tagRoom = excerpt ? ctx.measureText(`节选 · 共 ${met.length} 位`).width + 50 : 0;
  ctx.textAlign = 'left'; ctx.fillStyle = P.ink3; setFont(ctx, 22, FONT.hand); spacing(ctx, 1);
  const walkKey = `→：沿合唱走过去${turned ? ' · ↩：退回后换个方向' : ''}`;
  const legend = ctx.measureText(`按遇见的先后 · ${walkKey}`).width <= right - left - tagRoom ? `按遇见的先后 · ${walkKey}` : walkKey;
  ctx.fillText(legend, left, T.y + 462, right - left - tagRoom);
  ctx.restore();
  if (excerpt) pill(ctx, P, `节选 · 共 ${met.length} 位`, right, T.y + 455, { fill: P.pinkSoft, size: 20, align: 'right', turn: .03 });
  // Stub: the songs kept on the way.
  const sy = T.tear;
  pill(ctx, P, '留下的歌', left, sy + 60, { fill: P.yellow, size: 24, turn: -.03 });
  if (kept.length > MAX_KEPT) pill(ctx, P, `节选 · 共 ${kept.length} 首`, right, sy + 60, { fill: P.pinkSoft, size: 20, align: 'right', turn: .03 });
  if (!listed.length) {
    ctx.save(); ctx.fillStyle = P.ink2; setFont(ctx, 30, FONT.hand); spacing(ctx, 1);
    wrapText(ctx, '这次还没留下歌', left, sy + 134, right - left, 40, 2);
    ctx.restore();
  }
  listed.forEach((item, index) => {
    const song = songs[item.id];
    const y = sy + 124 + index * 46;
    ctx.save();
    ctx.textAlign = 'left'; ctx.fillStyle = P.pink; setFont(ctx, 24, FONT.digits);
    ctx.fillText(pad2(index + 1), left, y);
    ctx.fillStyle = P.ink; spacing(ctx, 1);
    fitLine(ctx, `《${song.title}》`, left + 50, y, 470, 30, { family: FONT.ui, min: 20 });
    ctx.textAlign = 'right'; ctx.fillStyle = P.ink2; spacing(ctx, 0);
    fitLine(ctx, song.artists.map(artistName).join(' / '), right, y, 290, 24, { family: FONT.hand, min: 16 });
    ctx.restore();
  });
  if (kept.length > MAX_KEPT) {
    ctx.save(); ctx.textAlign = 'left'; ctx.fillStyle = P.ink2; setFont(ctx, 24, FONT.ui); spacing(ctx, 2);
    ctx.fillText(`等 ${kept.length} 首`, left + 50, sy + 124 + MAX_KEPT * 46);
    ctx.restore();
  }
  footer(ctx, P, shortUrl(homeUrl()));
  return canvas;
}
export const discoveryCardName = session => `music-space-map-discovery-${fileDate(session.updated || session.created || Date.now())}.png`;

/* ---------- Preview: the finished PNG, saved or shared only on the player's click ---------- */

/** Show the PNG in a preview. 下载图片 saves it and 分享图片 (only where the browser can share files)
 *  hands it to the system sheet; nothing is saved or sent until one of them is clicked. Closing, a
 *  newer preview or leaving the page releases the image. */
export async function presentPng(canvas, { filename, title, alt, note = '' }) {
  const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
  if (!blob) throw new Error('图片没生成出来，请重试。');
  closePreview?.();
  const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  const url = URL.createObjectURL(blob);
  const dialog = document.createElement('dialog');
  dialog.className = 'share-card-export';
  dialog.dataset.motion = 'self';
  dialog.setAttribute('aria-labelledby', 'share-card-export-title');
  dialog.innerHTML = `<header class="share-card-export__header"><h2 id="share-card-export-title">${escapeHTML(title)}</h2></header>
    <img class="share-card-export__poster" alt="${escapeHTML(alt)}" width="${canvas.width}" height="${canvas.height}">
    <p class="share-card-export__hint">也可以长按图片保存</p>
    ${note ? `<p class="share-card-export__note">${escapeHTML(note)}</p>` : ''}
    <div class="share-card-export__actions"><button class="button button--primary" type="button" data-export-download>下载图片</button><button class="button" type="button" data-export-share hidden>分享图片</button><button class="button" type="button" data-export-close>关闭</button></div>
    <p class="share-card-export__error" role="alert" data-export-error hidden></p>`;
  const image = dialog.querySelector('img');
  image.src = url;
  let disposed = false;
  function dispose() {
    if (disposed) return;
    disposed = true;
    if (closePreview === dispose) closePreview = null;
    if (dialog.open) dialog.close();
    image.removeAttribute('src');
    dialog.remove();
    URL.revokeObjectURL(url);
    window.removeEventListener('popstate', dispose);
    window.removeEventListener('pagehide', dispose);
    if (opener?.isConnected) opener.focus({ preventScroll: true });
  }
  dialog.querySelector('[data-export-download]').addEventListener('click', () => {
    const link = document.createElement('a');
    link.href = url; link.download = filename;
    document.body.append(link);
    link.click(); link.remove();
  });
  dialog.querySelector('[data-export-close]').addEventListener('click', dispose);
  dialog.addEventListener('close', dispose, { once: true });
  dialog.addEventListener('click', event => {
    if (event.target !== dialog) return;
    const bounds = dialog.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) dispose();
  });
  if (typeof navigator.share === 'function' && typeof navigator.canShare === 'function') {
    const file = new File([blob], filename, { type: 'image/png' });
    let shareable = false;
    try { shareable = navigator.canShare({ files: [file] }); } catch { shareable = false; }
    if (shareable) {
      const share = dialog.querySelector('[data-export-share]');
      const error = dialog.querySelector('[data-export-error]');
      share.hidden = false;
      dialog.querySelector('.share-card-export__actions').classList.add('has-share');
      share.addEventListener('click', async () => {
        share.disabled = true; error.hidden = true;
        try { await navigator.share({ files: [file], title }); }
        catch (reason) {
          if (reason?.name !== 'AbortError' && !disposed) {
            error.textContent = '暂时无法分享，可以先下载图片。';
            error.hidden = false;
          }
        } finally { if (!disposed) share.disabled = false; }
      });
    }
  }
  closePreview = dispose;
  window.addEventListener('popstate', dispose);
  window.addEventListener('pagehide', dispose);
  document.body.append(dialog);
  dialog.showModal();
  dialog.querySelector('[data-export-close]').focus({ preventScroll: true });
  return dialog;
}
