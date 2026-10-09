const p = s.page;
const crypto = await import('node:crypto');
const H = b => crypto.createHash('md5').update(b).digest('hex').slice(0, 8);
const nick = await p.evaluate(() => { const e = document.querySelector('.wardrobe input[aria-label="昵称"]'); const r = e.getBoundingClientRect(); return { bx: r.x - 6, by: r.y - 6, w: r.width + 12, h: r.height + 14 }; });
const crop = async () => { const r = await s.cdp.send('Page.captureScreenshot', { format: 'png', clip: { x: nick.bx, y: nick.by, width: nick.w, height: nick.h, scale: 2 } }); return Buffer.from(r.data, 'base64'); };
const seq = []; const seen = new Map();
const t0 = Date.now();
for (let i = 0; i < 120; i++) { await s.step(1); const b = await crop(); const h = H(b); seq.push(h); if (!seen.has(h)) { seen.set(h, i); fs.writeFileSync(`/tmp/space-video-doodle/prod/capture/P1/probe/shots/caret2-${i}.png`, b); } }
const runs = []; let cur = seq[0], n = 0; for (const h of seq) { if (h === cur) n++; else { runs.push(cur + 'x' + n); cur = h; n = 1; } } runs.push(cur + 'x' + n);
return { ms: Date.now() - t0, runs: runs.join(' '), firsts: [...seen.entries()].map(([h, i]) => h + '@' + i).join(' ') };
