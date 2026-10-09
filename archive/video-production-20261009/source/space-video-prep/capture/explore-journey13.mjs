import { launch, newPage, sleep, BASE, ensureDir } from './lib.mjs';
import { hostCreatesRoom, guestJoins, uploadPhoto, panelInfo, visibleUI } from './flows.mjs';
const out = ensureDir('/tmp/space-video-prep/stills/journey');
const browser = await launch();
const A = await newPage(browser);
const B = await newPage(browser);
await hostCreatesRoom(A.page, { name: '阿遥', title: '返场夜', venue: '月台 Livehouse' });
await guestJoins(B.page, new URL(A.page.url()).search, { name: 'Lin' });
let n = 20;
const snap = async (p, tag, who) => { const i = String(n++).padStart(2, '0'); const info = await visibleUI(p); console.log(`--- ${i} ${who} ${tag}`, JSON.stringify(info.overlays.filter(o => !/world-shell|presence/.test(o.cls))).slice(0, 1600)); console.log('    btns', JSON.stringify(info.buttons.filter(b => /panel|social|chat|friend|person|dialog/.test(b)).slice(0, 14))); await p.screenshot({ path: `${out}/${i}-${who}-${tag}.png` }); };
// A: click Lin's hotspot
await A.page.locator('.hotspot', { hasText: 'Lin' }).first().click(); await sleep(1800);
await snap(A.page, 'person-Lin', 'A');
await browser.close();
