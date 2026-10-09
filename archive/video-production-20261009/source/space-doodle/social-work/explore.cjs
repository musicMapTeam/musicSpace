const L=require('./lib.cjs');
(async()=>{const b=await L.launch();const {ctx,page}=await L.open(b,'desktop');
console.log('before enter', (await L.visibleButtons(page)).join(' | '));
await L.enter(page);
console.log('after enter', (await L.visibleButtons(page)).join(' | '));
await page.screenshot({path:'/tmp/space-doodle/social-work/x-after-enter.png'});
await b.close();})().catch(e=>{console.error(e);process.exit(1);});
