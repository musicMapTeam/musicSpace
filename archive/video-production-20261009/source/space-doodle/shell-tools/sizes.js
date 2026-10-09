const {chromium} = require('/tmp/space-video-prep/tools/node_modules/playwright-core');
const wait = ms => new Promise(r => setTimeout(r, ms));
(async()=>{
  const browser = await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
  for (const [w,h,enter] of (JSON.parse(process.argv[2]||'[[768,1024,1],[1280,800,0],[390,844,0]]'))) {
    const page = await (await browser.newContext({viewport:{width:w,height:h},deviceScaleFactor:1})).newPage();
    await page.goto('http://127.0.0.1:5190/'); await page.waitForFunction(()=>window.__SPACE_BOOT__==='ready',null,{timeout:60000});
    await page.evaluate(()=>document.fonts.ready); await wait(1800);
    await page.screenshot({path:`/tmp/space-doodle/shots/shell/check-lobby-${w}x${h}.png`});
    if (enter) {
      await page.click('#join'); await page.waitForSelector('form[data-form="demo-entry"]');
      await page.waitForFunction(() => !document.querySelector('form[data-form="demo-entry"] button.primary')?.disabled, null, {timeout:30000}).catch(()=>{});
      await page.check('form[data-form="demo-entry"] input[name="consent"]'); await page.click('form[data-form="demo-entry"] button.primary');
      await page.waitForFunction(() => document.querySelector('.frame')?.dataset.stage === 'room', null, {timeout: 30000}); await wait(2500);
      await page.screenshot({path:`/tmp/space-doodle/shots/shell/check-room-${w}x${h}.png`});
    }
    await page.context().close();
  }
  await browser.close();
})();
