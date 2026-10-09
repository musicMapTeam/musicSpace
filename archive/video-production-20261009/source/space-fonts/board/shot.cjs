const {chromium}=require('/tmp/space-video-prep/tools/node_modules/playwright-core');
(async()=>{const b=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const p=await b.newPage({viewport:{width:1600,height:900},deviceScaleFactor:1});await p.goto('file:///tmp/space-fonts/board/index.html');await p.evaluate(()=>document.fonts.ready);await p.waitForTimeout(800);
await p.screenshot({path:'/tmp/space-fonts/board/BOARD.png',fullPage:true});await b.close()})()
