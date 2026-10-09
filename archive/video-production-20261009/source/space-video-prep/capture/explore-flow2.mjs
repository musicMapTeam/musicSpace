import { launch, newPage, sleep, BASE, ensureDir } from './lib.mjs';
const out = ensureDir('/tmp/space-video-prep/stills/explore');
const browser = await launch();
const { page } = await newPage(browser);
page.on('console', m => { if (['error'].includes(m.type())) console.log('[console]', m.type(), m.text().slice(0, 160)); });
await page.goto(BASE + '/event-room/', { waitUntil: 'load' });
await sleep(1500);
const dumpPanel = async (tag) => {
  const info = await page.evaluate(() => {
    const p = document.querySelector('#panel');
    const vis = p && !p.hidden && getComputedStyle(p).display !== 'none';
    return {
      panelVisible: vis,
      panelText: (p?.innerText || '').replace(/\n+/g, ' | ').slice(0, 900),
      inputs: [...document.querySelectorAll('#panel input, #panel select, #panel textarea')].map(e => ({ type: e.type, name: e.name, ph: e.placeholder, val: (e.value || '').slice(0, 30), opts: e.tagName === 'SELECT' ? [...e.options].map(o => o.value + ':' + o.text).join('/') : undefined })),
      buttons: [...document.querySelectorAll('#panel button')].map(b => (b.innerText || b.getAttribute('aria-label') || '').trim().slice(0, 30)),
    };
  });
  console.log('---', tag, JSON.stringify(info));
  await page.screenshot({ path: `${out}/${tag}.png` });
};
await page.getByRole('button', { name: '带上小人，进入现场' }).click(); await sleep(500);
await page.getByRole('button', { name: /我是主办方/ }).click(); await sleep(500);
await page.locator('#panel input[name=name]').fill('阿遥');
await page.getByRole('button', { name: '保存昵称，继续' }).click(); await sleep(900);
await dumpPanel('04-create-form');
await browser.close();
