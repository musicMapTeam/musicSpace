// App fixer: where the name tags sit against the presence/tour card on landscape sizes right after joining (4 members) and after 林间 joins (5).
const L = require('/tmp/space-doodle/critique/art/tools/lib.cjs');
const OUT = process.env.OUT || '/tmp/space-doodle/fix/app/raw';
const sizes = (process.argv[2] || '1440x900,1280x800,1920x1080,1366x768,1536x864,1440x790,1024x768').split(',').map(s => s.split('x').map(Number));
L.watchdog(280);
(async () => {
  const b = await L.launch();
  for (const [w, h] of sizes) {
    const ctx = await b.newContext({ viewport: { width: w, height: h } });
    const page = await ctx.newPage();
    try {
      await page.goto(L.URL, { waitUntil: 'domcontentloaded' });
      await L.ready(page);
      await L.enter(page);
      const measure = async label => {
        const m = await page.evaluate(() => {
          const r = el => { if (!el) return null; const b = el.getBoundingClientRect(); return [Math.round(b.left), Math.round(b.top), Math.round(b.right), Math.round(b.bottom)]; };
          const card = document.querySelector('.presence');
          const tags = [...document.querySelectorAll('#hotspots .hotspot')].filter(h => !h.hidden).map(h => ({ t: h.textContent.trim(), r: r(h.querySelector('.label') || h) }));
          return { stage: r(document.querySelector('#world')), card: r(card), members: (window.__SPACE_EVENT_QA__?.()?.members || []).length, tags };
        });
        const cardLeft = m.card?.[0] ?? Infinity;
        const own = m.tags.find(t => /· 我/.test(t.t));
        const covered = m.tags.filter(t => t.r && t.r[2] > cardLeft && t.r[0] < (m.card?.[2] ?? 0) && t.r[3] > m.card[1] && t.r[1] < m.card[3]).map(t => `${t.t} [${t.r[0]}-${t.r[2]}]`);
        console.log(`${w}x${h} ${label}: members ${m.members}, card x ${m.card?.[0]}-${m.card?.[2]} y ${m.card?.[1]}-${m.card?.[3]}, own tag ${own ? own.r[0] + '-' + own.r[2] : 'none'}, under card: ${covered.join('; ') || 'none'}`);
        console.log('   tags', m.tags.map(t => `${t.t}@${t.r?.[0]}-${t.r?.[2]},${t.r?.[1]}`).join(' | '));
        await page.screenshot({ path: `${OUT}/overview-${w}x${h}-${label}.png` });
      };
      await measure('4');
      await page.waitForFunction(() => (window.__SPACE_EVENT_QA__?.()?.members || []).length >= 5, null, { timeout: 25000 }).catch(() => console.log('  (林间 never arrived)'));
      await L.sleep(2500);
      await measure('5');
    } catch (e) { console.log(`${w}x${h} FAILED ${e.message.split('\n')[0]}`); }
    await ctx.close();
  }
  await b.close();
})();
