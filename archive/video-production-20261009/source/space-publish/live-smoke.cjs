const {chromium}=require('/tmp/space-video-prep/tools/node_modules/playwright-core');
(async()=>{const b=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
for (const [name,vp] of [['phone',{viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true}],['desktop',{viewport:{width:1440,height:900}}]]){
 const c=await b.newContext(vp);const p=await c.newPage();const errs=[],api=[],fails=[],fonts=[],foreign=[];
 p.on('console',m=>{if(m.type()==='error')errs.push(m.text().slice(0,160))});p.on('pageerror',e=>errs.push(String(e).slice(0,160)));
 p.on('request',r=>{const u=r.url();if(/\/api\//.test(u))api.push(u);if(!u.startsWith('https://musicmapteam.github.io/musicSpace/preview/')&&!u.startsWith('data:')&&!u.startsWith('blob:'))foreign.push(u)});
 p.on('requestfailed',r=>fails.push(r.url().split('/').slice(-2).join('/')+' '+(r.failure()||{}).errorText));
 p.on('response',r=>{if(r.url().includes('/fonts/doodle/'))fonts.push(r.url().split('/').pop()+':'+r.status()+':'+(r.headers()['content-type']||''))});
 const t0=Date.now();await p.goto('https://musicmapteam.github.io/musicSpace/preview/',{waitUntil:'load'});
 let s;for(let i=0;i<60;i++){s=await p.evaluate(()=>window.__SPACE_BOOT__);if(s==='ready'||String(s).startsWith('failed'))break;await p.waitForTimeout(500)}
 await p.waitForTimeout(3000);
 const info=await p.evaluate(()=>({status:document.querySelector('#render-status')?.textContent,title:document.title,loaded:[...new Set([...document.fonts].filter(f=>f.status==='loaded').map(f=>f.family))].join(',')}));
 await p.screenshot({path:`/tmp/space-publish/live-${name}.png`});
 console.log(name,'boot:',s,'in',((Date.now()-t0)/1000).toFixed(1)+'s','|',info.status,'|',info.title);
 console.log('  fonts loaded:',info.loaded);console.log('  font files:',fonts.join(' '));
 console.log('  /api:',api.length,'foreign:',foreign.length,foreign.slice(0,3),'failed:',fails,'errors:',errs.slice(0,4));
 await c.close()}
await b.close()})()
