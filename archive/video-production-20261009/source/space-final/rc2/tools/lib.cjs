// Shared helpers for the rc2 release check (room + 音乐探索 on a production build). Read-only on the repo.
const { chromium } = require('/tmp/space-video-prep/tools/node_modules/playwright-core');
const fs = require('fs');
const path = require('path');
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const VIEWPORTS = {
  phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  desktop: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 },
};
const sleep = ms => new Promise(r => setTimeout(r, ms));
const mkdir = dir => { fs.mkdirSync(dir, { recursive: true }); return dir; };

function launch() {
  return chromium.launch({ executablePath: CHROME, args: ['--use-angle=metal', '--enable-gpu'] });
}

/**
 * A fresh context (a brand-new seeded world) with a recorder for every request, response, failure, console message and page error.
 * `base` is the page URL under test (…/musicSpace/ or …/musicSpace/preview/): anything on another origin is third party, anything on this
 * origin outside base's directory is "outside the prefix".
 */
async function openContext(browser, kind, base) {
  const ctx = await browser.newContext({ ...VIEWPORTS[kind], locale: 'zh-CN' });
  const page = await ctx.newPage();
  page.setDefaultTimeout(45000);
  const b = new URL(base);
  const rec = { kind, base, requests: [], api: [], thirdParty: [], outsidePrefix: [], failed: [], badStatus: [], console: [], pageErrors: [], fonts: [], popups: [], navigations: [] };
  let phase = 'boot';
  rec.setPhase = p => { phase = p; };
  const hook = p => {
    p.on('request', req => {
      const url = req.url();
      rec.requests.push({ phase, url, method: req.method() });
      let u; try { u = new URL(url); } catch { return; }
      if (!/^https?:$/.test(u.protocol)) return;
      if (/(^|\/)api(\/|$)/.test(u.pathname)) rec.api.push(`${phase}: ${req.method()} ${u.pathname}`);
      if (u.origin !== b.origin) rec.thirdParty.push(`${phase}: ${url.slice(0, 200)}`);
      else if (!u.pathname.startsWith(b.pathname)) rec.outsidePrefix.push(`${phase}: ${u.pathname}`);
    });
    p.on('response', async res => {
      const url = res.url();
      if (res.status() >= 400) rec.badStatus.push(`${phase}: ${res.status()} ${url.slice(0, 200)}`);
      if (/\/fonts\/doodle\/.+\.woff2$/.test(url)) {
        const len = Number(res.headers()['content-length'] || 0);
        rec.fonts.push({ phase, file: url.split('/').pop(), bytes: len, page: p.url().replace(b.origin, '') });
      }
    });
    p.on('requestfailed', req => rec.failed.push(`${phase}: ${req.failure()?.errorText} ${req.url().slice(0, 200)}`));
    p.on('console', m => { if (['error', 'warning', 'assert'].includes(m.type())) rec.console.push(`${phase}: ${m.type()}: ${m.text().slice(0, 300)}`); });
    p.on('pageerror', e => rec.pageErrors.push(`${phase}: ${String(e.message || e).slice(0, 300)}`));
    p.on('framenavigated', f => { if (f === p.mainFrame()) rec.navigations.push(`${phase}: ${f.url().replace(b.origin, '')}`); });
  };
  hook(page);
  ctx.on('page', p => { rec.popups.push(p.url()); hook(p); });
  return { ctx, page, rec };
}

/** A real tap (touch viewports) or click on the first visible match; a DOM click only when the element cannot be hit (recorded). */
async function act(page, kind, target, label, rec, { timeout = 30000, index = 0 } = {}) {
  const loc = typeof target === 'string' ? page.locator(target).filter({ visible: true }).nth(index) : target;
  await loc.waitFor({ state: 'visible', timeout });
  const text = (await loc.innerText().catch(() => '')).trim().replace(/\s+/g, ' ');
  try {
    await loc.scrollIntoViewIfNeeded({ timeout: 5000 }).catch(() => {});
    if (VIEWPORTS[kind].hasTouch) await loc.tap({ timeout: 8000 }); else await loc.click({ timeout: 8000 });
  } catch (error) {
    rec.programmatic = rec.programmatic || [];
    rec.programmatic.push(`${label}: ${String(error.message).split('\n')[0].slice(0, 160)}`);
    await loc.evaluate(el => el.click());
  }
  return text;
}

