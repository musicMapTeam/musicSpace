import { launch, newPage, sleep, BASE, ensureDir } from './lib.mjs';
import { hostCreatesRoom, guestJoins, uploadPhoto, panelInfo } from './flows.mjs';
const out = ensureDir('/tmp/space-video-prep/stills/journey');
const browser = await launch();
const A = await newPage(browser);
const B = await newPage(browser);
for (const [n, p] of [['A', A.page], ['B', B.page]]) p.on('console', m => { if (m.type() === 'error') console.log(`[${n} console]`, m.text().slice(0, 160)); });
await hostCreatesRoom(A.page, { name: '阿遥', title: '返场夜', venue: '月台 Livehouse' });
await guestJoins(B.page, new URL(A.page.url()).search, { name: 'Lin' });
await uploadPhoto(A.page, '/tmp/space-video-prep/repo-rc4/web/assets/stage-scene.png', { visibility: 'room' });
await uploadPhoto(B.page, '/tmp/space-video-prep/repo-rc4/web/assets/crowd-scene.png', { visibility: 'room' });
await sleep(1500);
let n = 10;
const snap = async (p, tag, who) => { const i = String(n++).padStart(2, '0'); const info = await panelInfo(p); console.log(`--- ${i} ${who} ${tag}`, JSON.stringify(info).slice(0, 1500)); await p.screenshot({ path: `${out}/${i}-${who}-${tag}.png` }); };
await A.page.getByRole('button', { name: /刷新照片/ }).click(); await sleep(1200);
// open Lin's photo from A
await A.page.locator('#panel button', { hasText: 'Lin' }).first().click(); await sleep(1500);
await snap(A.page, 'open-Lin-photo', 'A');
await browser.close();
