// verify-16 prototype: inject candidate CSS (in the page only, never the repo) and screenshot the result.
const { chromium } = require('/tmp/space-video-prep/tools/node_modules/playwright-core');
const fs = require('fs');
const OUT = '/tmp/space-doodle/verify-16/shots';
const URL = 'http://127.0.0.1:5190/';
const VP = {
  phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  desktop: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 },
  narrow: { viewport: { width: 320, height: 640 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
};
const CAND = {
  A: `.panel:is([data-kind=room],[data-kind=rooms]) button.primary[data-open]{color:var(--ds-ink);background:var(--ds-paper-card);border:var(--ds-line-thin) solid var(--ds-ink);box-shadow:4px 4px 0 var(--ds-mint);font-size:16px;white-space:nowrap}
.panel:is([data-kind=room],[data-kind=rooms]) .row{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px}`,
  B: fs.readFileSync('/tmp/space-doodle/verify-16/candB.css', 'utf8'),
};
const sleep = ms => new Promise(r => setTimeout(r, ms));
const kill = setTimeout(() => { console.error('watchdog'); process.exit(2); }, 280000);
async function info(page) {
  return page.evaluate(() => {
    const body = document.querySelector('#panel-body'), row = body.querySelector(':scope>.row');
    const rs = row && getComputedStyle(row);
    const btns = [...body.querySelectorAll('button')].filter(b => b.getClientRects().length).map(b => {
      const cs = getComputedStyle(b), r = b.getBoundingClientRect();
      const range = document.createRange(); range.selectNodeContents(b);
      const lines = new Set([...range.getClientRects()].map(x => Math.round(x.top))).size;
      return `${b.textContent.trim().slice(0, 12)}|${b.className}|w${Math.round(r.width)} h${Math.round(r.height)} lines${lines}|bg ${cs.backgroundColor}|flex ${cs.flex}|minW ${cs.minWidth}|overflowX ${b.scrollWidth > b.clientWidth + 1}`;
    });
    return { kind: document.querySelector('#panel').dataset.kind, row: rs && `${rs.display} wrap=${rs.flexWrap} cols=${rs.gridTemplateColumns} gap=${rs.gap} w=${Math.round(row.getBoundingClientRect().width)}`, btns,
      inkCount: [...body.querySelectorAll('button')].filter(b => b.getClientRects().length && getComputedStyle(b).backgroundColor === 'rgb(28, 27, 26)').length };
  });
}
async function snap(page, name) {
  await page.evaluate(() => document.activeElement?.blur?.());
  await page.evaluate(() => { const b = document.querySelector('#panel-body'); const t = b.querySelector(':scope>.row') || b.querySelector('.entry-list'); t?.scrollIntoView({ block: 'start' }); document.querySelector('#panel').scrollTop -= 60; });
  await sleep(450);
  await page.screenshot({ path: `${OUT}/${name}.png` });
}
(async () => {
  const kinds = (process.argv[2] || 'phone,desktop,narrow').split(',');
  const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
  try {
    for (const kind of kinds) {
      const ctx = await browser.newContext({ ...VP[kind] });
      const page = await ctx.newPage();
      page.on('pageerror', e => console.log('[pageerror]', e.message.slice(0, 160)));
      await page.goto(URL, { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => window.__SPACE_BOOT__ === 'ready', null, { timeout: 90000 });
      await page.waitForFunction(() => document.querySelector('#loading')?.hidden === true, null, { timeout: 60000 }).catch(() => {});
      await page.evaluate(() => document.fonts.ready); await sleep(700);
      await page.locator('button:visible', { hasText: '进入示例现场' }).first().click();
      await page.waitForSelector('form[data-form="demo-entry"]', { timeout: 20000 });
      await page.locator('form[data-form="demo-entry"] input[name=consent]').check();
      await page.waitForSelector('form[data-form="demo-entry"] button[type=submit]:not([disabled])', { timeout: 60000 });
      await page.locator('form[data-form="demo-entry"] button[type=submit]').click();
      await page.waitForFunction(() => !document.querySelector('form[data-form="demo-entry"]'), null, { timeout: 60000 });
      await page.waitForFunction(() => (window.__SPACE_EVENT_QA__?.()?.members || []).length > 1, null, { timeout: 30000 }).catch(() => {});
      await sleep(2500);
      for (const panelKind of ['room', 'rooms']) {
        if (panelKind === 'room') { await page.click('#room-info'); }
        else { await page.click('#panel-body .row button[data-open=rooms]'); }
        await page.waitForFunction(k => document.querySelector('#panel')?.dataset.kind === k && !document.querySelector('#panel').hidden, panelKind, { timeout: 15000 });
        await page.evaluate(() => document.fonts.ready); await sleep(1300);
        console.log(kind, panelKind, 'NOW', JSON.stringify(await info(page), null, 1));
        await snap(page, `proto-${panelKind}-now-${kind}`);
        for (const c of ['A', 'B']) {
          const tag = await page.addStyleTag({ content: CAND[c] });
          await sleep(400);
          console.log(kind, panelKind, c, JSON.stringify(await info(page), null, 1));
          await snap(page, `proto-${panelKind}-${c}-${kind}`);
          await tag.evaluate(el => el.remove());
        }
        if (panelKind === 'room') await page.evaluate(() => { document.querySelector('#panel').scrollTop = 0; });
      }
      await ctx.close();
    }
  } catch (e) { console.error('ERR', e.message.split('\n')[0]); }
  await browser.close();
  clearTimeout(kill);
})();
