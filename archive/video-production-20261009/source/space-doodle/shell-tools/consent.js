const {chromium} = require('/tmp/space-video-prep/tools/node_modules/playwright-core');
const wait = ms => new Promise(r => setTimeout(r, ms));
(async()=>{
  const browser = await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
  const page = await (await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:3})).newPage();
  await page.goto('http://127.0.0.1:5190/'); await page.waitForFunction(()=>window.__SPACE_BOOT__==='ready',null,{timeout:60000});
  await page.evaluate(()=>document.fonts.ready); await wait(1200);
  await page.click('#join'); await page.waitForSelector('form[data-form="demo-entry"]');
  await page.waitForFunction(() => !document.querySelector('form[data-form="demo-entry"] button.primary')?.disabled, null, {timeout:30000}).catch(()=>{});
  await page.check('form[data-form="demo-entry"] input[name="consent"]'); await wait(500);
  const box = await page.$('form[data-form="demo-entry"] .consent');
  await box.scrollIntoViewIfNeeded(); await wait(300);
  const b = await box.boundingBox();
  await page.screenshot({path:'/tmp/space-doodle/shots/shell/zoom-consent.png', clip:{x:0,y:b.y-150,width:390,height:b.height+260}});
  // keyboard focus ring on the name input and the submit
  await page.focus('form[data-form="demo-entry"] input[name="name"]'); await page.keyboard.press('Shift+Tab'); await page.keyboard.press('Tab'); await wait(300);
  const n = await (await page.$('form[data-form="demo-entry"] input[name="name"]')).boundingBox();
  await page.screenshot({path:'/tmp/space-doodle/shots/shell/zoom-focus.png', clip:{x:0,y:Math.max(0,n.y-60),width:390,height:150}});
  await browser.close();
})();
