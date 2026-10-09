// can Chrome re-rasterise a zoomed region natively (CDP Page.captureScreenshot clip.scale)?  crisp text + no relayout?
import fs from 'node:fs';
import { launch, Session, sleep } from './rec.mjs';
import { startServer, hostRoom } from './world.mjs';
const server = await startServer();
const browser = await launch();
try {
  const A = await hostRoom(browser, server.base, { name: '阿遥' });
  const P = A.page;
  await P.locator('#room-first-photo').click(); await sleep(900);
  const cdp = await A.ctx.newCDPSession(P);
  const shot = async (name, clip) => {
    const r = await cdp.send('Page.captureScreenshot', { format: 'png', clip, captureBeyondViewport: false });
    fs.writeFileSync(`/tmp/space-video-prep/stills/${name}.png`, Buffer.from(r.data, 'base64'));
    const b = Buffer.from(r.data, 'base64'); console.log(name, 'png bytes', b.length, 'size', b.readUInt32BE(16), 'x', b.readUInt32BE(20));
  };
  await shot('zoomtest-full', { x: 0, y: 0, width: 1440, height: 744, scale: 2.6667 });
  await shot('zoomtest-x1.5', { x: 900, y: 120, width: 960, height: 496, scale: 4 });
  await shot('zoomtest-x2', { x: 960, y: 120, width: 480, height: 248, scale: 8 });
  await A.close();
} finally { await browser.close(); await server.stop(); }
