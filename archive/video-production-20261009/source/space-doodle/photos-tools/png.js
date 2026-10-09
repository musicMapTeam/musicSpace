// Render the memory card PNG in the running page for 0, 1 and 2 photos (with/without the little person) and save them.
const { chromium } = require('/tmp/space-video-prep/tools/node_modules/playwright-core');
const fs = require('fs');
const tag = process.argv[2] || 'after';
(async () => {
  const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
  const page = await (await browser.newContext({ viewport: { width: 1200, height: 900 } })).newPage();
  page.on('pageerror', e => console.log('[pageerror]', e.message));
  page.on('console', m => { if (m.type() === 'error') console.log('[console]', m.text()); });
  await page.goto('http://127.0.0.1:5190/');
  await page.waitForFunction(() => window.__SPACE_BOOT__ === 'ready', null, { timeout: 60000 });
  const cases = [
    { name: 'png-1photo', photos: ['sample-crowd.jpg'], avatar: true, title: '回声现场 · 示例场', venue: '月台 Livehouse（虚构场地）' },
    { name: 'png-2photos', photos: ['sample-crowd.jpg', 'yao-stage.jpg'], avatar: true, title: '回声现场 · 示例场', venue: '月台 Livehouse（虚构场地）' },
    { name: 'png-0photos', photos: [], avatar: false, title: '回声现场 · 示例场', venue: '月台 Livehouse（虚构场地）' },
    { name: 'png-long', photos: ['man-near.jpg'], avatar: false, title: '一个非常非常长的现场名字，写到第二行还没写完的那种，看看会不会溢出', venue: '一个很长很长的场地名称也许会超过一行的宽度吧真的很长很长很长' },
  ];
  for (const c of cases) {
    const data = await page.evaluate(async c => {
      const mod = await import('/memory-card-png.js?t=' + Date.now());
      const { DEFAULT_AVATAR } = await import('/../avatar/model.js').catch(() => import('/avatar/model.js')).catch(() => ({ DEFAULT_AVATAR: null }));
      const photos = [];
      for (const file of c.photos) photos.push({ blob: await (await fetch('/demo/' + file)).blob(), authorName: file.startsWith('yao') ? '阿遥·示例' : '访客8311' });
      const avatar = DEFAULT_AVATAR || { version: 2, skin: 0, hair: 1, hairColor: 3, outfit: 0, top: 0, bottom: 0, shoes: 1, eyewear: 0, topColor: 0, bottomColor: 1, shoeColor: 0, expression: 'neutral', accessory: 'none', pose: 'listen' };
      const t0 = performance.now();
      const blob = await mod.renderMemoryCardPng({ room: { title: c.title, venue: c.venue }, author: { name: '访客8311', avatar }, includeAvatar: c.avatar, photos, savedAt: new Date('2026-10-06T10:00:00Z') });
      const ms = Math.round(performance.now() - t0);
      const buf = new Uint8Array(await blob.arrayBuffer());
      let s = ''; for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000));
      return { b64: btoa(s), ms };
    }, c);
    const file = `/tmp/space-doodle/shots/photos/${tag}-${c.name}.png`;
    fs.writeFileSync(file, Buffer.from(data.b64, 'base64'));
    console.log('saved', file, data.ms + 'ms');
  }
  await browser.close();
})().catch(e => { console.log('ERR', e.message); process.exit(1); });
