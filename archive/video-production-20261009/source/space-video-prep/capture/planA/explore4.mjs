import { launch, Session, sleep, BASE, PHOTOS, dump } from './lib.mjs';
const browser = await launch();
const s = await Session.open(browser, { url: BASE, width: 1440, height: 744, dpr: 1, name: 'live' });
const p = s.page; p.on('console', m => { if (m.type() === 'error') console.log('console.error', m.text().slice(0, 160)); });
await sleep(5000);
await p.getByRole('button', { name: /体验示例/ }).first().click(); await sleep(3000);
await p.getByRole('button', { name: /做一张卡/ }).first().click(); await sleep(2500);
await p.locator('input[name=photo]').setInputFiles(PHOTOS.stage);
await p.waitForFunction(() => /AI 判断|不确定/.test(document.body.innerText), null, { timeout: 60000 }).catch(() => console.log('no AI verdict'));
await sleep(600);
// scroll the form panel to see the rest
await p.evaluate(() => { const f = document.querySelector('form'); const sc = f && (f.closest('[class*=dialog], [class*=panel], aside, section') || f); sc.scrollTop = 1000; });
await sleep(600); await dump(p, '06-form-bottom');
await p.getByRole('button', { name: /保存现场卡/ }).click(); await sleep(3000); await dump(p, '07-saved');
await browser.close();
