// DOM details: landing title lines, card container; room hotspots (anchor data), context bar, footer.
import { launch, DESKTOP1X } from './rig.mjs';
import { openApp, enterAsAning, waitForCast, skipTour, sleep } from './flow4k.mjs';
const browser = await launch();
let s;
try {
  s = await openApp(browser, DESKTOP1X, { cursor: false, name: 'probe2' });
  const p = s.page;
  const land = await p.evaluate(() => {
    const st = [...document.querySelectorAll('strong')].find(e => /同一刻/.test(e.textContent) && /另一面/.test(e.textContent));
    const lines = [];
    if (st) { const w = document.createTreeWalker(st, NodeFilter.SHOW_TEXT); let n; while ((n = w.nextNode())) { const r = document.createRange(); r.selectNodeContents(n); const rects = [...r.getClientRects()].map(b => [b.left, b.top, b.width, b.height].map(Math.round)); lines.push({ t: n.textContent, rects }); } }
    let card = st; for (let i = 0; i < 6 && card; i++) { card = card.parentElement; if (card && getComputedStyle(card).borderTopWidth !== '0px') break; }
    const cb = card?.getBoundingClientRect();
    return { strongHTML: st?.outerHTML.slice(0, 400), lines, card: card ? { tag: card.tagName, cls: card.className, box: [cb.left, cb.top, cb.width, cb.height].map(Math.round) } : null, header: document.querySelector('header')?.innerText.replace(/\s+/g, ' '), footer: [...document.querySelectorAll('footer, [data-open="about"]')].map(e => `${e.tagName}.${e.className}:${e.innerText.replace(/\s+/g, ' ').slice(0, 60)}`) };
  });
  console.log('LANDING', JSON.stringify(land, null, 1));
  await enterAsAning(s); await waitForCast(s); await skipTour(s); await sleep(1200);
  const room = await p.evaluate(() => [...document.querySelectorAll('#hotspots .hotspot')].map(e => { const b = e.getBoundingClientRect(); return { kind: e.dataset.kind, text: e.innerText.replace(/\s+/g, ' ').trim(), box: [b.left, b.top, b.width, b.height].map(Math.round), style: e.getAttribute('style'), attrs: [...e.attributes].map(a => a.name).join(','), html: e.outerHTML.slice(0, 300) }; }));
  console.log('HOTSPOTS', JSON.stringify(room, null, 1));
  const misc = await p.evaluate(() => { const q = sel => { const e = document.querySelector(sel); if (!e) return null; const b = e.getBoundingClientRect(); return { box: [b.left, b.top, b.width, b.height].map(Math.round), text: e.innerText?.replace(/\s+/g, ' ').slice(0, 80) }; }; return { world: q('#world'), canvas: q('#world canvas') || q('canvas'), ctx: q('#context-actions'), presence: q('.presence-card, .room-presence, [data-presence]'), footer: q('[data-open="about"]'), nav: q('nav.camera-nav'), title: q('.room-title, .event-title, h1'), song: q('.song-card, .now-playing, [data-song]') }; });
  console.log('MISC', JSON.stringify(misc, null, 1));
  const songBtn = await p.evaluate(() => [...document.querySelectorAll('button, [role=button]')].filter(b => /晚班列车|ENCORE|♪/.test(b.innerText)).map(b => `${b.tagName}.${b.className}|${b.getAttribute('aria-label')}|${b.innerText.replace(/\s+/g, ' ')}`));
  console.log('SONG', JSON.stringify(songBtn));
} catch (e) { console.error('FAILED', e); }
finally { await s?.ctx.close().catch(() => {}); await browser.close(); }
