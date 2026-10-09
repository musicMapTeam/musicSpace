const {chromium} = require('/tmp/space-video-prep/tools/node_modules/playwright-core');
const wait = ms => new Promise(r => setTimeout(r, ms));
(async()=>{
  const browser = await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
  const page = await (await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:3})).newPage();
  await page.goto('http://127.0.0.1:5190/'); await page.waitForFunction(()=>window.__SPACE_BOOT__==='ready',null,{timeout:60000});
  await page.evaluate(()=>document.fonts.ready); await wait(2000);
  const clips={top:{x:0,y:0,width:390,height:200},presence:{x:0,y:400,width:390,height:350},bottom:{x:0,y:720,width:390,height:124}};
  for(const [k,c] of Object.entries(clips)) await page.screenshot({path:`/tmp/space-doodle/shots/shell/zoom-lobby-${k}.png`,clip:c});
  await page.click('#join'); await page.waitForSelector('form[data-form="demo-entry"]');
  await page.waitForFunction(() => !document.querySelector('form[data-form="demo-entry"] button.primary')?.disabled, null, {timeout:30000}).catch(()=>{});
  await page.check('form[data-form="demo-entry"] input[name="consent"]'); await page.click('form[data-form="demo-entry"] button.primary');
  await page.waitForFunction(() => document.querySelector('.frame')?.dataset.stage === 'room', null, {timeout: 30000}); await wait(3000);
  await page.screenshot({path:`/tmp/space-doodle/shots/shell/zoom-room-top.png`,clip:{x:0,y:0,width:390,height:300}});
  await browser.close();
})();