/**
 * The text of the screen: document.body.innerText (rendered text only: closed dialogs, [hidden] and display:none drop out; sr-only text
 * stays), the open modal dialog's own text, the attribute texts a screen reader gets, and the Doodle font coverage of the visible text.
 */
async function dump(page) {
  return page.evaluate(async () => {
    try { await document.fonts.ready; } catch {}
    const body = document.body ? document.body.innerText : '';
    const modal = [...document.querySelectorAll('dialog[open]')].find(d => { try { return d.matches(':modal'); } catch { return false; } });
    const seen = el => (el.checkVisibility ? el.checkVisibility({ visibilityProperty: true, opacityProperty: false }) : true);
    const attrs = [];
    for (const el of document.querySelectorAll('[aria-label],[title],[placeholder],img[alt],[aria-description]')) {
      if (!el.getClientRects().length || !seen(el)) continue;
      for (const a of ['aria-label', 'title', 'placeholder', 'alt', 'aria-description']) { const v = el.getAttribute(a); if (v && /[一-鿿A-Za-z]/.test(v)) attrs.push(`@${a}: ${v}`); }
    }
    // Doodle coverage: every visible character must fall in a face of a Doodle family of its own font stack.
    const faces = [...document.fonts].map(f => ({ family: f.family.replace(/["']/g, ''), status: f.status, ranges: (f.unicodeRange || 'U+0-10FFFF').split(',').map(s => s.trim().replace(/^U\+/i, '')).map(s => { if (s.includes('-')) { const [a, b2] = s.split('-'); return [parseInt(a, 16), parseInt(b2, 16)]; } if (s.includes('?')) return [parseInt(s.replace(/\?/g, '0'), 16), parseInt(s.replace(/\?/g, 'F'), 16)]; const v = parseInt(s, 16); return [v, v]; }) }));
    const facesFor = (fam, cp) => faces.filter(f => f.family === fam && f.ranges.some(([a, b2]) => cp >= a && cp <= b2));
    const sys = {}, noDoodle = new Set(), firstMiss = {};
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      const el = node.parentElement; if (!el || !node.nodeValue.trim()) continue;
      if (el.closest('script,style,noscript,template')) continue;
      if (!el.getClientRects().length || !seen(el)) continue;
      const stack = getComputedStyle(el).fontFamily.split(',').map(s => s.trim().replace(/^["']|["']$/g, ''));
      const doodle = stack.filter(f => f.startsWith('Doodle'));
      if (!doodle.length) { noDoodle.add(`${stack[0]}: ${node.nodeValue.trim().slice(0, 30)}`); continue; }
      for (const ch of node.nodeValue) {
        const cp = ch.codePointAt(0); if (cp <= 32 || /\s/u.test(ch) || (cp >= 0xFE00 && cp <= 0xFE0F)) continue;
        let served = null;
        for (const fam of doodle) { if (facesFor(fam, cp).length) { served = fam; break; } }
        if (!served) { const k = doodle.join('>'); if (!(sys[k] || '').includes(ch)) sys[k] = (sys[k] || '') + ch; }
        else if (served !== doodle[0] && /[一-鿿]/.test(ch)) { const k = `${doodle[0]}→${served}`; if (!(firstMiss[k] || '').includes(ch)) firstMiss[k] = (firstMiss[k] || '') + ch; }
      }
    }
    return {
      url: location.pathname + location.search + location.hash,
      modal: modal ? (modal.getAttribute('aria-label') || modal.id || modal.className || 'dialog') : null,
      body, modalText: modal ? modal.innerText : null, attrs: [...new Set(attrs)],
      sysFallback: sys, noDoodle: [...noDoodle].slice(0, 30), firstMiss,
      renderStyle: document.querySelector('[data-render-style]')?.dataset.renderStyle || null,
    };
  });
}

module.exports = { chromium, launch, openContext, act, dump, sleep, mkdir, fs, path, VIEWPORTS };
