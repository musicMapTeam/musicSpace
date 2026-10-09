const {chromium} = require('/tmp/space-video-prep/tools/node_modules/playwright-core');
(async()=>{
  const browser = await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
  const page = await (await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2})).newPage();
  await page.goto('http://127.0.0.1:5190/'); await page.waitForFunction(()=>window.__SPACE_BOOT__==='ready',null,{timeout:60000});
  await page.evaluate(()=>document.fonts.ready);
  const r = await page.evaluate(async()=>{
    const out={};
    for (const fam of ['Doodle Display','Doodle Marker','Doodle Hand']) {
      await document.fonts.load(`44px "${fam}"`, '同一刻，另一面。');
      const c=document.createElement('canvas').getContext('2d'); c.font=`44px "${fam}"`;
      out[fam]=['同','一','刻','，','另','面','。','同一刻，','另一面。'].map(t=>t+':'+c.measureText(t).width.toFixed(1)).join(' ');
    }
    const t=document.querySelector('#presence-title'); const range=document.createRange(); range.selectNodeContents(t);
    out.rects=[...range.getClientRects()].map(r=>[r.left.toFixed(1),r.top.toFixed(1),r.width.toFixed(1),r.height.toFixed(1)].join(','));
    out.box=JSON.stringify(t.getBoundingClientRect());
    out.channel=document.documentElement.dataset.channel;
    return out;
  });
  console.log(JSON.stringify(r,null,1));
  await browser.close();
})();
