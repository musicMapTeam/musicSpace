// usage: node shoot.cjs <before|after> <phone|desktop> [screens comma list]
const L=require('./lib.cjs');
setTimeout(()=>{console.error('watchdog: giving up after 270s');process.exit(2);},270000).unref();
const [,,prefix='after',kind='phone',only='']=process.argv;
const want=only?new Set(only.split(',')):null;
const OUT=process.env.OUT||'/tmp/space-doodle/shots/social';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function openKind(page,kindName,id){await page.evaluate(([k,i])=>{const b=document.createElement('button');b.dataset.open=k;if(i)b.dataset.id=i;b.style.position='fixed';b.style.left='-9999px';document.body.append(b);b.click();b.remove();},[kindName,id]);await sleep(900);}
async function shot(page,name){if(want&&!want.has(name))return;await page.evaluate(()=>document.activeElement?.blur?.()).catch(()=>{});const path=`${OUT}/${prefix}-${name}-${kind}.png`;await page.screenshot({path});console.log('saved',path);}
async function people(page){return page.evaluate(()=>[...document.querySelectorAll('#hotspots [data-kind="person"]')].map(n=>({id:n.dataset.sceneTarget,label:n.textContent.trim()})));}
async function closeEverything(page){await page.evaluate(()=>{for(const sel of ['.wardrobe:not([hidden]) .wardrobe-header>button','.private-chat:not([hidden]) .chat-close','.room-moderation:not([hidden]) header>button']){const b=document.querySelector(sel);if(b&&b.getClientRects().length)b.click();}}).catch(()=>{});await sleep(300);for(let i=0;i<3;i++){await page.keyboard.press('Escape').catch(()=>{});await sleep(150);}await page.evaluate(()=>{const c=document.querySelector('#panel-close');if(c&&!document.querySelector('#panel').hidden)c.click();});await sleep(300);}
(async()=>{
 const b=await L.launch();const {ctx,page}=await L.open(b,kind);
 try{
 await L.enter(page);
 // skip the tour card if present so it doesn't cover things
 const skip=page.locator('button:visible',{hasText:'跳过路线'});if(await skip.count())await skip.first().click().catch(()=>{});
 await sleep(800);
 const ppl=await people(page);console.log('people',JSON.stringify(ppl));
 const ayao=ppl.find(p=>p.label.includes('阿遥'))||ppl[0];const xiaoman=ppl.find(p=>p.label.includes('小满'))||ppl[1];
 // person card (not yet friends)
 await openKind(page,'person',ayao.id);await sleep(600);await shot(page,'person');
 // greet ayao + xiaoman
 const greet=page.locator('#panel-body [data-social-send]');if(await greet.count()){await greet.first().click();await sleep(1200);}
 await openKind(page,'person',xiaoman.id);const g2=page.locator('#panel-body [data-social-send]');if(await g2.count()){await g2.first().click();await sleep(1000);}
 await openKind(page,'social');await sleep(500);await shot(page,'inbox-pending');
 // wait for acceptance + welcome lines
 await sleep(9000);
 await openKind(page,'social');await sleep(800);await shot(page,'inbox');
 await openKind(page,'friends');await sleep(800);await shot(page,'friends');
 await openKind(page,'person',ayao.id);await sleep(800);await shot(page,'person-friend');
 // chat thread with ayao
 await openKind(page,'chats',ayao.id);await sleep(2000);
 const ta=page.locator('.private-chat textarea');
 if(await ta.count()&&await ta.isEnabled()){await ta.fill('刚刚返场那首我也拍到了！你在哪个位置？');await page.locator('.private-chat .chat-composer button[type=submit]').click();await sleep(1500);}
 await closeEverything(page);await sleep(9000);
 await openKind(page,'chats',ayao.id);await sleep(2500);
 await shot(page,'chat');
 // chat list
 const back=page.locator('.private-chat .chat-back');if(await back.isVisible().catch(()=>false)){await back.click();await sleep(1200);await shot(page,'chat-list');}
 await closeEverything(page);
 // community: room conversation
 await openKind(page,'conversation');await sleep(2000);
 const join=page.locator('.community-panel form[data-group-join]');
 if(await join.count()){await join.locator('input[name=consent]').check();await join.locator('button[type=submit]').click();await sleep(2500);}
 await shot(page,'community');
 // world cup
 const wc=page.locator('.community-panel [data-group-worldcup]');
 if(await wc.count()){await wc.first().click();await sleep(2500);await shot(page,'worldcup');
   // open first cup if list
   const cupBtn=page.locator('.worldcup-panel .entry-list button').first();if(await cupBtn.count()){await cupBtn.click();await sleep(2500);await shot(page,'worldcup-detail');
     const vote=page.locator('.worldcup-panel [data-cup-choice]').first();if(await vote.count()){await vote.click();await sleep(600);const vf=page.locator('.worldcup-panel form[data-cup-vote]');if(await vf.count()){await vf.locator('input[name=consent]').check();await vf.locator('button[type=submit]').click();await sleep(2500);}
       await page.evaluate(()=>document.querySelector('.worldcup-panel .community-scroll')?.scrollTo(0,0));await shot(page,'worldcup-voted');}}
   await page.locator('.worldcup-panel header [data-cup-close]').click().catch(()=>{});await sleep(1200);}
 // games
 const gm=page.locator('.community-panel [data-group-games]');
 if(await gm.count()){await gm.first().click();await sleep(2500);await shot(page,'game-list');
   const gBtn=page.locator('.music-games .entry-list button').first();if(await gBtn.count()){await gBtn.click();await sleep(2500);await shot(page,'game-detail');
     const jf=page.locator('.music-games form[data-game-form="join"]');if(await jf.count()){await jf.locator('input[name=consent]').check();await jf.locator('button').click();await sleep(7000);
       const ch=page.locator('.music-games [data-game-choice]').first();if(await ch.count()){await ch.click();await sleep(800);}
       await shot(page,'game');}}
   await page.locator('.music-games header [data-game="close"]').click().catch(()=>{});await sleep(1200);}
 // topics
 const tp=page.locator('.community-panel [data-group-topics]');
 if(await tp.count()){await tp.first().click();await sleep(2500);await shot(page,'topics');await page.locator('.music-topics header [data-topic="close"]').click().catch(()=>{});await sleep(1200);}
 await closeEverything(page);
 // communities list
 await openKind(page,'communities');await sleep(2000);await shot(page,'communities');await closeEverything(page);
 // corners
 await openKind(page,'corners',ayao.id);await sleep(2500);await shot(page,'corner');
 await closeEverything(page);
 await openKind(page,'personal');await sleep(2500);await shot(page,'personal');
 await closeEverything(page);
 await openKind(page,'wardrobe');await sleep(2000);await shot(page,'wardrobe');
 await closeEverything(page);
 await openKind(page,'identity-backup');await sleep(1200);await shot(page,'identity');await closeEverything(page);
 await openKind(page,'feedback',xiaoman.id);await sleep(1500);await shot(page,'feedback');await closeEverything(page);
 await openKind(page,'my-feedback');await sleep(1500);await shot(page,'my-feedback');await closeEverything(page);
 // host tools: a community of my own, then its 空间与活动 drawer (lower priority screens)
 try{await openKind(page,'communities');await sleep(2000);
   if(!(await page.locator('.music-community .entry-list button').count())){const f=page.locator('.music-community form[data-community-create]');await f.locator('input[name=title]').fill('周五散场以后');await f.locator('input[name=consent]').check();await f.locator('button[type=submit]').click();await sleep(3000);}
   await page.locator('.music-community .entry-list button').first().click();await sleep(3000);await shot(page,'my-community');
   const sb=page.locator('.music-community [data-group-space]');if(await sb.count()){await page.evaluate(()=>{const d=document.querySelector('.conversation-management');if(d)d.open=true;});await sleep(200);await sb.first().click();await sleep(2500);await shot(page,'space');}
   await closeEverything(page);}catch(e){console.error('host tools',e.message);}
 // music map
 const mm=page.locator('#music-map-entry');if(await mm.isVisible().catch(()=>false)){await mm.click();await sleep(3000);await shot(page,'musicmap');await closeEverything(page);}
 }catch(e){console.error('ERR',e.message);await page.screenshot({path:`${OUT}/${prefix}-ERROR-${kind}.png`});}
 await b.close();
})();
