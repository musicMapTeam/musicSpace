// Same-state double grab: what differs?  Saves a/b PNGs for the room (frozen clock, no step between grabs).
import { launch, DESKTOP4K, killSinks, sleep } from './rig.mjs';
import { openApp, ROOT } from './flow4k.mjs';
import fs from 'node:fs';
const D = `${ROOT}/probe/pairs`; fs.mkdirSync(D, { recursive: true });
const browser = await launch();
let s;
try {
  s = await openApp(browser, DESKTOP4K, { name: 'bench3' });
  await s.park(); await s.freeze(); await s.step(3);
  const a = await s.grab(); await sleep(500); const b = await s.grab(); const c = await s.grab();
  fs.writeFileSync(`${D}/same-a.png`, a); fs.writeFileSync(`${D}/same-b.png`, b); fs.writeFileSync(`${D}/same-c.png`, c);
  // also: a grab without fromSurface / optimizeForSpeed
  const r = await s.cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false, clip: { x: 0, y: 0, width: s.W, height: s.H, scale: s.dpr } });
  fs.writeFileSync(`${D}/same-d-plain.png`, Buffer.from(r.data, 'base64'));
  const r2 = await s.cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false, clip: { x: 0, y: 0, width: s.W, height: s.H, scale: s.dpr } });
  fs.writeFileSync(`${D}/same-e-plain.png`, Buffer.from(r2.data, 'base64'));
  console.log('ok');
} catch (e) { console.error('FAILED', e); killSinks(); }
finally { await s?.ctx.close().catch(() => {}); await browser.close(); }
