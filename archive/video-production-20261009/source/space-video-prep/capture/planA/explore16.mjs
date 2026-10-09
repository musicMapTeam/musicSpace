import { launch, Session, sleep, BASE, PHOTOS } from './lib.mjs';
import * as F from './flow.mjs';
const browser = await launch();
const s = await Session.open(browser, { url: BASE, width: 1440, height: 744, dpr: 1, name: 'live' });
const p = s.page;
await sleep(5000); await F.toDemo(p); await F.openMake(p);
await p.locator('#sp-song-input').fill('晴天').catch(() => {});
await F.pickFile(p, PHOTOS.stage); await F.saveCard(p); await F.toRequest(p); await F.send(p); await F.asYao(p); await F.viewRequest(p); await F.agree(p); await sleep(4000);
await p.getByRole('button', { name: /返回现场/ }).click(); await sleep(2000);
await p.locator('[data-world-view=records]').first().click(); await sleep(3500);
await p.screenshot({ path: '/tmp/space-video-prep/stills/planA/50-records.png' });
console.log((await p.locator('main').first().innerText()).replace(/\n+/g, ' | ').slice(0, 900));
// the about dialog
await p.locator('#demo-help').click(); await sleep(1500);
await p.screenshot({ path: '/tmp/space-video-prep/stills/planA/51-about.png' });
await browser.close();
