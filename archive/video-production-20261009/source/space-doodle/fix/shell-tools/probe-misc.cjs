// node probe-misc.cjs <vp> <prefix> : sticky × in a long sheet, mini-stage heading, simulated Node invite block, 我的空间 tab
const L = require('./lib.cjs');
L.watchdog(280);
const kind = process.argv[2] || 'phone';
const prefix = process.argv[3] || 'misc';
const shot = (page, name, o) => L.shot(page, `${prefix}-${name}-${kind}`, o);
(async () => {
  const b = await L.launch();
  const { page } = await L.open(b, kind);
  try {
    await L.enter(page);
    // 我的空间 tab vs its siblings
    console.log('nav', JSON.stringify(await page.evaluate(() => [...document.querySelectorAll('.camera-nav button')].map(n => { const cs = getComputedStyle(n), r = n.getBoundingClientRect(); return `${n.textContent.trim()}|${cs.fontSize}|${cs.borderTopLeftRadius}|${Math.round(r.width)}x${Math.round(r.height)}|svg:${!!n.querySelector('svg') && getComputedStyle(n.querySelector('svg')).display}`; }))));
    // About: a long sheet, scrolled
    await L.openKind(page, 'about');
    await L.sleep(600);
    const before = await page.evaluate(() => { const c = document.querySelector('#panel-close').getBoundingClientRect(), p = document.querySelector('#panel').getBoundingClientRect(); return { close: [c.left - p.left, c.top - p.top, p.right - c.right].map(Math.round), panelTop: Math.round(p.top) }; });
    await shot(page, 'about-top');
    await page.evaluate(() => { document.querySelector('#panel').scrollTop = 400; });
    await L.sleep(500);
    const after = await page.evaluate(() => { const c = document.querySelector('#panel-close').getBoundingClientRect(), p = document.querySelector('#panel').getBoundingClientRect(); const hit = document.elementFromPoint(c.left + c.width / 2, c.top + c.height / 2); return { close: [c.left - p.left, c.top - p.top, p.right - c.right].map(Math.round), hit: hit?.id || hit?.tagName, scroll: document.querySelector('#panel').scrollTop }; });
    console.log('close', JSON.stringify({ before, after }));
    await shot(page, 'about-scrolled');
    await page.click('#panel-close');
    await L.sleep(500);
    console.log('closed by ×', await page.evaluate(() => document.querySelector('#panel').hidden));
    // room sheet with a simulated Node invite block (the static build shows a note instead)
    await page.click('#room-info');
    await L.sleep(1000);
    await page.evaluate(() => {
      const body = document.querySelector('#panel-body'), anchor = body.querySelector('.row');
      const n = 25, cell = 3, m = 3, size = (n + 2 * m) * cell; let path = '';
      for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (((x * 7 + y * 13) ^ (x * y)) % 3 === 0 || ((x < 7 || x > n - 8) && y < 7) || (x < 7 && y > n - 8)) path += `M${(x + m) * cell} ${(y + m) * cell}h${cell}v${cell}h-${cell}z`;
      const qr = `<svg viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="white"/><path d="${path}" fill="black"/></svg>`;
      const html = `<div class="invite-code">K7P2QX</div><div id="invite-qr" aria-label="现场邀请二维码">${qr}</div><button class="primary" data-copy-invite>复制现场邀请链接</button><p class="fine invite-address">http://192.168.1.20:8787/event-room/?room=K7P2QX</p><p class="fine">二维码和 NFC 标签只包含上方邀请网址，不携带身份。</p>`;
      const box = document.createElement('div'); box.innerHTML = html; anchor.before(...box.childNodes);
    });
    await L.sleep(300);
    await page.evaluate(() => { const c = document.querySelector('.invite-code'); c.scrollIntoView({ block: 'start' }); document.querySelector('#panel').scrollTop -= 60; });
    await L.sleep(300);
    console.log('invite', JSON.stringify(await page.evaluate(() => { const c = document.querySelector('.invite-code'), q = document.querySelector('#invite-qr'); const a = c.getBoundingClientRect(), r = q.getBoundingClientRect(), s = q.querySelector('svg').getBoundingClientRect(); return { code: [getComputedStyle(c).fontFamily.split(',')[0], Math.round(a.width), Math.round(a.height)], qr: [Math.round(r.width), Math.round(r.height)], svg: [Math.round(s.width), Math.round(s.height)] }; })));
    await shot(page, 'invite');
    await L.closeEverything(page);
    // the room chat's mini stage
    const roomId = await page.evaluate(() => window.__SPACE_EVENT_QA__?.()?.roomId);
    await L.openKind(page, 'conversation', roomId);
    await L.sleep(2500);
    console.log('mini', JSON.stringify(await page.evaluate(() => { const f = document.querySelector('.frame'), s = document.querySelector('.scene-heading small'); const r = s.getBoundingClientRect(); return { open: f.classList.contains('conversation-open'), small: [getComputedStyle(s).fontSize, getComputedStyle(s).display, Math.round(r.width), Math.round(r.height), s.scrollWidth, s.clientWidth] }; })));
    await shot(page, 'mini-stage', { clip: { x: 0, y: 0, width: page.viewportSize().width, height: Math.min(360, page.viewportSize().height) } });
    console.log('logs', JSON.stringify(page.__logs.slice(0, 6)));
  } catch (e) { console.error('ERR', e.message.split('\n')[0]); await page.screenshot({ path: `${L.OUT}/ERR-misc-${kind}.png` }).catch(() => {}); }
  await b.close();
})();
