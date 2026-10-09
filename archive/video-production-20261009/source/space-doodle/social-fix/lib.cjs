const {chromium}=require('/tmp/space-video-prep/tools/node_modules/playwright-core');
const URL=process.env.SPACE_URL||'http://127.0.0.1:5190/';
const VP={
 phone:{viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true},
 desktop:{viewport:{width:1440,height:900},deviceScaleFactor:1},
 narrow:{viewport:{width:320,height:568},deviceScaleFactor:2,isMobile:true,hasTouch:true},
 tablet:{viewport:{width:768,height:1024},deviceScaleFactor:2,isMobile:true,hasTouch:true},
};
async function launch(){return chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--use-gl=angle','--enable-webgl','--ignore-gpu-blocklist']});}
async function open(browser,kind,opts={}){const ctx=await browser.newContext({...VP[kind],reducedMotion:opts.reducedMotion||'no-preference'});const page=await ctx.newPage();page.on('pageerror',e=>console.log('[pageerror]',kind,e.message.slice(0,200)));await page.goto(URL,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__SPACE_BOOT__==='ready',null,{timeout:90000});return {ctx,page};}
async function enter(page){
  const btn=page.locator('#panel-body form[data-form="demo-entry"]');
  if(!(await btn.count())){await page.locator('button:visible',{hasText:'进入示例现场'}).first().click();}
  await page.waitForSelector('form[data-form="demo-entry"] button.primary:not([disabled])',{timeout:60000});
  await page.locator('form[data-form="demo-entry"] input[name=consent]').check();
  await page.locator('form[data-form="demo-entry"] button.primary').click();
  await page.waitForFunction(()=>!document.querySelector('form[data-form="demo-entry"]'),null,{timeout:60000});
  await page.waitForTimeout(1500);
}
module.exports={launch,open,enter,URL,VP};
module.exports.enterForce=async function(page){
  const btn=page.locator('#panel-body form[data-form="demo-entry"]');
  if(!(await btn.count())){await page.locator('button:visible',{hasText:'进入示例现场'}).first().click();}
  await page.waitForSelector('form[data-form="demo-entry"] button.primary:not([disabled])',{timeout:60000});
  await page.locator('form[data-form="demo-entry"] input[name=consent]').check({force:true});
  await page.locator('form[data-form="demo-entry"] button.primary').click();
  await page.waitForFunction(()=>!document.querySelector('form[data-form="demo-entry"]'),null,{timeout:60000});
  await page.waitForTimeout(1500);
};
