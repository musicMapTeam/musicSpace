// A long-lived browser for probing: POST JS (async body with page/pages/L/sleep/shot) to http://127.0.0.1:<port>/run
// usage: node driver.cjs <port>   (stops itself after 50 minutes)
const http=require('http');const L=require('./lib.cjs');const fs=require('fs');
const port=+process.argv[2]||5291;const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let browser;const pages={};
async function get(kind){if(pages[kind])return pages[kind];const {ctx,page}=await L.open(browser,kind);pages[kind]={ctx,page};return pages[kind];}
async function openKind(page,k,id){await page.evaluate(([k,i])=>{const b=document.createElement('button');b.dataset.open=k;if(i)b.dataset.id=i;b.style.position='fixed';b.style.left='-9999px';document.body.append(b);b.click();b.remove();},[k,id]);await sleep(900);}
async function people(page){return page.evaluate(()=>[...document.querySelectorAll('#hotspots [data-kind="person"]')].map(n=>({id:n.dataset.sceneTarget,label:n.textContent.trim()})));}
async function closeEverything(page){for(let i=0;i<3;i++){await page.keyboard.press('Escape').catch(()=>{});await sleep(150);}await page.evaluate(()=>{const c=document.querySelector('#panel-close');if(c&&!document.querySelector('#panel').hidden)c.click();});await sleep(300);}
(async()=>{
 browser=await L.launch();
 const server=http.createServer(async(req,res)=>{let body='';req.on('data',c=>body+=c);req.on('end',async()=>{
  try{const fn=new Function('get','L','sleep','openKind','people','closeEverything','fs','pages','return (async()=>{'+body+'})()');
   const out=await Promise.race([fn(get,L,sleep,openKind,people,closeEverything,fs,pages),sleep(240000).then(()=>{throw Error('run timeout')})]);
   res.end(JSON.stringify(out===undefined?null:out,null,1));}
  catch(e){res.statusCode=500;res.end('ERR '+(e.stack||e.message));}});});
 server.listen(port,'127.0.0.1',()=>console.log('driver on',port,'pid',process.pid));
 setTimeout(async()=>{console.log('driver: time limit');await browser.close().catch(()=>{});process.exit(0);},50*60*1000);
 process.on('SIGTERM',async()=>{await browser.close().catch(()=>{});process.exit(0);});
})();
