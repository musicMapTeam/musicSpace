const s = await get('phone');
const p = s.page;
const { freezeKeep } = await import('/tmp/space-video-doodle/prod/capture/P2P3/tools/lib.mjs');
await freezeKeep(s); await s.step(1);
const box = await p.evaluate(() => { const r = document.querySelector('[data-moment-badge="other-side"]').getBoundingClientRect(); return { x: r.x - 10, y: r.y - 10, width: r.width + 20, height: r.height + 20 }; });
for (let i = 0; i < 6; i++) { const r = await s.cdp.send('Page.captureScreenshot', { format: 'png', clip: { ...box, scale: s.dpr }, captureBeyondViewport: false, fromSurface: true }); fs.writeFileSync(`/tmp/space-video-doodle/prod/capture/P2P3/review/explore/jit-${i}.png`, Buffer.from(r.data, 'base64')); await sleep(130); }
const info = await p.evaluate(() => { const b = document.querySelector('[data-moment-badge="other-side"]'); const els = [b, ...b.querySelectorAll('*')]; return els.slice(0, 12).map(e => { const cs = getComputedStyle(e); return (e.tagName + '.' + (e.className?.baseVal ?? e.className)).slice(0, 40) + ' anim=' + cs.animationName + ' ' + cs.animationDuration + ' t=' + cs.transform + ' tr=' + cs.translate + ' rot=' + cs.rotate + ' filter=' + cs.filter + ' will=' + cs.willChange; }); });
await s.unfreeze();
return info;
