const {page}=await get('desktop');
const out={};
await page.locator('#panel-close').click().catch(()=>{}); await sleep(800);
await page.locator('[data-view="photos"]').click(); await sleep(2500);
out.photosView=await shot(page,'d08-photos-view-after-upload');
// click a polaroid in the 3D wall? list hotspots
out.hot=await page.evaluate(()=>[...document.querySelectorAll('#hotspots [data-scene-target], .hotspot')].map(n=>n.dataset.kind+':'+n.textContent.trim().slice(0,30)));
return out;
