const out = {};
const g = () => page.evaluate(() => { const c = [...document.querySelectorAll('.music-games')].find(e => e.getClientRects().length); return c ? c.innerText.replace(/\n{2,}/g, '\n').slice(0, 2000) : null; });
await page.locator('form[data-game-form="join"] input[name=consent]').check(); await sleep(300);
await page.locator('form[data-game-form="join"] button', { hasText: '加入这一局' }).click();
const t0 = Date.now();
let ok = false; for (let i = 0; i < 100; i++) { ok = await page.evaluate(() => !!document.querySelector('[data-game-choice="night-platform"]') && document.querySelector('[data-game-choice="night-platform"]').getClientRects().length > 0); if (ok) break; await sleep(100); }
out.roundMs = ok ? Date.now() - t0 : 'timeout';
await sleep(500);
await shot('37-game-round');
out.round = await g();
out.gameChoices = await page.evaluate(() => [...document.querySelectorAll('[data-game-choice]')].map(b => b.dataset.gameChoice + ':' + b.innerText.replace(/\s+/g, ' ')));
out.refresh = await page.evaluate(() => [...document.querySelectorAll('[data-game]')].map(b => b.dataset.game + ':' + b.innerText.replace(/\s+/g, ' ')));
if (ok) {
  await page.click('[data-game-choice="night-platform"]'); await sleep(900);
  await shot('38-game-answer');
  out.answerForm = await page.evaluate(() => { const f = document.querySelector('form[data-game-form="answer"]'); return f ? f.innerText + ' | buttons: ' + [...f.querySelectorAll('button')].map(b => b.innerText).join(' / ') : null; });
  await page.locator('form[data-game-form="answer"] input[name=consent]').check(); await sleep(300);
  const sub = await page.evaluate(() => [...document.querySelectorAll('form[data-game-form="answer"] button')].map(b => b.innerText));
  out.sub = sub;
  await page.locator('form[data-game-form="answer"] button', { hasText: '提交' }).first().click();
  const t1 = Date.now();
  let rv = false; for (let i = 0; i < 120; i++) { rv = await page.evaluate(() => /本轮有共同选择|共同选择/.test([...document.querySelectorAll('.music-games')].find(e => e.getClientRects().length)?.innerText || '')); if (rv) break; await sleep(100); }
  out.revealMs = rv ? Date.now() - t1 : 'timeout';
  await sleep(800);
  await shot('39-game-reveal');
  out.reveal = await g();
}
return out;
