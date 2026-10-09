// Long #panel sheets on the production build (fresh context): every sheet opens at its top (also right after entering and when opened from a
// scrolled sheet), and the round × stays in view, on top and at the same place while the sheet scrolls (30px steps). Sheets: ··· (room menu),
// about, upload after the reveal, recap, library (+ the wall it passes). Also the recap/library captions: 「视角：X」 on one line, the parts
// whole, nothing past the polaroid.
//   node sheets.cjs <phone|desktop|narrow> <base> <label>
const L = require('./lib.cjs');
const fs = require('fs');
L.watchdog(290);
const [, , kind = 'phone', BASE = 'http://127.0.0.1:4783/musicSpace/', label = 'sheets'] = process.argv;
const DIR = `${L.OUT}/${label}`;
fs.mkdirSync(DIR, { recursive: true });
const out = { kind, base: BASE, results: {}, failures: [] };
const fail = m => { out.failures.push(m); console.log(kind, '!! FAIL', m); };
const note = (k, v) => { out.results[k] = v; console.log(kind, k, JSON.stringify(v)); };

/** The captions under the polaroids of the open sheet, line by line (transforms off while measuring: a tilt does not move a line break). */
const captions = page => page.evaluate(() => {
  const flat = document.createElement('style');
  flat.textContent = '*{transform:none!important;rotate:none!important;animation:none!important;transition:none!important}';
  document.head.append(flat);
  try {
    return [...document.querySelectorAll('#panel .photo-item small.moment-meta, #panel .moment-meta')].filter(m => m.getClientRects().length).map(meta => {
      const rows = new Map();
      const walker = document.createTreeWalker(meta, NodeFilter.SHOW_TEXT);
      for (let n = walker.nextNode(); n; n = walker.nextNode()) {
        const p = n.parentElement, cs = getComputedStyle(p);
        if (cs.position === 'absolute' && parseFloat(cs.width) <= 1) continue; // the screen-reader 「 · 」
        for (let i = 0; i < n.data.length; i++) {
          const r = document.createRange(); r.setStart(n, i); r.setEnd(n, i + 1);
          const b = r.getBoundingClientRect();
          if (!b.width) continue;
          const key = Math.round((b.top + b.height / 2) / 8);
          const row = rows.get(key) || { y: b.top, chars: [] };
          row.chars.push({ x: b.left, ch: n.data[i] });
          rows.set(key, row);
        }
      }
      const charLines = [...rows.values()].sort((a, b) => a.y - b.y).map(r => r.chars.sort((a, b) => a.x - b.x).map(c => c.ch).join('').trim());
      // the parts (flex items, or the text runs of a plain caption) clustered into lines by vertical overlap
      const parts = [...meta.childNodes].map(n => {
        if (n.nodeType === 3) { if (!n.data.trim()) return null; const r = document.createRange(); r.selectNodeContents(n); const rs = [...r.getClientRects()]; return rs.length ? { text: n.data.trim(), rects: rs } : null; }
        const cs = getComputedStyle(n); if (cs.position === 'absolute' && parseFloat(cs.width) <= 1) return null;
        return { text: n.textContent.trim(), rects: [...n.getClientRects()] };
      }).filter(Boolean);
      const flat2 = [];
      for (const p of parts) p.rects.forEach((b, i) => flat2.push({ text: p.rects.length > 1 ? `${p.text}[${i + 1}/${p.rects.length}]` : p.text, top: b.top, bottom: b.bottom, left: b.left }));
      flat2.sort((a, b) => a.top - b.top || a.left - b.left);
      const groups = [];
      for (const f of flat2) { const g = groups.find(g => f.top < g.bottom - 2 && f.bottom > g.top + 2); if (g) { g.items.push(f); g.top = Math.min(g.top, f.top); g.bottom = Math.max(g.bottom, f.bottom); } else groups.push({ top: f.top, bottom: f.bottom, items: [f] }); }
      const lines = groups.sort((a, b) => a.top - b.top).map(g => g.items.sort((a, b) => a.left - b.left).map(i => i.text).join(' | '));
      const view = [...meta.querySelectorAll('.nowrap')].find(s => s.textContent.startsWith('视角：'));
      const host = meta.closest('.photo-item') || meta.parentElement;
      const hb = host.getBoundingClientRect(), mb = meta.getBoundingClientRect();
      const kids = [...meta.querySelectorAll('span')].filter(s => getComputedStyle(s).position !== 'absolute' && !s.querySelector('span:not(.moment-meta__sep)'));
      const past = kids.map(s => Math.round(s.getBoundingClientRect().right - hb.right)).filter(d => d > 0);
      return { where: meta.closest('.photo-item') ? 'polaroid' : 'page', html: meta.innerHTML.length, lines, viewRects: view ? view.getClientRects().length : null, viewText: view?.textContent || null,
        charLines, endsWithView: charLines.some(l => /视角：$/.test(l)), danglingDot: charLines.some(l => /^·|·$/.test(l)), pastHost: past.length ? Math.max(...past) : 0, metaPastHost: Math.round(mb.right - hb.right), width: Math.round(hb.width) };
    });
  } finally { flat.remove(); }
});

