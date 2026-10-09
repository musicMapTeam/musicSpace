const out = {};
out.pressedPreset = await page.evaluate(() => [...document.querySelectorAll('.wardrobe [data-preset]')].map(b => b.dataset.preset + ':' + b.getAttribute('aria-pressed')).join(' '));
out.pressedAngle = await page.evaluate(() => [...document.querySelectorAll('.wardrobe [data-angle]')].map(b => b.dataset.angle + ':' + b.getAttribute('aria-pressed')).join(' '));
await page.click('.wardrobe input[aria-label="昵称"]'); await page.keyboard.type('阿宁'); await sleep(300);
await page.evaluate(() => { const t = document.querySelector('.wardrobe-tools'); t.scrollTo({ top: 1e5, behavior: 'instant' }); });
await sleep(300);
await page.locator('.wardrobe summary', { hasText: '试试现成搭配' }).click(); await sleep(500);
await page.evaluate(() => { const t = document.querySelector('.wardrobe-tools'); t.scrollTo({ top: 1e5, behavior: 'instant' }); });
await sleep(400);
await shot('04-wardrobe-presets');
out.tools = await page.evaluate(() => { const t = document.querySelector('.wardrobe-tools'); return { sh: t.scrollHeight, ch: t.clientHeight, st: t.scrollTop, details: document.querySelector('.wardrobe details')?.innerText }; });
out.presetBoxes = await page.evaluate(() => [...document.querySelectorAll('.wardrobe [data-preset]')].map(b => { const r = b.getBoundingClientRect(); return b.dataset.preset + '@' + Math.round(r.x) + ',' + Math.round(r.y) + ' ' + Math.round(r.width) + 'x' + Math.round(r.height); }));
for (const p of ['1','2','3','4']) { await page.click(`.wardrobe [data-preset="${p}"]`); await sleep(500); }
await shot('05-wardrobe-shizhen');
for (const a of ['front','side','back','quarter']) { await page.click(`.wardrobe [data-angle="${a}"]`); await sleep(400); }
await page.click('[data-wardrobe-save]'); 
let toast = ''; for (let i = 0; i < 30; i++) { toast = await page.evaluate(() => document.querySelector('#toast')?.textContent || ''); if (toast) break; await sleep(100); }
out.toast = toast;
await sleep(800);
await shot('06-after-save');
out.panel = await txt('#panel');
out.name = await page.evaluate(() => document.querySelector('form[data-form="demo-entry"] input[name=name]')?.value);
return out;
