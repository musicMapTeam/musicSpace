// Art-direction critique helpers (read-only: never touches the repo).
const { chromium } = require('/tmp/space-video-prep/tools/node_modules/playwright-core');
const fs = require('fs');
const path = require('path');
const URL = process.env.SPACE_URL || 'http://127.0.0.1:5190/';
const OUT = process.env.OUT || '/tmp/space-doodle/critique/art/raw';
const RANGES = JSON.parse(fs.readFileSync(path.join(__dirname, 'font-ranges.json'), 'utf8'));
const VP = {
  phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  desktop: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 },
  narrow: { viewport: { width: 320, height: 640 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
};
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function launch() { return chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' }); }
async function open(browser, kind, { waitReady = true, query = '' } = {}) {
  const ctx = await browser.newContext({ ...VP[kind], acceptDownloads: true });
  const page = await ctx.newPage();
  page.__logs = [];
  page.on('pageerror', e => { page.__logs.push('pageerror: ' + e.message.slice(0, 200)); console.log('[pageerror]', e.message.slice(0, 200)); });
  page.on('console', m => { if (m.type() === 'error') page.__logs.push('console.error: ' + m.text().slice(0, 200)); });
  await page.goto(URL + query, { waitUntil: 'domcontentloaded' });
  if (waitReady) await ready(page);
  return { ctx, page };
}
async function ready(page) {
  await page.waitForFunction(() => window.__SPACE_BOOT__ === 'ready', null, { timeout: 90000 });
  await page.waitForFunction(() => document.querySelector('#loading')?.hidden === true, null, { timeout: 60000 }).catch(() => console.log('loading never hid'));
  await page.evaluate(() => document.fonts.ready).catch(() => {});
  await sleep(900);
}
async function enter(page) {
  if (!(await page.locator('form[data-form="demo-entry"]').count())) await page.locator('button:visible', { hasText: '进入示例现场' }).first().click();
  await page.waitForSelector('form[data-form="demo-entry"]', { timeout: 20000 });
  await page.locator('form[data-form="demo-entry"] input[name=consent]').check();
  await page.waitForSelector('form[data-form="demo-entry"] button[type=submit]:not([disabled])', { timeout: 60000 });
  await page.locator('form[data-form="demo-entry"] button[type=submit]').click();
  await page.waitForFunction(() => !document.querySelector('form[data-form="demo-entry"]'), null, { timeout: 60000 });
  await page.waitForFunction(() => (window.__SPACE_EVENT_QA__?.()?.members || []).length > 1, null, { timeout: 30000 }).catch(() => console.log('members never arrived'));
  await sleep(2200);
}
async function shot(page, name, kind, opts = {}) {
  fs.mkdirSync(OUT, { recursive: true });
  const file = path.join(OUT, `${name}-${kind}.png`);
  if (!opts.keepFocus) await page.evaluate(() => document.activeElement?.blur?.()).catch(() => {});
  await sleep(opts.settle ?? 500);
  await page.screenshot({ path: file, fullPage: !!opts.fullPage, ...(opts.clip ? { clip: opts.clip } : {}) });
  console.log('saved', file);
  if (opts.audit !== false) {
    const a = await audit(page, opts.scope);
    fs.writeFileSync(file.replace(/\.png$/, '.audit.json'), JSON.stringify(a, null, 1));
    const n = Object.entries(a).map(([k, v]) => `${k}:${Array.isArray(v) ? v.length : v}`).join(' ');
    console.log('  audit', n);
  }
  return file;
}
async function openKind(page, kind, id) {
  await page.evaluate(([k, i]) => { const b = document.createElement('button'); b.dataset.open = k; if (i) b.dataset.id = i; b.style.position = 'fixed'; b.style.left = '-9999px'; document.body.append(b); b.click(); b.remove(); }, [kind, id]);
  await sleep(1000);
}
async function people(page) { return page.evaluate(() => [...document.querySelectorAll('#hotspots [data-kind="person"]')].map(n => ({ id: n.dataset.sceneTarget, label: n.textContent.trim() }))); }
async function closeEverything(page) {
  await page.evaluate(() => { for (const sel of ['.wardrobe:not([hidden]) .wardrobe-header>button', '.private-chat:not([hidden]) .chat-close', '.room-moderation:not([hidden]) header>button', '.photo-exchanges:not([hidden]) [data-x-close]']) { const b = document.querySelector(sel); if (b && b.getClientRects().length) b.click(); } }).catch(() => {});
  await sleep(300);
  for (let i = 0; i < 3; i++) { await page.keyboard.press('Escape').catch(() => {}); await sleep(150); }
  await page.evaluate(() => { const c = document.querySelector('#panel-close'); if (c && !document.querySelector('#panel').hidden) c.click(); });
  await sleep(400);
}
// Visible-screen audit: non-doodle fonts, glyph fallbacks, off-token colours, tiny text, white text on marker fills, clipped text.
async function audit(page, scope) {
  return page.evaluate(([RANGES, scope]) => {
    const TOK = { paper: '#f7efdf', card: '#fffaf0', deep: '#efe3c8', ink: '#1c1b1a', ink2: '#3d3a36', ink3: '#6b655c', pink: '#ff5c8a', pinks: '#ffd0dd', mint: '#5fdcc0', mints: '#c9f3e8', yellow: '#ffd447', yellows: '#fff0b8', sky: '#74b9ff', skys: '#d6e9ff', orange: '#ff8a3d', night: '#23212b', white: '#ffffff', black: '#000000' };
    const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
    const toks = Object.entries(TOK).map(([k, v]) => [k, hex(v)]);
    const parse = c => { const m = c && c.match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return { rgb: p.slice(0, 3), a: p.length > 3 ? p[3] : 1 }; };
    const near = rgb => { let best = null; for (const [k, t] of toks) { const d = Math.hypot(rgb[0] - t[0], rgb[1] - t[1], rgb[2] - t[2]); if (!best || d < best[1]) best = [k, d]; } return best; };
    const inRange = (fam, cp) => { const r = RANGES[fam]; if (!r) return true; for (const [a, b] of r) if (cp >= a && cp <= b) return true; return false; };
    const vis = el => { if (!el.getClientRects().length) return false; const cs = getComputedStyle(el); if (cs.visibility === 'hidden' || cs.opacity === '0') return false; const r = el.getBoundingClientRect(); if (r.width < 1 || r.height < 1) return false; if (r.bottom < 0 || r.top > innerHeight || r.right < 0 || r.left > innerWidth) return false; for (let n = el; n; n = n.parentElement) { const s = getComputedStyle(n); if (s.opacity === '0' || s.display === 'none') return false; if (n.hidden) return false; } return true; };
    const desc = el => { let s = el.tagName.toLowerCase(); if (el.id) s += '#' + el.id; const c = (typeof el.className === 'string' ? el.className : '').trim().split(/\s+/).filter(Boolean).slice(0, 3); if (c.length) s += '.' + c.join('.'); const p = el.parentElement; if (p && !el.id) { let ps = p.tagName.toLowerCase(); if (p.id) ps += '#' + p.id; const pc = (typeof p.className === 'string' ? p.className : '').trim().split(/\s+/).filter(Boolean).slice(0, 2); if (pc.length) ps += '.' + pc.join('.'); s = ps + '>' + s; } return s; };
    const root = scope ? document.querySelector(scope) || document.body : document.body;
    const out = { fonts: [], glyphs: [], colors: [], tiny: [], whiteOnMarker: [], clipped: [], blurShadow: [] };
    const seenC = new Set();
    const els = [root, ...root.querySelectorAll('*')];
    for (const el of els) {
      if (['SCRIPT', 'STYLE', 'svg', 'path', 'CANVAS', 'TEMPLATE', 'NOSCRIPT', 'defs', 'filter'].includes(el.tagName)) continue;
      if (!vis(el)) continue;
      const cs = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      const ownText = [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent).join('').replace(/\s+/g, ' ').trim();
      const fam = cs.fontFamily.split(',')[0].trim().replace(/^["']|["']$/g, '');
      const size = parseFloat(cs.fontSize);
      if (ownText && !(cs.clipPath === 'inset(50%)' || el.classList.contains('sr-only') || (r.width <= 1 && r.height <= 1))) {
        if (!/^Doodle /.test(fam) && cs.color !== 'rgba(0, 0, 0, 0)' && parseFloat(cs.fontSize) > 0) out.fonts.push(`${desc(el)} [${fam} ${size}px] «${ownText.slice(0, 30)}»`);
        else {
          const miss = [...new Set([...ownText].filter(ch => ch.trim() && !inRange(fam, ch.codePointAt(0))))];
          if (miss.length) out.glyphs.push(`${desc(el)} [${fam}] missing «${miss.join('')}» in «${ownText.slice(0, 24)}»`);
        }
        if (size < 12 && cs.color !== 'rgba(0, 0, 0, 0)') out.tiny.push(`${desc(el)} ${size}px «${ownText.slice(0, 24)}»`);
        // white/cream text on a marker fill
        const fg = parse(cs.color);
        if (fg && fg.rgb.every(v => v > 235) && size < 24) {
          let bgEl = el, bg = null;
          while (bgEl) { const b = parse(getComputedStyle(bgEl).backgroundColor); if (b && b.a > .5) { bg = b; break; } bgEl = bgEl.parentElement; }
          if (bg) { const n = near(bg.rgb); if (['pink', 'mint', 'yellow', 'sky', 'orange'].includes(n[0]) && n[1] < 40) out.whiteOnMarker.push(`${desc(el)} ${size}px on ${n[0]} «${ownText.slice(0, 24)}»`); }
        }
        if ((cs.overflow === 'hidden' || cs.textOverflow === 'ellipsis' || cs.webkitLineClamp !== 'none') && (el.scrollWidth > el.clientWidth + 2 || el.scrollHeight > el.clientHeight + 3) && cs.whiteSpace !== 'normal' || (cs.textOverflow === 'ellipsis' && el.scrollWidth > el.clientWidth + 2)) out.clipped.push(`${desc(el)} sw ${el.scrollWidth}>${el.clientWidth} «${ownText.slice(0, 30)}»`);
      }
      const props = [['color', ownText ? cs.color : null], ['bg', cs.backgroundColor]];
      for (const side of ['Top', 'Right', 'Bottom', 'Left']) if (parseFloat(cs['border' + side + 'Width']) > 0 && cs['border' + side + 'Style'] !== 'none') props.push(['border' + side, cs['border' + side + 'Color']]);
      for (const [k, v] of props) {
        const p = parse(v); if (!p || p.a < .15) continue;
        const n = near(p.rgb);
        if (n[1] > 18) { const key = desc(el) + k; if (!seenC.has(key)) { seenC.add(key); out.colors.push(`${desc(el)} ${k}=${v} (nearest ${n[0]} d${Math.round(n[1])})${ownText ? ' «' + ownText.slice(0, 18) + '»' : ''}`); } }
      }
      if (cs.boxShadow && cs.boxShadow !== 'none') {
        const blurs = [...cs.boxShadow.matchAll(/(-?[\d.]+)px (-?[\d.]+)px ([\d.]+)px/g)].filter(m => parseFloat(m[3]) > 1.5 && !/inset/.test(cs.boxShadow));
        if (blurs.length) out.blurShadow.push(`${desc(el)} ${cs.boxShadow.slice(0, 90)}`);
      }
    }
    for (const k of Object.keys(out)) out[k] = out[k].slice(0, 60);
    out.renderStyle = window.__SPACE_EVENT_QA__?.()?.camera?.scene?.renderStyle || null;
    return out;
  }, [RANGES, scope || null]);
}
function watchdog(sec = 280) { setTimeout(() => { console.error(`watchdog: giving up after ${sec}s`); process.exit(2); }, sec * 1000).unref(); }
module.exports = { launch, open, ready, enter, shot, openKind, people, closeEverything, audit, sleep, watchdog, URL, OUT, VP };
