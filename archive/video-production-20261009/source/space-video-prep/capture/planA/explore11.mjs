import { launch, Session, sleep, BASE, PHOTOS, dump } from './lib.mjs';
const browser = await launch();
const s = await Session.open(browser, { url: BASE, width: 1920, height: 1080, dpr: 1, name: 'live' });
const p = s.page; p.on('console', m => { if (m.type() === 'error') console.log('console.error', m.text().slice(0, 160)); });
await sleep(5000);
await p.screenshot({ path: '/tmp/space-video-prep/stills/planA/20-home-1080.png' });
for (const [label, sel] of [['live', '[data-world-view=live]'], ['editor', '[data-world-editor]'], ['records', '[data-world-view=records]'], ['space', '[data-world-view=space]']]) {
  await p.locator(sel).first().click(); await sleep(2800);
  await p.screenshot({ path: `/tmp/space-video-prep/stills/planA/21-nav-${label}.png` });
  console.log(label, 'dialog open?', await p.locator('dialog[open], [role=dialog]').count(), '|', (await p.locator('main, #app, body').first().innerText()).replace(/\n+/g, ' | ').slice(0, 300));
}
await browser.close();
