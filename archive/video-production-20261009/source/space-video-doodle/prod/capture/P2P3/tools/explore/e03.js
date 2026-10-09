const s = await get('phone');
const p = s.page;
const log = [];
const t0 = Date.now();
await p.locator('[data-tour-action="sample:sample-stage"]').click();
let last = '';
for (let i = 0; i < 200; i++) {
  const st = await p.evaluate(() => {
    const panel = document.querySelector('#panel');
    const ai = document.querySelector('.moment-ai-tag');
    const line = [...document.querySelectorAll('#panel *')].find(e => /AI 判断|不确定|AI 在本机判断视角|下载/.test(e.childNodes[0]?.textContent || ''));
    const chips = [...document.querySelectorAll('[data-moment-viewpoint]')].map(c => c.dataset.momentViewpoint + (c.classList.contains('is-suggested') ? '~' : '') + (c.querySelector('input')?.checked || c.getAttribute('aria-pressed') === 'true' || c.classList.contains('is-selected') ? '*' : ''));
    return JSON.stringify({ hidden: panel?.hidden, ai: ai ? ai.innerText.replace(/\s+/g, ' ') : null, aiCls: ai?.className, chips, scroll: panel?.scrollTop });
  });
  if (st !== last) { log.push([Date.now() - t0, st]); last = st; }
  if (/不确定|AI 判断/.test(st) && Date.now() - t0 > 1500) break;
  await sleep(25);
}
await sleep(300);
const r = { log };
r.shot = await shot(p, 'e03-stage-ai');
r.panelText = (await H.text(p, '#panel')).slice(0, 1500);
r.btns = await H.buttons(p, b => /moment|viewpoint|保存|close|visibility/.test(b));
return r;
