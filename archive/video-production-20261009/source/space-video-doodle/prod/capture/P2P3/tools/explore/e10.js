const s = await get('phone');
const p = s.page;
const crypto = await import('node:crypto');
const r = { focused: await p.evaluate(() => document.activeElement?.tagName + ' ' + (document.activeElement?.name || '')) };
const comp = await p.evaluate(() => { const r = document.activeElement.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; });
r.comp = comp;
await s.freeze();
const hashes = [];
for (let i = 0; i < 24; i++) {
  await s.step(1);
  const b = await s.cdp.send('Page.captureScreenshot', { format: 'png', clip: { x: comp.x, y: comp.y, width: 40, height: comp.height, scale: s.dpr }, fromSurface: true });
  hashes.push(crypto.createHash('md5').update(b.data).digest('hex').slice(0, 6));
  if (i === 0 || i === 5) fs.writeFileSync(`/tmp/space-video-doodle/prod/capture/P2P3/review/explore/e10-caret-${i}.png`, Buffer.from(b.data, 'base64'));
}
r.hashes = hashes.join(' ');
// now real-time wait between frames 600ms
const h2 = [];
for (let i = 0; i < 8; i++) { await sleep(600); await s.step(1); const b = await s.cdp.send('Page.captureScreenshot', { format: 'png', clip: { x: comp.x, y: comp.y, width: 40, height: comp.height, scale: s.dpr }, fromSurface: true }); h2.push(crypto.createHash('md5').update(b.data).digest('hex').slice(0, 6)); }
r.h2 = h2.join(' ');
await s.unfreeze();
return r;
