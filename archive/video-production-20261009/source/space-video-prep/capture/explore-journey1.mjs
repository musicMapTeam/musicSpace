import { launch, newPage, sleep, BASE, ensureDir } from './lib.mjs';
import { hostCreatesRoom, panelInfo, openEventRoom } from './flows.mjs';
const out = ensureDir('/tmp/space-video-prep/stills/journey');
const browser = await launch();
const A = await newPage(browser);          // host 阿遥
const B = await newPage(browser);          // guest Lin
for (const [n, p] of [['A', A.page], ['B', B.page]]) p.on('console', m => { if (m.type() === 'error') console.log(`[${n} console]`, m.text().slice(0, 160)); });
await hostCreatesRoom(A.page, { name: '阿遥', title: '返场夜', venue: '月台 Livehouse' });
const url = A.page.url();
console.log('invite url', url);
await A.page.screenshot({ path: `${out}/01-A-room.png` });
// guest opens invite
await openEventRoom(B.page, new URL(url).search);
await sleep(800);
console.log('B after open', JSON.stringify(await panelInfo(B.page)));
await B.page.screenshot({ path: `${out}/02-B-invite-open.png` });
await browser.close();
