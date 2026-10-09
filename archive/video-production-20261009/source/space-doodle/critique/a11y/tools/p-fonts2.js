const {page}=pages['w390'];
const client=await page.context().newCDPSession(page);
await client.send('DOM.enable');await client.send('CSS.enable');
// split recap h2 into per-character spans in a cloned node appended off-screen but same styles
const txt=await page.evaluate(()=>{const h=document.querySelector('.recap-ticket h2');const c=h.cloneNode(false);c.id='a11y-clone';for(const ch of h.textContent){const s=document.createElement('span');s.textContent=ch;c.append(s);}h.after(c);return h.textContent;});
const {root}=await client.send('DOM.getDocument',{depth:-1});
const {nodeIds}=await client.send('DOM.querySelectorAll',{nodeId:root.nodeId,selector:'#a11y-clone > span'});
const out=[];
for(const id of nodeIds){const {fonts}=await client.send('CSS.getPlatformFontsForNode',{nodeId:id});const t=await client.send('DOM.describeNode',{nodeId:id,depth:1});out.push(fonts.map(f=>f.familyName).join('+'));}
await page.evaluate(()=>document.querySelector('#a11y-clone')?.remove());
return {txt,chars:[...txt].map((c,i)=>c+':'+out[i]).join(' ')};
