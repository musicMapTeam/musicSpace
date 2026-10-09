const {chromium} = require('/tmp/space-video-prep/tools/node_modules/playwright-core');
const wait = ms => new Promise(r => setTimeout(r, ms));
async function check(page,label){
  const r = await page.evaluate(()=>{
    const vw=document.documentElement.clientWidth, out=[];
    const sel='header *, header, .scene-heading, .scene-heading *, .scene-code, .presence, .presence *, .camera-nav, .camera-nav *, footer, footer *, #panel, #panel *, #toast, .hotspot .label';
    for(const el of document.querySelectorAll(sel)){
      const cs=getComputedStyle(el); if(cs.display==='none'||cs.visibility==='hidden')continue;
      const b=el.getBoundingClientRect(); if(!b.width)continue;
      if(b.right>vw+0.5||b.left<-0.5) out.push(`${el.tagName.toLowerCase()}${el.id?'#'+el.id:''}.${[...el.classList].join('.')} L${b.left.toFixed(0)} R${b.right.toFixed(0)}`);
      if((el.scrollWidth>el.clientWidth+1)&&cs.overflowX!=='visible'&&!['hotspot'].some(c=>el.classList.contains(c))&&el.clientWidth>0&&cs.textOverflow!=='ellipsis'&&!el.closest('.hotspot')) out.push(`clipped ${el.tagName.toLowerCase()}${el.id?'#'+el.id:''}.${[...el.classList].join('.')} sw${el.scrollWidth} cw${el.clientWidth}`);
    }
    const h=document.querySelector('.frame>header'); const kids=[...h.children].filter(e=>getComputedStyle(e).display!=='none');
    const tops=new Set(kids.map(e=>Math.round(e.getBoundingClientRect().top/10)));
    return {doc:document.documentElement.scrollWidth+'/'+vw, headerRows:tops.size, headerKids:kids.map(e=>(e.id||e.className)+':'+Math.round(e.getBoundingClientRect().width)+'x'+Math.round(e.getBoundingClientRect().height)).join(' '), out};
  });
  console.log(label, JSON.stringify(r));
}
(async()=>{
  const browser = await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
  for (const [w,h] of [[320,640],[360,740],[390,844],[768,1024]]) {
    const page = await (await browser.newContext({viewport:{width:w,height:h},deviceScaleFactor:1})).newPage();
    await page.goto('http://127.0.0.1:5190/'); await page.waitForFunction(()=>window.__SPACE_BOOT__==='ready',null,{timeout:60000});
    await page.evaluate(()=>document.fonts.ready); await wait(1200);
    await check(page, `${w}x${h} lobby`);
    await page.click('#join'); await page.waitForSelector('form[data-form="demo-entry"]');
    await page.waitForFunction(() => !document.querySelector('form[data-form="demo-entry"] button.primary')?.disabled, null, {timeout:30000}).catch(()=>{});
    await check(page, `${w}x${h} join`);
    await page.check('form[data-form="demo-entry"] input[name="consent"]'); await page.click('form[data-form="demo-entry"] button.primary');
    await page.waitForFunction(() => document.querySelector('.frame')?.dataset.stage === 'room', null, {timeout: 30000}); await wait(2500);
    await check(page, `${w}x${h} room`);
    await page.context().close();
  }
  await browser.close();
})();
