const {chromium} = require('/tmp/space-video-prep/tools/node_modules/playwright-core');
(async()=>{
  const browser = await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
  const page = await (await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2})).newPage();
  await page.goto('http://127.0.0.1:5190/'); await page.waitForFunction(()=>window.__SPACE_BOOT__==='ready',null,{timeout:60000});
  const r = await page.evaluate(async()=>{
    await document.fonts.load('44px "Doodle Display"','同一刻，另一面。');
    const mk=(css)=>{const s=document.createElement('span');s.style.cssText='position:absolute;top:0;left:0;white-space:nowrap;font:44px "Doodle Display";'+css;s.textContent='刻，';document.body.append(s);const w=s.getBoundingClientRect().width;s.remove();return w.toFixed(1);};
    return {plain:mk(''),halt:mk('font-feature-settings:"halt"'),palt:mk('font-feature-settings:"palt"'),trim:mk('text-spacing-trim:trim-both'),chws:mk('font-feature-settings:"chws"')};
  });
  console.log(r); await browser.close();
})();
