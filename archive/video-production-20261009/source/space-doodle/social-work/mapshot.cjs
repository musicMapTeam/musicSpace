const {chromium}=require('/tmp/space-video-prep/tools/node_modules/playwright-core');
(async()=>{const b=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
for(const [kind,opt] of [['phone',{viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true}],['desktop',{viewport:{width:1440,height:900}}]]){
 const ctx=await b.newContext(opt);const p=await ctx.newPage();await p.goto('http://127.0.0.1:5393/musicSpace/music-map/#/explore',{waitUntil:'domcontentloaded'});await p.waitForTimeout(5000);
 await p.screenshot({path:`/tmp/space-doodle/social-work/now/map-page-${kind}.png`});await ctx.close();}
await b.close();})();
