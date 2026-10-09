const {chromium} = require('/tmp/space-video-prep/tools/node_modules/playwright-core');
(async()=>{
  const args = process.argv[2]==='plain' ? [] : ['--use-angle=metal','--enable-gpu','--ignore-gpu-blocklist'];
  const browser = await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args});
  const page = await (await browser.newContext({viewport:{width:1440,height:900}})).newPage();
  page.on('console', m => { if (m.type()==='error' || m.type()==='warning') console.log('[console]', m.type(), m.text().slice(0,200)); });
  page.on('pageerror', e => console.log('[pageerror]', e.message));
  await page.goto('http://127.0.0.1:5190/'); await page.waitForFunction(()=>window.__SPACE_BOOT__==='ready',null,{timeout:60000});
  await new Promise(r=>setTimeout(r,4000));
  console.log(await page.evaluate(()=>({error:!document.querySelector('#error').hidden, loading:!document.querySelector('#loading').hidden, html:document.querySelector('#error').innerText.slice(0,60)})));
  await browser.close();
})();
