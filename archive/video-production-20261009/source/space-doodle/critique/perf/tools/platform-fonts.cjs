// Which actual fonts render given elements (CDP CSS.getPlatformFontsForNode), first paint markup, desktop.
const {chromium} = require('/tmp/space-video-prep/tools/node_modules/playwright-core');
(async () => {
  const browser = await chromium.launch({executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
  const ctx = await browser.newContext({viewport: {width: 1440, height: 900}, javaScriptEnabled: false});
  const page = await ctx.newPage(); await page.goto(process.argv[2], {waitUntil: 'load'}); await page.waitForTimeout(2500);
  const cdp = await ctx.newCDPSession(page); await cdp.send('DOM.enable'); await cdp.send('CSS.enable');
  const {root} = await cdp.send('DOM.getDocument', {depth: -1});
  for (const sel of ['#music-map-entry span', '#my-look span', '#social-inbox', '.loading p', '.desktop-caption .caption-note', '#room-info', '.track .record']) {
    const {nodeId} = await cdp.send('DOM.querySelector', {nodeId: root.nodeId, selector: sel});
    if (!nodeId) { console.log(sel, 'not found'); continue; }
    const {fonts} = await cdp.send('CSS.getPlatformFontsForNode', {nodeId});
    console.log(sel.padEnd(32), JSON.stringify(fonts.map(f => `${f.familyName}${f.isCustomFont ? ' (web)' : ''}: ${f.glyphCount}`)));
  }
  await browser.close();
})();
