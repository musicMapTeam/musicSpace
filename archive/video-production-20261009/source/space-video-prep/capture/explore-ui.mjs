import { launch, newPage, sleep, BASE, ensureDir } from './lib.mjs';
const out = ensureDir('/tmp/space-video-prep/stills/explore');
const browser = await launch();
const { page } = await newPage(browser);
await page.goto(BASE + '/event-room/', { waitUntil: 'load' });
await sleep(2500);
const dom = await page.evaluate(() => {
  const q = s => [...document.querySelectorAll(s)].map(e => ({ tag: e.tagName, id: e.id, cls: e.className?.toString().slice(0, 60), text: (e.innerText || '').trim().slice(0, 40), view: e.dataset?.view, aria: e.getAttribute('aria-label') }));
  return { nav: q('.camera-nav button'), header: q('.frame > header *'), buttons: q('button').slice(0, 40), panel: q('#panel') };
});
console.log(JSON.stringify(dom, null, 1).slice(0, 5000));
await browser.close();
