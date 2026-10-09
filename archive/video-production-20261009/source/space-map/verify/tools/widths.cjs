// Overlaps inside the roam dock and between the dock and the zoom tools, across widths (atlas view after starting from 周杰伦).
const { launch, ORIGIN, mkdir } = require('./lib.cjs');
const OUT = mkdir(process.env.WOUT || '/tmp/space-map/shots/verify/widths');
const sizes = [[390, 844, true], [430, 932, true], [600, 960, true], [700, 1000, true], [768, 1024, true], [820, 1180, true], [834, 1194, true], [900, 1100, false], [1024, 768, false], [1024, 1366, true], [1180, 820, false], [1280, 720, false], [1366, 768, false], [1440, 900, false]];
(async () => {
  const browser = await launch();
  for (const [w, h, touch] of sizes) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: touch ? 2 : 1, isMobile: touch, hasTouch: touch });
    const page = await ctx.newPage();
    await page.goto(ORIGIN + '/musicSpace/music-map/', { waitUntil: 'load' }); await page.waitForTimeout(2500);
    await page.locator('[data-home-start="real-jay"]').click(); await page.waitForTimeout(3500);
    const r = await page.evaluate(() => {
      const out = [];
      const vis = el => el.checkVisibility({ visibilityProperty: true, opacityProperty: true }) && el.getBoundingClientRect().width > 0;
      const box = el => el.getBoundingClientRect();
      const inter = (a, b) => Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
      const controls = [...document.querySelectorAll('.map-studio-dock button, .map-studio-dock summary, .map-network-tools button, .map-studio-tools > *, .masthead-tools button, .brand')].filter(vis);
      for (let i = 0; i < controls.length; i++) for (let j = i + 1; j < controls.length; j++) {
        const a = controls[i], b = controls[j]; if (a.contains(b) || b.contains(a)) continue;
        if (inter(box(a), box(b)) > 4) out.push(`overlap "${(a.innerText || a.getAttribute('aria-label')).replace(/\s+/g, ' ').slice(0, 14)}" × "${(b.innerText || b.getAttribute('aria-label')).replace(/\s+/g, ' ').slice(0, 14)}"`);
      }
      // children sticking out of their button, text clipped inside a button
      for (const b of controls) {
        const bb = box(b);
        for (const c of b.querySelectorAll('svg, span, b, i')) { if (!vis(c)) continue; const cb = box(c); if (cb.left < bb.left - 2 || cb.right > bb.right + 2) { out.push(`child outside "${b.innerText.replace(/\s+/g, ' ').slice(0, 14)}" (${c.tagName.toLowerCase()} ${Math.round(cb.left)}..${Math.round(cb.right)} vs ${Math.round(bb.left)}..${Math.round(bb.right)})`); break; } }
        if (b.scrollWidth > b.clientWidth + 2) out.push(`clipped "${b.innerText.replace(/\s+/g, ' ').slice(0, 14)}" ${b.scrollWidth}/${b.clientWidth}`);
      }
      // the dock card against the zoom tools
      const dock = document.querySelector('.map-studio-dock'); const tools = [...document.querySelectorAll('.map-network-tools')].filter(vis);
      if (dock && vis(dock)) for (const t of tools) if (inter(box(dock), box(t)) > 4) out.push('zoom tools under the dock');
      return [...new Set(out)];
    });
    console.log(`${w}x${h}`, r.length ? r.join(' | ') : 'ok');
    if (r.length) await page.screenshot({ path: `${OUT}/${w}x${h}.png` });
    await ctx.close();
  }
  await browser.close();
})().catch(e => { console.error('FATAL', e); process.exit(1); });
