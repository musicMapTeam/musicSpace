const S='/tmp/space-doodle/shots/3d';const out={};
const settle=async page=>{const t0=Date.now();await sleep(250);while(Date.now()-t0<6000){const m=await page.evaluate(()=>window.__SPACE_EVENT_QA__?.()?.camera?.moving);if(!m)break;await sleep(80);}await sleep(900);};
// tablet 768x1024: lobby, room (4 people), room after the fifth member arrives
{const key='x768';await drop(key);const {page}=await get('w768',{key});
 await page.screenshot({path:`${S}/after-landing-tablet.png`});
 await enter(page);await sleep(500);await page.screenshot({path:`${S}/after-overview-tablet.png`});
 await page.waitForFunction(()=>(window.__SPACE_EVENT_QA__?.()?.camera?.scene?.peopleCount||0)>=5,null,{timeout:25000}).catch(()=>{});await sleep(1500);
 await page.screenshot({path:`${S}/after-overview5-tablet.png`});
 out.tablet=await page.evaluate(()=>({people:window.__SPACE_EVENT_QA__?.()?.camera?.scene?.peopleCount,hidden:[...document.querySelectorAll('#hotspots .hotspot')].filter(n=>n.hidden).map(n=>n.textContent.trim().slice(0,10))}));
 await drop(key);}
// desktop 1536x730 benches without UI, and 1280x720 room with five people
{const key='x1536';await drop(key);const {page}=await get('w1440',{key});await page.setViewportSize({width:1536,height:730});await sleep(800);
 await enter(page);await sleep(800);
 await page.evaluate(()=>{const st=document.createElement('style');st.id='clean3d';st.textContent='#app .frame > *:not(.world-shell), .world-shell > *:not(#world), .desktop-caption, #toast, #connection-banner, #panel { visibility:hidden !important }';document.head.append(st);});
 await sleep(400);await page.screenshot({path:`${S}/after-benches-desktop.png`});await drop(key);}
{const key='x1280';await drop(key);const {page}=await get('w1440',{key});await page.setViewportSize({width:1280,height:720});await sleep(800);
 await enter(page);await page.waitForFunction(()=>(window.__SPACE_EVENT_QA__?.()?.camera?.scene?.peopleCount||0)>=5,null,{timeout:25000}).catch(()=>{});await sleep(1500);
 await page.screenshot({path:`${S}/after-overview5-desktop1280.png`});await drop(key);}
// phone entry sheet (boil paused under it)
{const key='xphone';await drop(key);const {page}=await get('w390',{key});
 await page.locator('#join').click();await page.waitForSelector('form[data-form="demo-entry"]');await sleep(800);
 await page.screenshot({path:`${S}/after-entry-sheet-phone.png`});await drop(key);}
return out;
