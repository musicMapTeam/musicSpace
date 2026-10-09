const vp='w390';
await drop(vp);
const {page}=await get(vp);
await L.enter(page);
const skip=page.locator('button:visible',{hasText:'跳过路线'});if(await skip.count())await skip.first().click().catch(()=>{});
await sleep(800);
const client=await page.context().newCDPSession(page);
await client.send('DOM.enable');await client.send('CSS.enable');
async function fontsFor(selector){
  const {root}=await client.send('DOM.getDocument',{depth:-1});
  const {nodeIds}=await client.send('DOM.querySelectorAll',{nodeId:root.nodeId,selector});
  const out=[];
  for(const id of nodeIds.slice(0,4)){
    const {fonts}=await client.send('CSS.getPlatformFontsForNode',{nodeId:id});
    const {computedStyle}=await client.send('CSS.getComputedStyleForNode',{nodeId:id});
    const fs=computedStyle.find(p=>p.name==='font-size').value;
    out.push({fs,fonts:fonts.map(f=>`${f.familyName}${f.isCustomFont?' (web)':''} x${f.glyphCount}`)});
  }
  return out;
}
const res={};
const ppl=await L.people(page);
await L.openKind(page,'person',ppl[0].id);await sleep(900);
res.personFine=await fontsFor('#panel-body p.fine');
await L.closeEverything(page);
await L.openKind(page,'recap');await sleep(2000);
res.recapVenue=await fontsFor('.recap-venue');
res.recapOther=await fontsFor('.recap-ticket h2, .recap-ticket p');
return res;
