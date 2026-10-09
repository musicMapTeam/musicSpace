const s = await get('phone');
const p = s.page;
const r = {};
const f = p.locator('.music-topics form[data-topic-create]');
await f.locator('input[name=title]').click(); await p.keyboard.type('晚班列车', { delay: 60 });
await f.locator('input[name=artist]').click(); await p.keyboard.type('纸灯乐队', { delay: 60 });
await f.locator('input[name=note]').click(); await p.keyboard.type('返场前那段鼓点，你们是不是也在跟着拍手？', { delay: 40 });
r.vals = await p.evaluate(() => [...document.querySelectorAll('.music-topics form[data-topic-create] input')].map(i => i.name + '=' + (i.type === 'checkbox' ? i.checked : i.value)));
await f.locator('input[name=consent]').check(); await sleep(200);
r.shotFilled = await shot(p, 'e08-topic-filled');
const t0 = Date.now();
await f.locator('button').click();
const log = []; let last = '';
for (let i = 0; i < 120; i++) {
  const st = await p.evaluate(() => { const m = document.querySelector('.music-topics'); const arts = m.querySelectorAll('article'); const st = m.querySelector('[role=status],[role=alert]'); const sc = m.querySelector('.community-scroll'); return JSON.stringify({ arts: arts.length, status: st?.innerText?.slice(0, 60), st: sc?.scrollTop, form: !!m.querySelector('form[data-topic-create]'), open: m.querySelector('details')?.open }); });
  if (st !== last) { log.push([Date.now() - t0, st]); last = st; }
  await sleep(50);
}
r.log = log;
r.shotPosted = await shot(p, 'e08-topic-posted');
r.t = (await H.text(p, '.music-topics')).slice(0, 1500);
r.b = await H.buttons(p, b => /topic|summary|reference|map/i.test(b));
r.cardHtml = await p.evaluate(() => document.querySelector('.music-topics article')?.outerHTML.slice(0, 3000));
return r;
