const out={};
for (const vp of ['w390','w1440']) {
  const key='b'+vp; await drop(key);
  const {page}=await get(vp,{key});
  // count timer delays from now on
  await page.evaluate(()=>{const st=window.setTimeout;window.__t=[];window.setTimeout=(f,ms,...a)=>{window.__t.push(Math.round(ms||0));return st(f,ms,...a);};});
  await sleep(500);
  const count=async ms=>{await page.evaluate(()=>{window.__t.length=0;});await sleep(ms);return page.evaluate(()=>({b143:window.__t.filter(t=>t===143).length,b500:window.__t.filter(t=>t===500).length}));};
  const probe=()=>page.evaluate(()=>{const c=document.querySelector('#world canvas'),r=c.getBoundingClientRect();return [[.5,.5],[.18,.22],[.82,.22],[.18,.78],[.82,.78]].map(([fx,fy])=>{const e=document.elementFromPoint(r.left+r.width*fx,r.top+r.height*fy);return e===c?'canvas':(e?.id?('#'+e.id):(e?.className?.toString?.().split(' ')[0]||e?.tagName));});});
  out[vp]={lobby:{...(await count(3000)),probe:await probe()}};
  // open the entry panel (covers the canvas on phones)
  await page.locator('#join').click(); await page.waitForSelector('form[data-form="demo-entry"]'); await sleep(800);
  out[vp].entry={...(await count(3000)),probe:await probe()};
  await page.locator('form[data-form="demo-entry"] input[name=consent]').check({force:true});
  await page.waitForFunction(()=>!document.querySelector('form[data-form="demo-entry"] button[type=submit]')?.disabled,null,{timeout:60000});
  await page.locator('form[data-form="demo-entry"] button[type=submit]').click();
  await page.waitForFunction(()=>!document.querySelector('form[data-form="demo-entry"]'),null,{timeout:60000}); await sleep(1500);
  out[vp].room={...(await count(3000)),probe:await probe()};
  await drop(key);
}
return out;
