// Keyboard and screen-reader check of the 来源 disclosure on the hand card and in a paper.
const { chromium } = require('/tmp/space-video-prep/tools/node_modules/playwright-core');
(async () => {
  const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: ['--use-angle=metal'] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(process.argv[2] + '#/explore', { waitUntil: 'load' }); await page.waitForTimeout(4000);
  await page.locator('[data-map-action="flip"]').first().focus(); await page.keyboard.press('Enter'); await page.waitForTimeout(600);
  const chip = page.locator('.map-round-card.is-open [data-map-action="edge"]').first();
  console.log('chip', await chip.getAttribute('aria-label'), await chip.getAttribute('aria-haspopup'), await chip.innerText());
  await chip.focus(); await page.keyboard.press('Enter'); await page.waitForTimeout(700);
  const state = async () => page.evaluate(() => { const a = document.activeElement; const d = a.closest('details'); return { focus: `${a.tagName} ${a.textContent.trim().slice(0, 30)}`, open: d?.open, inDialog: Boolean(a.closest('dialog[open]')) }; });
  console.log('after chip', JSON.stringify(await state()));
  await page.keyboard.press('Enter'); await page.waitForTimeout(200); console.log('enter', JSON.stringify(await state()));
  await page.keyboard.press(' '); await page.waitForTimeout(200); console.log('space', JSON.stringify(await state()));
  await page.keyboard.press('Tab'); await page.waitForTimeout(100); console.log('tab', JSON.stringify(await state()));
  const tree = await page.accessibility?.snapshot?.({ root: await page.$('dialog[open] details.map-sources') }).catch(() => null);
  console.log('a11y', JSON.stringify(tree)?.slice(0, 300));
  const cdp = await page.context().newCDPSession(page);
  const { nodes } = await cdp.send('Accessibility.getFullAXTree');
  const summary = nodes.find(n => n.name?.value?.startsWith('来源'));
  console.log('AX summary:', summary?.role?.value, '|', summary?.name?.value, '|', JSON.stringify(summary?.properties?.filter(p => ['expanded', 'focusable'].includes(p.name)).map(p => `${p.name}=${p.value.value}`)));
  await page.keyboard.press('Escape'); await page.waitForTimeout(500);
  console.log('escape', JSON.stringify(await page.evaluate(() => ({ dialog: Boolean(document.querySelector('dialog[open]')), focus: `${document.activeElement.tagName} ${document.activeElement.getAttribute('aria-label') || document.activeElement.textContent.trim().slice(0, 20)}` }))));
  await browser.close();
})();
