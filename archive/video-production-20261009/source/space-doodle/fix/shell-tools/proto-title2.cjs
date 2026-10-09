const L = require('./lib.cjs');
L.watchdog(200);
const kind = process.argv[2] || 'phone', prefix = process.argv[3] || 'p21b';
const CSS = `.frame .scene-heading h1 span{width:fit-content;padding:0 12px 5px 9px;background:var(--ds-paper-card);border:var(--ds-line-thin) solid var(--ds-ink);
  border-radius:var(--ds-radius-btn);box-shadow:var(--ds-shadow-sm);transform:rotate(-1deg)}`;
(async () => {
  const b = await L.launch();
  const { page } = await L.open(b, kind);
  try {
    await L.enter(page);
    const clip = { x: 0, y: 60, width: Math.min(page.viewportSize().width, 760), height: 230 };
    await L.shot(page, `${prefix}-room-plain-${kind}`, { clip });
    await page.addStyleTag({ content: CSS });
    await L.sleep(400);
    await L.shot(page, `${prefix}-room-label-${kind}`, { clip });
    await L.shot(page, `${prefix}-room-label-full-${kind}`);
  } catch (e) { console.error('ERR', e.message.split('\n')[0]); }
  await b.close();
})();
