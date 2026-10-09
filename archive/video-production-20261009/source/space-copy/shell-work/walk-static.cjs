// Shell copy QA on the shared static dev server (read-only on the repo): lobby, entry, room/rooms/people/person/social/friends/blocked,
// wall, photo, leave/close/delete/withdraw/pending/create panels; overflow checks and screenshots per viewport.
const S = require('/tmp/space-copy/panels-inv/dump.cjs');
const fs = require('fs');
const OUT = '/tmp/space-copy/shell-work/shots';
S.watchdog(285);
const kind = process.argv[2] || 'phone';
const only = process.argv[3] ? process.argv[3].split(',') : null;
const want = k => !only || only.includes(k);
async function overflow(page, sel = '#panel') {
  return page.evaluate(sel => {
    const root = document.querySelector(sel); if (!root) return { missing: sel };
    const rb = root.getBoundingClientRect(); const bad = [];
    for (const el of root.querySelectorAll('*')) {
      if (!el.getClientRects().length) continue;
      const b = el.getBoundingClientRect();
      if (b.right > rb.right + 1 || b.left < rb.left - 1) bad.push(`${el.tagName.toLowerCase()}.${(el.getAttribute('class')||'').split(' ')[0]}「${el.textContent.trim().slice(0,16)}」 ${Math.round(b.left)}-${Math.round(b.right)} / ${Math.round(rb.left)}-${Math.round(rb.right)}`);
      if (el.scrollWidth > el.clientWidth + 1 && getComputedStyle(el).overflowX !== 'visible' && !['svg','canvas'].includes(el.tagName.toLowerCase())) bad.push(`scroll ${el.tagName.toLowerCase()}.${(el.getAttribute('class')||'').split(' ')[0]} ${el.scrollWidth}>${el.clientWidth}`);
    }
    const small = [...root.querySelectorAll('button,a,input[type=checkbox],input[type=radio],label')].filter(e => e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden').map(e => { const b = e.getBoundingClientRect(); return { t: e.textContent.trim().slice(0, 14) || e.getAttribute('aria-label') || e.tagName, h: Math.round(b.height), w: Math.round(b.width) }; }).filter(x => x.h < 44 && x.t);
    return { docOverflowX: document.documentElement.scrollWidth > innerWidth + 1, bad: bad.slice(0, 8), small: small.slice(0, 10) };
  }, sel);
}
const text = (page, sel = '#panel-body') => page.evaluate(sel => document.querySelector(sel)?.innerText.replace(/\n+/g, ' | ').slice(0, 900), sel);
async function sheet(page, label, open, sel = '#panel') {
  if (!want(label)) return;
  if (open) { await S.clickHidden(page, open); await S.sleep(900); }
  const o = await overflow(page, sel);
  console.log(`--- ${kind} ${label}: ${await text(page, sel === '#panel' ? '#panel-body' : sel)}`);
  console.log(`    overflow: ${JSON.stringify(o)}`);
  await S.shot(page, `${OUT}/${kind}-${label}.png`, { settle: 300 });
  for (const y of ['end']) { const h = await page.evaluate(() => { const p = document.querySelector('#panel'); return p && p.scrollHeight > p.clientHeight + 4; }); if (h) { await S.scrollTo(page, y); await S.shot(page, `${OUT}/${kind}-${label}-${y}.png`, { settle: 250 }); await S.scrollTo(page, 0); } }
}
(async () => {
  const browser = await S.launch();
  try {
    const run = await S.open(browser, kind);
    const { page } = run;
    const errors = page.__errors;
    if (want('lobby')) {
      console.log('--- lobby footer:', await page.evaluate(() => document.querySelector('footer')?.innerText));
      console.log('--- lobby caption:', await page.evaluate(() => { const c = document.querySelector('.desktop-caption'); if (!c || !c.getClientRects().length) return 'hidden'; const p = c.querySelector('p'), s = c.querySelector('small'); return { p: p && getComputedStyle(p).display !== 'none' ? p.innerText : '(p hidden)', small: s?.innerText, box: (()=>{const b=c.getBoundingClientRect();return [Math.round(b.left),Math.round(b.top),Math.round(b.right),Math.round(b.bottom)];})(), smallLines: s ? Math.round(s.getBoundingClientRect().height / parseFloat(getComputedStyle(s).lineHeight || '20')) : 0 }; }));
      console.log('--- lobby scene:', await text(page, '.world-shell .scene-heading'), '|', await text(page, '.presence'), '|', await text(page, '.track'));
      await S.shot(page, `${OUT}/${kind}-lobby.png`);
    }
    await S.enter(run);
    await S.sleep(1500);
    if (want('room-scene')) { console.log('--- room scene:', await text(page, '#scene-heading'), '|', await text(page, '#scene-code'), '|', await text(page, '.presence'), '|', await text(page, '.track'), '| status:', await text(page, '#render-status'), '| footer:', await text(page, 'footer')); await S.shot(page, `${OUT}/${kind}-room-scene.png`); }
    await sheet(page, 'room', { open: 'room' });
    await sheet(page, 'rooms', { open: 'rooms' });
    await sheet(page, 'people', { open: 'people' });
    const cast = await page.evaluate(() => [...document.querySelectorAll('#panel [data-person]')].map(b => b.dataset.person));
    if (cast[0] && want('person')) { await S.clickHidden(page, { person: cast[0] }); await S.sleep(2500); await page.waitForFunction(() => document.querySelector('#panel')?.dataset.kind === 'person' && !document.querySelector('#panel').hidden, null, { timeout: 15000 }).catch(() => {}); await sheet(page, 'person', null); }
    await sheet(page, 'social', { open: 'social' });
    await sheet(page, 'friends', { open: 'friends' });
    await sheet(page, 'blocked', { open: 'blocked' });
    await sheet(page, 'wall', { open: 'wall' });
    const theirs = await page.evaluate(() => [...document.querySelectorAll('#panel [data-photo]')].map(b => b.dataset.photo));
    if (theirs[0]) await sheet(page, 'photo-theirs', { photo: theirs[0] });
    await sheet(page, 'leave', { open: 'leave' });
    await sheet(page, 'pending', { open: 'pending' });
    await sheet(page, 'create', { open: 'create' });
    if (want('block')) { const id = cast[0]; if (id) await sheet(page, 'block-user', { open: 'block-user', id }); }
    if (want('communities')) { await S.clickHidden(page, { open: 'communities' }); await S.sleep(2500); console.log('--- communities:', await text(page, '.frame'), ); await S.shot(page, `${OUT}/${kind}-communities.png`); console.log('--- scene heading:', await text(page, '#scene-heading'), '|', await text(page, '#scene-code'), '| status:', await text(page, '#render-status')); }
    console.log('errors', JSON.stringify(errors));
    await run.context.close();
  } finally { await browser.close(); }
})().catch(e => { console.error('FAILED', e); process.exit(1); });
