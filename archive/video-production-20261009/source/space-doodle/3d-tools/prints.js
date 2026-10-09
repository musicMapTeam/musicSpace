// Paint the stage and gallery prints at full size in the real page (fonts from the app's own CSS).
const { chromium } = require('/tmp/space-video-prep/tools/node_modules/playwright-core');
const fs = require('fs');
(async () => {
  const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
  const page = await browser.newPage({ viewport: { width: 1300, height: 900 } });
  await page.goto('http://127.0.0.1:5190/');
  await page.waitForFunction(() => window.__SPACE_BOOT__ === 'ready', null, { timeout: 60000 });
  const out = await page.evaluate(async () => {
    const m = await import('/@fs/Users/alakazan/workplace/tme/musicSpace/web/event-room/venue-art.js');
    const before = { logo: document.fonts.check('190px "Doodle Logo"', 'SIDE'), display: document.fonts.check('86px "Doodle Display"', '同一晚，另一面。') };
    const loaded = await m.loadVenuePrintFonts();
    const after = { logo: document.fonts.check('190px "Doodle Logo"', 'SIDE'), display: document.fonts.check('86px "Doodle Display"', '同一晚，另一面。'), hand: document.fonts.check('40px "Doodle Hand"', 'STAY FOR ONE MORE.'), digits: document.fonts.check('130px "Doodle Digits"', '01') };
    const a = document.createElement('canvas'); a.width = 1200; a.height = 680; m.paintStagePrint(a.getContext('2d'));
    const b = document.createElement('canvas'); b.width = 1024; b.height = 160; m.paintGalleryPrint(b.getContext('2d'));
    return { before, loaded, after, stage: a.toDataURL(), gallery: b.toDataURL() };
  });
  fs.writeFileSync('/tmp/space-doodle/3d-tools/crops/print-stage.png', Buffer.from(out.stage.split(',')[1], 'base64'));
  fs.writeFileSync('/tmp/space-doodle/3d-tools/crops/print-gallery.png', Buffer.from(out.gallery.split(',')[1], 'base64'));
  console.log(JSON.stringify({ before: out.before, loaded: out.loaded, after: out.after }));
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
