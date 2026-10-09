import { launch, Session, sleep, BASE } from './lib.mjs';
const browser = await launch();
const s = await Session.open(browser, { url: BASE, width: 1920, height: 1080, dpr: 1, name: 'live', cursor: false });
const p = s.page; p.on('console', m => { if (m.type() === 'error') console.log('console.error', m.text().slice(0, 160)); });
await sleep(5000);
const OUT = '/tmp/space-video-prep/stills/planA';
await p.screenshot({ path: `${OUT}/30-hook-home.png` });
// recording-only: hide the app's panels/dialogs, keep the 3D scene and its hotspot tags
await p.addStyleTag({ content: `#main-content,.sp-dialog,dialog,.toast,#toast{opacity:0!important;pointer-events:none!important;transition:none!important}` });
for (const [label, sel] of [['live', '[data-world-view=live]'], ['editor', '[data-world-editor]'], ['records', '[data-world-view=records]'], ['space', '[data-world-view=space]']]) {
  await p.evaluate(s => document.querySelector(s).click(), sel); await sleep(2600);
  await p.screenshot({ path: `${OUT}/31-hook-${label}.png` });
  // close any dialog that opened so the next nav works
  await p.evaluate(() => document.querySelectorAll('dialog[open]').forEach(d => { try { d.close(); } catch {} }));
}
await browser.close();
