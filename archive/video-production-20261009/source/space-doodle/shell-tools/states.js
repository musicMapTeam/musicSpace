const {chromium} = require('/tmp/space-video-prep/tools/node_modules/playwright-core');
const wait = ms => new Promise(r => setTimeout(r, ms));
(async()=>{
  const browser = await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
  for (const [name,vp] of [['phone',{width:390,height:844,deviceScaleFactor:2}],['desktop',{width:1440,height:900,deviceScaleFactor:1}]]) {
    const page = await (await browser.newContext({viewport:{width:vp.width,height:vp.height},deviceScaleFactor:vp.deviceScaleFactor})).newPage();
    await page.goto('http://127.0.0.1:5190/'); await page.waitForFunction(()=>window.__SPACE_BOOT__==='ready',null,{timeout:60000});
    await page.evaluate(()=>document.fonts.ready); await wait(1500);
    await page.evaluate(()=>{document.querySelector('#loading').hidden=false;});
    await wait(500); await page.screenshot({path:`/tmp/space-doodle/shots/shell/check-loading-${name}.png`});
    await page.evaluate(()=>{document.querySelector('#loading').hidden=true;const e=document.querySelector('#error');e.hidden=false;e.innerHTML='<h2>三维现场暂时没有打开</h2><p>入场、照片和同场名单仍可使用。你可以继续操作，也可以换一个支持 WebGL2 的浏览器。</p>';});
    await wait(300); await page.screenshot({path:`/tmp/space-doodle/shots/shell/check-error-${name}.png`});
    await page.evaluate(()=>{const e=document.querySelector('#error');e.hidden=true;const b=document.querySelector('#connection-banner');b.hidden=false;b.textContent='示例数据只保存在本页，刷新会重置';});
    await wait(300); await page.screenshot({path:`/tmp/space-doodle/shots/shell/check-banner-${name}.png`});
    await page.context().close();
  }
  await browser.close();
})();
