const {chromium} = require('/tmp/space-video-prep/tools/node_modules/playwright-core');
const wait = ms => new Promise(r => setTimeout(r, ms));
const which = process.argv[2] || 'phone';
const VP = which==='phone'?{width:390,height:844,deviceScaleFactor:2}:{width:1440,height:900,deviceScaleFactor:1};
(async()=>{
  const browser = await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
  const page = await (await browser.newContext({viewport:{width:VP.width,height:VP.height},deviceScaleFactor:VP.deviceScaleFactor})).newPage();
  page.on('pageerror', e => console.log('[pageerror]', e.message));
  await page.goto('http://127.0.0.1:5190/'); await page.waitForFunction(()=>window.__SPACE_BOOT__==='ready',null,{timeout:60000});
  await page.evaluate(()=>document.fonts.ready); await wait(1500);
  await page.click('#join'); await page.waitForSelector('form[data-form="demo-entry"]');
  await page.waitForFunction(() => !document.querySelector('form[data-form="demo-entry"] button.primary')?.disabled, null, {timeout:30000}).catch(()=>{});
  await page.check('form[data-form="demo-entry"] input[name="consent"]'); await page.click('form[data-form="demo-entry"] button.primary');
  await page.waitForFunction(() => document.querySelector('.frame')?.dataset.stage === 'room', null, {timeout: 30000}); await wait(2500);
  const shot = async n => { await page.screenshot({path:`/tmp/space-doodle/shots/shell/check-${n}-${which}.png`}); console.log('saved',n); };
  await page.click('.camera-nav [data-view="photos"]'); await wait(3500); await shot('photos-view');
  await page.click('.camera-nav [data-view="person"]'); await wait(2500); await shot('people');
  await page.click('#panel-close').catch(()=>{}); await wait(800);
  await page.click('.camera-nav [data-view="overview"]'); await wait(2500);
  await page.click('#my-look'); await wait(2000); await shot('wardrobe');
  await page.keyboard.press('Escape'); await wait(500);
  const closeW = await page.$('.wardrobe-header button'); if (closeW) { await closeW.click(); await wait(800); }
  await page.click('#music-map-entry').catch(e=>console.log('map click failed', e.message)); await wait(2500); await shot('musicmap');
  await browser.close();
})();
