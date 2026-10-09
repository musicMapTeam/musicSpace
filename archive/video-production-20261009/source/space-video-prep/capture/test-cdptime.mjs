import fs from 'node:fs';
import { launch, Session, sleep } from './rec.mjs';
import { startServer, hostRoom } from './world.mjs';
const server = await startServer();
const browser = await launch();
try {
  const A = await hostRoom(browser, server.base, { name: '阿遥' });
  const P = A.page; await sleep(1500);
  const cdp = await A.ctx.newCDPSession(P);
  const N = 30;
  let t = Date.now();
  let a; for (let i = 0; i < N; i++) a = await P.screenshot({ type: 'jpeg', quality: 96, animations: 'allow', caret: 'initial' });
  console.log('playwright screenshot ms/frame', ((Date.now() - t) / N).toFixed(1), 'bytes', a.length);
  t = Date.now();
  let b; for (let i = 0; i < N; i++) { const r = await cdp.send('Page.captureScreenshot', { format: 'jpeg', quality: 96, clip: { x: 0, y: 0, width: 1440, height: 744, scale: 2.6667 } }); b = Buffer.from(r.data, 'base64'); }
  console.log('cdp clip scale=dpr ms/frame', ((Date.now() - t) / N).toFixed(1), 'bytes', b.length);
  t = Date.now();
  let c; for (let i = 0; i < N; i++) { const r = await cdp.send('Page.captureScreenshot', { format: 'jpeg', quality: 96, clip: { x: 300 + i, y: 100, width: 960, height: 496, scale: 4 } }); c = Buffer.from(r.data, 'base64'); }
  console.log('cdp clip zoom1.5 ms/frame', ((Date.now() - t) / N).toFixed(1), 'bytes', c.length);
  t = Date.now();
  let d; for (let i = 0; i < N; i++) { const r = await cdp.send('Page.captureScreenshot', { format: 'jpeg', quality: 96 }); d = Buffer.from(r.data, 'base64'); }
  console.log('cdp no clip ms/frame', ((Date.now() - t) / N).toFixed(1), 'bytes', d.length);
  fs.writeFileSync('/tmp/space-video-prep/work-v2/cmp-pw.jpg', a); fs.writeFileSync('/tmp/space-video-prep/work-v2/cmp-cdp.jpg', b);
  await A.close();
} finally { await browser.close(); await server.stop(); }
