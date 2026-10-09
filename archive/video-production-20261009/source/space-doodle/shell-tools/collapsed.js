const {chromium} = require('/tmp/space-video-prep/tools/node_modules/playwright-core');
const wait = ms => new Promise(r => setTimeout(r, ms));
(async()=>{
  const browser = await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
  const page = await (await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2})).newPage();
  await page.goto('http://127.0.0.1:5190/'); await page.waitForFunction(()=>window.__SPACE_BOOT__==='ready',null,{timeout:60000});
  await page.evaluate(()=>document.fonts.ready); await wait(1500);
  await page.click('#join'); await page.waitForSelector('form[data-form="demo-entry"]');
  await page.waitForFunction(() => !document.querySelector('form[data-form="demo-entry"] button.primary')?.disabled, null, {timeout:30000}).catch(()=>{});
  await page.check('form[data-form="demo-entry"] input[name="consent"]'); await page.click('form[data-form="demo-entry"] button.primary');
  await page.waitForFunction(() => document.querySelector('.frame')?.dataset.stage === 'room', null, {timeout: 30000}); await wait(2500);
  await page.click('.demo-tour-toggle').catch(e=>console.log('no toggle', e.message.slice(0,80)));
  await wait(1200);
  await page.screenshot({path:'/tmp/space-doodle/shots/shell/check-room-collapsed-phone.png'});
  await browser.close();
})();
