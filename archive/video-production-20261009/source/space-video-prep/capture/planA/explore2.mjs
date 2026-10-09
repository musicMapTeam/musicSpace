import { launch, Session, sleep } from '../rec.mjs';
const BASE = process.env.SPACE_BASE || 'http://127.0.0.1:47961/musicSpace/';
const OUT = '/tmp/space-video-prep/stills/planA';
const browser = await launch();
const s = await Session.open(browser, { url: BASE, width: 1440, height: 744, dpr: 1, name: 'live' });
const p = s.page;
const dump = async (label) => {
  await p.screenshot({ path: `${OUT}/${label}.png` });
  const items = await p.evaluate(() => [...document.querySelectorAll('button, a[href], [role=button], input, select, textarea, summary')]
    .filter(e => { const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none'; })
    .map(e => `${e.tagName.toLowerCase()}${e.id ? '#' + e.id : ''}${e.name ? '[name=' + e.name + ']' : ''}${e.type ? '(' + e.type + ')' : ''}${e.dataset && Object.keys(e.dataset).length ? '[' + Object.entries(e.dataset).map(([k, v]) => `data-${k}=${v}`).join(',') + ']' : ''} "${(e.innerText || e.value || e.getAttribute('aria-label') || '').trim().replace(/\s+/g, ' ').slice(0, 40)}"`));
  console.log(`--- ${label}\n` + items.join('\n'));
};
await sleep(5000);
await p.getByRole('button', { name: /体验示例/ }).first().click(); await sleep(3000);
await p.locator('[data-space-action=edit], [data-spaceAction=edit]').first().click().catch(async () => { await p.getByRole('button', { name: /做一张卡/ }).first().click(); });
await sleep(2500); await dump('03-edit');
await browser.close();
