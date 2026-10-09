const pinfo = await page.evaluate(() => { const p = document.querySelector('#panel'); return { sh: p.scrollHeight, ch: p.clientHeight, st: p.scrollTop }; });
await page.click('form[data-form="demo-entry"] [data-open=wardrobe]'); await sleep(1500);
await shot('03-wardrobe');
const w = await page.evaluate(() => { const w = document.querySelector('.wardrobe'); const t = w.querySelector('.wardrobe-tools'); return { text: w.innerText.replace(/\n{2,}/g, '\n').slice(0, 3000), toolsSH: t?.scrollHeight, toolsCH: t?.clientHeight, summaries: [...w.querySelectorAll('summary')].map(s => s.textContent.trim()), presets: [...w.querySelectorAll('[data-preset]')].map(b => b.dataset.preset + ':' + b.textContent.trim()), angles: [...w.querySelectorAll('[data-angle]')].map(b => b.dataset.angle + ':' + b.textContent.trim()), nick: !!w.querySelector('input[aria-label="昵称"]'), save: !!w.querySelector('[data-wardrobe-save]') }; });
return { pinfo, w };
