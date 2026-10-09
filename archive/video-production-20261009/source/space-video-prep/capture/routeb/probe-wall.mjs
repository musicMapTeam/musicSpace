// real-time probe: enter, put the crowd sample on the wall, dump what the wall panel contains (badge / reason / offer button / meta lines)
import { launch, sleep } from '../rec.mjs';
import { open, enterShowcase, openSample, btn, UI } from './rb.mjs';
const base = process.env.SPACE_BASE;
const browser = await launch();
const s = await open(browser, base, { width: 1440, height: 744, dpr: 1, cursor: false }); const p = s.page;
await enterShowcase(s);
await openSample(s, 'sample-crowd');
await p.waitForFunction(() => /AI 判断：|不确定，请选择/.test(document.querySelector('#panel')?.innerText || ''), null, { timeout: 90000 }).catch(() => console.log('no AI verdict'));
await sleep(800);
await btn(p, UI.save).click(); await sleep(4500);
await p.screenshot({ path: '/tmp/space-video-prep/stills/routeb-wall-after-save.png' });
const info = await p.evaluate(() => {
  const root = document.querySelector('#panel');
  const q = sel => [...root.querySelectorAll(sel)].map(e => ({ cls: String(e.className).slice(0, 60), data: Object.fromEntries(Object.entries(e.dataset)), text: e.innerText.replace(/\s+/g, ' ').slice(0, 140) }));
  return { panelText: root.innerText.replace(/\s+/g, ' ').slice(0, 1500), badge: q('[data-moment-badge]'), offer: q('[data-exchange-offer]'), meta: q('.moment-meta'), groups: q('.moment-group__title, .moment-group__note'), scroll: (() => { const sc = [root, ...root.querySelectorAll('*')].find(e => e.scrollHeight > e.clientHeight + 8 && /(auto|scroll)/.test(getComputedStyle(e).overflowY)); return sc ? `${sc.tagName}.${String(sc.className).slice(0,40)} sh=${sc.scrollHeight} ch=${sc.clientHeight}` : 'none'; })() };
});
console.log(JSON.stringify(info, null, 1));
await s.close(); await browser.close();
