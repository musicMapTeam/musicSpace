const S = await fresh();
const p = S.page;
await sleep(1500);
await p.locator('#join').click();
await p.waitForSelector('form[data-form="demo-entry"] button.primary:not([disabled])', { timeout: 30000 });
await sleep(500);
await p.locator('form[data-form="demo-entry"] button', { hasText: '现在换个造型' }).click();
await sleep(1500);
await S.freeze();
const nick = await p.evaluate(() => { const e = document.querySelector('.wardrobe input[aria-label="昵称"]'); const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2, bx: r.x, by: r.y, w: r.width, h: r.height }; });
await p.mouse.move(nick.x, nick.y); await p.mouse.down(); await S.step(3); await p.mouse.up(); await S.step(2);
const hashes = [];
const crop = async () => { const r = await S.cdp.send('Page.captureScreenshot', { format: 'png', clip: { x: nick.bx, y: nick.by, width: nick.w, height: nick.h, scale: 2 } }); return Buffer.from(r.data, 'base64'); };
const crypto = await import('node:crypto');
const H = b => crypto.createHash('md5').update(b).digest('hex').slice(0, 8);
for (let i = 0; i < 30; i++) { await S.step(1); hashes.push(H(await crop())); }
await p.keyboard.type('阿');
for (let i = 0; i < 10; i++) { await S.step(1); hashes.push(H(await crop())); }
await p.keyboard.type('宁');
for (let i = 0; i < 30; i++) { await S.step(1); const b = await crop(); hashes.push(H(b)); if (i === 5) fs.writeFileSync('/tmp/space-video-doodle/prod/capture/P1/probe/shots/caret-a.png', b); if (i === 13) fs.writeFileSync('/tmp/space-video-doodle/prod/capture/P1/probe/shots/caret-b.png', b); }
const active = await p.evaluate(() => document.activeElement?.tagName + ' ' + document.activeElement?.getAttribute('aria-label'));
return { active, hashes: hashes.join(' ') };
