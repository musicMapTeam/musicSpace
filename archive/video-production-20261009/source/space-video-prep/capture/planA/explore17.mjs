import { launch, Session, sleep, BASE } from './lib.mjs';
import * as P from './pa.mjs';
const browser = await launch();
const s = await Session.open(browser, { url: BASE, width: 1440, height: 744, dpr: 1, name: 'live' });
const p = s.page;
await sleep(5000); await P.setupAgreed(p);
await P.btn(p, /返回现场/).click(); await sleep(2200);
await P.btn(p, /切到Lin/).click(); await sleep(2200);
const info = await p.evaluate(() => {
  const el = [...document.querySelectorAll('#sp-local-scene *')].find(e => e.children.length === 0 && /那晚的歌单/.test(e.textContent));
  const chain = []; let n = el;
  while (n && n !== document.documentElement) { const cs = getComputedStyle(n); const r = n.getBoundingClientRect(); chain.push(`${n.tagName.toLowerCase()}${n.id ? '#' + n.id : ''}.${String(n.className).split(' ').slice(0, 2).join('.')} oy=${cs.overflowY} sh=${n.scrollHeight} ch=${n.clientHeight} y=${Math.round(r.y)} h=${Math.round(r.height)} pos=${cs.position}`); n = n.parentElement; }
  return chain;
});
console.log(info.join('\n'));
console.log('window scrollY max', await p.evaluate(() => document.documentElement.scrollHeight - innerHeight));
await browser.close();
