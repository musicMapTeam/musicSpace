const {chromium}=require('/tmp/space-video-prep/tools/node_modules/playwright-core');
(async()=>{const b=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--use-angle=metal','--enable-gpu']});
for (const [n,o] of [['phone',{viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true}],['desktop',{viewport:{width:1440,height:900}}]]){
 const c=await b.newContext(o);const p=await c.newPage();const errs=[];p.on('pageerror',e=>errs.push(String(e).slice(0,120)));
 await p.goto('https://musicmapteam.github.io/musicSpace/music-map/',{waitUntil:'load'});await p.waitForTimeout(9000);
 await p.screenshot({path:`/tmp/space-copy/map-live-${n}.png`});
 const t=await p.evaluate(()=>document.body.innerText.replace(/\s+/g,' ').slice(0,400));console.log(n,'errors:',errs.length,'| text:',t);await c.close()}
await b.close()})()
