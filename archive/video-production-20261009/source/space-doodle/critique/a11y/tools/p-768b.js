const {page}=pages['w768'];
const tags=()=>page.evaluate(()=>[...document.querySelectorAll('#hotspots .hotspot')].map(n=>n.textContent.trim()+(n.hidden?' [hidden]':' @'+Math.round(n.getBoundingClientRect().left))));
const before=await tags();
await page.locator('nav.camera-nav button[data-view="overview"]').click();await sleep(4000);
const afterOverviewClick=await tags();
await page.screenshot({path:'/tmp/space-doodle/critique/a11y/evidence/w768-room-after-overview-click.png'});
// go to person view and back
await page.locator('nav.camera-nav button[data-view="person"]').click();await sleep(3000);
await L.closeEverything(page);
await page.locator('nav.camera-nav button[data-view="overview"]').click();await sleep(4000);
const afterRoundTrip=await tags();
await page.screenshot({path:'/tmp/space-doodle/critique/a11y/evidence/w768-room-after-roundtrip.png'});
return {before,afterOverviewClick,afterRoundTrip};