(async () => {
  const browser = await L.launch();
  let run;
  try {
    run = await L.open(browser, kind, BASE);
    const { page } = run;
    const st = () => page.evaluate(() => Math.round(document.querySelector('#panel').scrollTop));
    const kindNow = () => page.evaluate(() => document.querySelector('#panel').hidden ? null : document.querySelector('#panel').dataset.kind);
    const checkScan = async (name, { shots = true } = {}) => {
      const s = await L.scan(page);
      note(`scan:${name}`, s);
      if (s.bad.length) fail(`${name}: × not in view / not on top at ${JSON.stringify(s.bad.slice(0, 4))}`);
      if (s.drift.top > 1.5 || s.drift.right > 1.5) fail(`${name}: × moved relative to the sheet ${JSON.stringify(s.drift)}`);
      if (shots) {
        await L.scrollTo(page, 'mid'); await L.shot(page, `${DIR}/${name}-mid-${kind}.png`, { settle: 350 });
        await L.scrollTo(page, 'end'); await L.shot(page, `${DIR}/${name}-end-${kind}.png`, { settle: 350 });
        note(`close:${name}:end`, await L.closeState(page));
        await L.scrollTo(page, 0);
      }
      return s;
    };
    const opened = async (name, expectKind) => {
      const k = await kindNow(), c = await L.closeState(page);
      note(`open:${name}`, { kind: k, st: c.st, sh: c.sh, ch: c.ch, fromTop: c.fromTop, fromRight: c.fromRight, focused: c.focused, onTop: c.onTop, under: c.under });
      if (expectKind && k !== expectKind) fail(`${name}: expected sheet ${expectKind}, got ${k}`);
      if (c.st !== 0) fail(`${name}: opened at scrollTop ${c.st}, not at its top`);
      if (!c.inView || !c.onTop) fail(`${name}: × not in view/on top at open`);
      return c;
    };

    // 1) enter like a judge: the entry sheet scrolled down to the consent, then ··· right after entering
    await L.press(run, '#join');
    await page.waitForSelector('form[data-form="demo-entry"]', { timeout: 30000 });
    await L.sleep(500);
    await opened('join', 'entry');
    await page.locator('form[data-form="demo-entry"] input[name="consent"]').scrollIntoViewIfNeeded();
    note('join:scrolled-to-consent', await st());
    await page.check('form[data-form="demo-entry"] input[name="consent"]', { force: true });
    await page.waitForFunction(() => { const b = document.querySelector('form[data-form="demo-entry"] button[type="submit"]'); return b && !b.disabled; }, null, { timeout: 90000 });
    await L.press(run, 'form[data-form="demo-entry"] button[type="submit"]');
    await page.waitForSelector('[data-tour-action="sample:sample-crowd"]', { timeout: 60000 });
    await L.sleep(1500);

    await L.press(run, '#room-info');
    await L.sleep(500);
    await opened('menu', 'room');
    await L.shot(page, `${DIR}/menu-top-${kind}.png`);
    await checkScan('menu');

    // 2) about from the footer while ··· is scrolled to its end
    await L.scrollTo(page, 'end');
    note('menu:scrolled-before-about', await st());
    const footerAbout = page.locator('#evidence [data-open="about"]');
    await L.press(run, footerAbout);
    await page.waitForFunction(() => document.querySelector('#panel')?.dataset.kind === 'about', null, { timeout: 20000 });
    await L.sleep(500);
    await opened('about', 'about');
    await L.shot(page, `${DIR}/about-top-${kind}.png`);
    await checkScan('about');
    await L.press(run, '#panel-close');
    await L.sleep(400);

    // 3) upload after the reveal
    await L.press(run, '[data-tour-action="sample:sample-crowd"]');
    await page.waitForSelector('form[data-form="upload"] .photo-review', { timeout: 30000 });
    const settled = await L.aiSettled(page);
    await L.sleep(1600);
    const reveal = await L.closeState(page);
    const taken = await page.evaluate(() => { const p = document.querySelector('#panel').getBoundingClientRect(); const t = document.querySelector('form.moment-upload .moment-taken'); const time = t && [...t.querySelectorAll('*')].find(e => /^拍摄于/.test(e.textContent.trim()) && !e.children.length) || null; const chip = document.querySelector('form.moment-upload .moment-chip[aria-pressed="true"]'); const R = e => e ? (b => [Math.round(b.left - p.left), Math.round(b.top - p.top), Math.round(b.right - p.left), Math.round(b.bottom - p.top)])(e.getBoundingClientRect()) : null; return { time: R(time), timeText: time?.textContent.trim(), chip: R(chip) }; });
    note('upload:reveal', { settled, st: reveal.st, close: reveal.close, fromTop: reveal.fromTop, fromRight: reveal.fromRight, onTop: reveal.onTop, inView: reveal.inView, under: reveal.under, ...taken });
    if (!reveal.inView || !reveal.onTop) fail('upload reveal: × not in view/on top');
    if (reveal.under.length) fail(`upload reveal: × covers ${JSON.stringify(reveal.under)}`);
    await L.shot(page, `${DIR}/upload-reveal-${kind}.png`);
    const upScan = await L.scan(page);
    note('scan:upload', upScan);
    if (upScan.bad.length) fail(`upload: × not in view / not on top at ${JSON.stringify(upScan.bad.slice(0, 4))}`);
    if (upScan.drift.top > 1.5 || upScan.drift.right > 1.5) fail(`upload: × moved relative to the sheet ${JSON.stringify(upScan.drift)}`);
    await L.scrollTo(page, 'end'); await L.shot(page, `${DIR}/upload-end-${kind}.png`, { settle: 350 });
    note('close:upload:end', await L.closeState(page));
    const chosen = await page.evaluate(() => Boolean(document.querySelector('form[data-form="upload"] .moment-chip[aria-pressed="true"]')));
    if (!chosen) await L.press(run, 'form[data-form="upload"] .moment-chip[data-moment-viewpoint="crowd"]');
    await L.press(run, 'form[data-form="upload"] button[type="submit"]');
    await page.locator('#panel [data-moment-badge] [data-exchange-offer]').first().waitFor({ state: 'attached', timeout: 45000 });
    await page.waitForFunction(() => [...document.querySelectorAll('#panel .moment-card img')].every(i => i.complete && i.naturalWidth), null, { timeout: 30000 }).catch(() => {});
    await L.sleep(1200);
    note('wall:open', { kind: await kindNow(), st: await st() });
    if ((await st()) !== 0) fail('wall: did not open at its top after the save');
    const wallCaps = await captions(page);
    note('wall:captions', wallCaps.slice(0, 4));
    await checkScan('wall', { shots: false });
    await L.press(run, '#panel-close');
    await L.sleep(400);

    // 4) recap from a scrolled ··· (its button scrolled to the sheet's top edge)
    await L.press(run, '#room-info');
    await L.sleep(500);
    await opened('menu-again', 'room');
    await page.evaluate(() => { const p = document.querySelector('#panel'), b = p.querySelector('[data-open="recap"]'); p.scrollTop += b.getBoundingClientRect().top - p.getBoundingClientRect().top - 80; });
    note('menu:scrolled-before-recap', await st());
    await L.press(run, '#panel [data-open="recap"]');
    await page.waitForFunction(() => document.querySelector('#panel')?.dataset.kind === 'recap', null, { timeout: 20000 });
    await L.sleep(300);
    await opened('recap', 'recap');
    await page.waitForSelector('.panel[data-kind="recap"] .photo-grid .photo-item img', { timeout: 30000 });
    await page.waitForFunction(() => [...document.querySelectorAll('#panel .photo-item img')].every(i => i.complete && i.naturalWidth), null, { timeout: 30000 }).catch(() => {});
    await L.sleep(900);
    note('recap:after-load-st', await st());
    await L.shot(page, `${DIR}/recap-top-${kind}.png`);
    const recapCaps = await captions(page);
    note('recap:captions', recapCaps);
    for (const c of recapCaps) {
      if (c.endsWithView || (c.viewRects !== null && c.viewRects !== 1)) fail(`recap caption breaks after 「视角：」: ${JSON.stringify(c.lines)}`);
      if (c.danglingDot) fail(`recap caption has a dangling dot: ${JSON.stringify(c.lines)}`);
      if (c.pastHost > 1 || c.metaPastHost > 1) fail(`recap caption runs past its polaroid by ${Math.max(c.pastHost, c.metaPastHost)}px: ${JSON.stringify(c.lines)}`);
    }
    // the captions in view for a crop
    const capBox = await page.evaluate(() => { const m = [...document.querySelectorAll('#panel .photo-item small.moment-meta')][0]; if (!m) return null; m.closest('.photo-item').scrollIntoView({ block: 'center' }); const g = m.closest('.photo-grid').getBoundingClientRect(); return { x: Math.max(0, Math.floor(g.left) - 6), y: Math.max(0, Math.floor(g.top) - 6), width: Math.min(innerWidth - Math.max(0, Math.floor(g.left) - 6), Math.ceil(g.width) + 12), height: Math.min(innerHeight - Math.max(0, Math.floor(g.top) - 6), Math.ceil(g.height) + 12) }; });
    if (capBox) await L.shot(page, `${DIR}/recap-captions-${kind}.png`, { clip: capBox });
    await L.scrollTo(page, 0);
    await checkScan('recap');
    await L.press(run, '#panel-close');
    await L.sleep(400);

    // 5) library: ··· → 我的现场 → 我的照片
    await L.press(run, '#room-info');
    await L.sleep(500);
    await L.press(run, '#panel [data-open="rooms"]');
    await page.waitForFunction(() => document.querySelector('#panel')?.dataset.kind === 'rooms', null, { timeout: 20000 });
    await L.sleep(600);
    await opened('rooms', 'rooms');
    const lib = page.locator('#panel [data-open="library"]').first();
    await lib.scrollIntoViewIfNeeded();
    note('rooms:scrolled-before-library', await st());
    await L.press(run, lib);
    await page.waitForFunction(() => document.querySelector('#panel')?.dataset.kind === 'library', null, { timeout: 20000 });
    await L.sleep(300);
    await opened('library', 'library');
    await page.waitForFunction(() => [...document.querySelectorAll('#panel .photo-item img')].length > 0 && [...document.querySelectorAll('#panel .photo-item img')].every(i => i.complete && i.naturalWidth), null, { timeout: 30000 }).catch(() => {});
    await L.sleep(900);
    await L.shot(page, `${DIR}/library-top-${kind}.png`);
    const libCaps = await captions(page);
    note('library:captions', libCaps);
    if (!libCaps.length) fail('library: no captions found');
    for (const c of libCaps) {
      if (c.endsWithView || (c.viewRects !== null && c.viewRects !== 1)) fail(`library caption breaks after 「视角：」: ${JSON.stringify(c.lines)}`);
      if (c.danglingDot) fail(`library caption has a dangling dot: ${JSON.stringify(c.lines)}`);
      if (c.pastHost > 1 || c.metaPastHost > 1) fail(`library caption runs past its polaroid by ${Math.max(c.pastHost, c.metaPastHost)}px: ${JSON.stringify(c.lines)}`);
    }
    // the photo's own page from the library: its caption too
    await L.press(run, '#panel .photo-item');
    await page.waitForFunction(() => document.querySelector('#panel')?.dataset.kind === 'photo', null, { timeout: 20000 });
    await L.sleep(900);
    await opened('photo', 'photo');
    const photoCaps = await captions(page);
    note('photo:captions', photoCaps);
    for (const c of photoCaps) if (c.endsWithView || (c.viewRects !== null && c.viewRects !== 1) || c.danglingDot) fail(`photo page caption breaks badly: ${JSON.stringify(c.lines)}`);
    await L.shot(page, `${DIR}/photo-page-${kind}.png`);
  } catch (e) { fail('EXCEPTION ' + e.message.split('\n')[0]); }
  finally {
    const log = run?.log || {};
    Object.assign(out, { api: log.api, foreign: log.foreign, failedRequests: log.failedRequests, consoleErrors: log.consoleErrors, pageErrors: log.pageErrors });
    for (const k of ['api', 'foreign', 'consoleErrors', 'pageErrors']) if (out[k]?.length) fail(`${k}: ${JSON.stringify(out[k].slice(0, 4))}`);
    out.ok = !out.failures.length;
    fs.writeFileSync(`${DIR}/sheets-${kind}.json`, JSON.stringify(out, null, 1));
    console.log(kind, 'failedRequests', JSON.stringify(out.failedRequests || []));
    console.log(kind, out.ok ? 'RESULT: PASS' : `RESULT: FAIL ${JSON.stringify(out.failures)}`);
    await browser.close();
    process.exit(out.ok ? 0 : 1);
  }
})();
