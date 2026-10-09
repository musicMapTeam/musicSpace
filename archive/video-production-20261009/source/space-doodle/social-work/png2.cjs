// node png2.cjs <mode: both|one|none> <out.png> [note]
const L=require('./lib.cjs');
const fs=require('fs');
(async()=>{const b=await L.launch();const ctx=await b.newContext({viewport:{width:800,height:800}});const page=await ctx.newPage();
page.on('pageerror',e=>console.log('[pageerror]',e.message));
await page.goto(L.URL,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__SPACE_BOOT__==='ready',null,{timeout:90000});
const mode=process.argv[2]||'both',out=process.argv[3]||'/tmp/space-doodle/social-work/now/corner-png-variant.png';
const note=process.argv[4]||'返场那首我在台下跟着唱，灯一亮全场都在挥手。';
const data=await page.evaluate(async([note,mode])=>{
  const {renderCornerPng}=await import('/corner-png.js');
  const model=await import('/@fs/Users/alakazan/workplace/tme/musicSpace/web/avatar/model.js');
  const a1=model.DEFAULT_AVATAR, a2=model.applyLookPreset?model.applyLookPreset(model.DEFAULT_AVATAR,model.TEMPLATES[2].avatar):model.DEFAULT_AVATAR;
  const p1=await (await fetch('/demo/yao-stage.jpg')).blob(), p2=await (await fetch('/demo/man-crowd.jpg')).blob();
  const photos=new Map(mode==='none'?[]:mode==='one'?[['a',p1]]:[['a',p1],['b',p2]]);
  const blob=await renderCornerPng({contributions:[{userId:'a',name:'阿遥·示例',note:'这一晚，我在舞台前排。',avatar:a1},{userId:'b',name:'访客5323',note,avatar:a2}],revision:3,photos});
  const buf=new Uint8Array(await blob.arrayBuffer());let s='';for(let i=0;i<buf.length;i+=0x8000)s+=String.fromCharCode.apply(null,buf.subarray(i,i+0x8000));
  return btoa(s);
},[note,mode]);
fs.writeFileSync(out,Buffer.from(data,'base64'));console.log('saved',out);
await b.close();})();
