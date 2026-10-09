// Shared helpers for the unified-map verification walks.
const { chromium } = require('/tmp/space-video-prep/tools/node_modules/playwright-core');
const fs = require('fs');
const path = require('path');
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const ORIGIN = process.env.ORIGIN || 'http://127.0.0.1:5633';
const VIEWPORTS = {
  phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  desktop: { viewport: { width: 1440, height: 900 } },
  w320: { viewport: { width: 320, height: 640 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  w320s: { viewport: { width: 320, height: 568 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
};
const BANNED = ['仅保存', '清除浏览器', '虚构', '示例', '情景', '不构成', '授权', 'bsd', 'BSD', '离线', '说明', '本地', '浏览器', '演示', '模拟', '未核', '核对', '核实', '真实', '不代表', '存储', '只存', '不是真人', '自动回复', 'Music Map', '策展', '夜场', '樱下', '原版', '数据卡', '许可', '仅供', '不一定', '免责', '注意', '提示：', '请注意', '本专题'];

async function launch(args = []) {
  const gpu = process.env.NOGL ? ['--disable-webgl', '--disable-3d-apis'] : ['--use-angle=metal', '--enable-gpu'];
  return chromium.launch({ executablePath: CHROME, args: [...gpu, ...args] });
}

/** A fresh context + page with listeners that record console problems, failed requests and every URL requested. */
async function open(browser, kind, extra = {}) {
  const ctx = await browser.newContext({ ...VIEWPORTS[kind], ...extra });
  const page = await ctx.newPage();
  const rec = { console: [], pageerrors: [], failed: [], bad: [], requests: [], popups: [] };
  const hook = p => {
    p.on('console', m => { if (['error', 'warning', 'assert'].includes(m.type())) rec.console.push(`${m.type()}: ${m.text().slice(0, 300)} @${p.url().replace(ORIGIN, '')}`); });
    p.on('pageerror', e => rec.pageerrors.push(String(e).slice(0, 300)));
    p.on('requestfailed', r => rec.failed.push(`${r.failure()?.errorText} ${r.url()}`));
    p.on('response', r => { if (r.status() >= 400) rec.bad.push(`${r.status()} ${r.url()}`); });
    p.on('request', r => rec.requests.push(r.url()));
  };
  hook(page);
  ctx.on('page', p => { rec.popups.push(p.url()); hook(p); });
  return { ctx, page, rec };
}

function outside(rec) {
  return [...new Set(rec.requests.filter(u => !u.startsWith('data:') && !u.startsWith('blob:') && !u.startsWith(ORIGIN + '/musicSpace/')))];
}

/** Everything a reader of the screen gets at this moment, plus the audits. */
async function audit(page, opts = {}) {
  return page.evaluate(async ({ banned }) => {
    await document.fonts.ready;
    const vw = document.documentElement.clientWidth, vh = window.innerHeight;
    const modal = [...document.querySelectorAll('dialog[open]')].find(d => { try { return d.matches(':modal'); } catch { return false; } });
    const scope = modal || document.body;
    const seen = el => el.checkVisibility ? el.checkVisibility({ visibilityProperty: true, opacityProperty: true }) : true;
    const label = el => (el.getAttribute('aria-label') || el.innerText || el.value || el.className || el.tagName).toString().replace(/\s+/g, ' ').trim().slice(0, 40);
    // ---- text
    const text = (modal ? modal.innerText : document.body.innerText).replace(/[ \t]+/g, ' ');
    const hits = [];
    for (const word of banned) {
      let i = text.indexOf(word);
      while (i >= 0) { hits.push(`${word} … ${text.slice(Math.max(0, i - 24), i + word.length + 24).replace(/\s+/g, ' ')}`); i = text.indexOf(word, i + word.length); }
    }
    // ---- tap targets
    const SEL = 'a[href],button,input:not([type=hidden]),select,textarea,summary,[role=button],[role=link],[tabindex]:not([tabindex="-1"])';
    const small = [];
    for (const el of scope.querySelectorAll(SEL)) {
      if (!seen(el) || el.closest('[inert]') || el.disabled) continue;
      if (getComputedStyle(el).pointerEvents === 'none') continue;
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height || r.bottom <= 0 || r.top >= vh || r.right <= 0 || r.left >= vw) continue;
      if (r.width >= 43.5 && r.height >= 43.5) continue;
      // effective hit area: probe ±21px from the centre
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      const hit = (x, y) => { if (x < 0 || y < 0 || x >= vw || y >= vh) return false; const t = document.elementFromPoint(x, y); return !!t && (t === el || el.contains(t)); };
      const effW = hit(cx - 21, cy) && hit(cx + 21, cy), effH = hit(cx, cy - 21) && hit(cx, cy + 21);
      const centre = hit(cx, cy);
      if (effW && effH) continue;
      const inline = getComputedStyle(el).display === 'inline';
      small.push(`${label(el)} [${el.tagName.toLowerCase()}.${String(el.className).split(' ')[0]}] ${Math.round(r.width)}x${Math.round(r.height)}${inline ? ' inline' : ''}${centre ? '' : ' covered'}`);
    }
    // ---- overflow
    const docW = Math.max(document.documentElement.scrollWidth, document.body.scrollWidth);
    const over = [];
    const scrollerX = el => { for (let a = el.parentElement; a; a = a.parentElement) { const s = getComputedStyle(a); if (/(auto|scroll)/.test(s.overflowX) && a.scrollWidth > a.clientWidth + 1) return true; } return false; };
    for (const el of scope.querySelectorAll('*')) {
      if (!seen(el) || el.closest('[aria-hidden="true"]') || el.closest('canvas') || el.tagName === 'CANVAS') continue;
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height || r.bottom <= 0 || r.top >= vh * 4) continue;
      if (r.right <= vw + 1 && r.left >= -1) continue;
      const own = [...el.childNodes].some(n => n.nodeType === 3 && n.nodeValue.trim()) || el.matches('button,a,input,select,summary,img,svg');
      if (!own) continue;
      if (scrollerX(el)) continue;
      over.push(`${label(el)} [${el.tagName.toLowerCase()}.${String(el.className).split(' ')[0]}] x ${Math.round(r.left)}..${Math.round(r.right)}`);
    }
    // ---- clipped text (own box)
    const clipped = [];
    for (const el of scope.querySelectorAll('h1,h2,h3,p,span,strong,b,small,button,a,summary,label,li,td,th')) {
      if (!seen(el)) continue;
      const s = getComputedStyle(el);
      if (!/(hidden|clip)/.test(s.overflowX + s.overflowY) && s.textOverflow !== 'ellipsis') continue;
      const r = el.getBoundingClientRect(); if (!r.width || r.bottom <= 0 || r.top >= vh) continue;
      if (el.scrollWidth > el.clientWidth + 2 || el.scrollHeight > el.clientHeight + 2) clipped.push(`${label(el)} ${el.scrollWidth}/${el.clientWidth}w ${el.scrollHeight}/${el.clientHeight}h`);
    }
    // ---- fonts
    const faces = [...document.fonts].map(f => ({ family: f.family.replace(/["']/g, ''), status: f.status, ranges: (f.unicodeRange || 'U+0-10FFFF').split(',').map(s => s.trim().replace(/^U\+/i, '')).map(s => { if (s.includes('-')) { const [a, b] = s.split('-'); return [parseInt(a, 16), parseInt(b, 16)]; } if (s.includes('?')) return [parseInt(s.replace(/\?/g, '0'), 16), parseInt(s.replace(/\?/g, 'F'), 16)]; const v = parseInt(s, 16); return [v, v]; }) }));
    const facesFor = (fam, cp) => faces.filter(f => f.family === fam && f.ranges.some(([a, b]) => cp >= a && cp <= b));
    const fontStatus = {};
    for (const f of faces) { fontStatus[f.family] ||= { loaded: 0, unloaded: 0, error: 0, loading: 0 }; fontStatus[f.family][f.status]++; }
    const sys = {}, firstMiss = {}, notLoaded = {}, nodoodle = new Set();
    const walker = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      const el = node.parentElement; if (!el || !node.nodeValue.trim()) continue;
      if (el.closest('script,style,noscript,.sr-only,[aria-hidden="true"] .sr-only')) continue;
      if (!seen(el)) continue;
      const r = el.getBoundingClientRect(); if (!r.width || !r.height) continue;
      const stack = getComputedStyle(el).fontFamily.split(',').map(s => s.trim().replace(/^["']|["']$/g, ''));
      const doodle = stack.filter(f => f.startsWith('Doodle'));
      if (!doodle.length) { nodoodle.add(`${stack[0]}: ${node.nodeValue.trim().slice(0, 30)}`); continue; }
      for (const ch of node.nodeValue) {
        const cp = ch.codePointAt(0); if (cp <= 32 || /\s/u.test(ch) || (cp >= 0xFE00 && cp <= 0xFE0F)) continue;
        let served = null;
        for (const fam of doodle) { const fs = facesFor(fam, cp); if (fs.length) { served = fam; if (!fs.some(f => f.status === 'loaded')) notLoaded[fam] = (notLoaded[fam] || '') + ch; break; } }
        if (served && served !== doodle[0]) { const k = `${doodle[0]}→${served}`; if (!(firstMiss[k] || '').includes(ch)) firstMiss[k] = (firstMiss[k] || '') + ch; }
        if (!served) { const k = doodle.join('>'); if (!(sys[k] || '').includes(ch)) sys[k] = (sys[k] || '') + ch; }
      }
    }
    const world = document.querySelector('#sakura-world');
    return {
      url: location.pathname + location.search + location.hash, title: document.title, vw, docW,
      renderStyle: world?.dataset.renderStyle || null, worldHidden: world ? world.hidden : null, look: document.documentElement.dataset.look,
      modal: modal ? modal.getAttribute('aria-label') || modal.id || modal.className : null,
      text, hits, small, over, clipped: clipped.slice(0, 30), fontStatus, sysFallback: sys, firstMiss, notLoaded, noDoodle: [...nodoodle].slice(0, 20),
    };
  }, { banned: BANNED });
}

function mkdir(dir) { fs.mkdirSync(dir, { recursive: true }); return dir; }

module.exports = { launch, open, audit, outside, ORIGIN, VIEWPORTS, BANNED, mkdir, fs, path };
