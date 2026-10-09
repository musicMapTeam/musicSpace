const L=require('./lib.cjs');const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{const browser=await L.launch();try{
 const {page}=await L.open(browser,'narrow');await sleep(1500);await L.enterForce(page);
 const skip=page.locator('button:visible',{hasText:'跳过路线'});if(await skip.count())await skip.first().click().catch(()=>{});await sleep(800);
 for(let i=0;i<3;i++){await page.keyboard.press('Escape').catch(()=>{});await sleep(150);}
 await page.evaluate(()=>{const c=document.querySelector('#panel-close');if(c&&!document.querySelector('#panel').hidden)c.click();});await sleep(300);
 await page.evaluate(()=>{const b=document.createElement('button');b.dataset.open='conversation';b.style.position='fixed';b.style.left='-9999px';document.body.append(b);b.click();b.remove();});await sleep(2500);
 const join=page.locator('.community-panel form[data-group-join]');if(await join.count()){await join.locator('input[name=consent]').check({force:true});await join.locator('button[type=submit]').click();await sleep(2500);}
 for(let i=0;i<20&&!(await page.locator('.community-panel:not([hidden]) [data-group-worldcup]').count());i++){await sleep(1000);if(i===8){await page.evaluate(()=>{const b=document.createElement('button');b.dataset.open='conversation';b.style.position='fixed';b.style.left='-9999px';document.body.append(b);b.click();b.remove();});const j=page.locator('.community-panel form[data-group-join]');if(await j.count()){await j.locator('input[name=consent]').check({force:true});await j.locator('button[type=submit]').click();}}}
 await page.screenshot({path:'/tmp/space-doodle/social-fix/now/oneoff-debug.png'});
 await page.locator('.community-panel:not([hidden]) [data-group-worldcup]').first().click();await sleep(2500);
 const cup=page.locator('.worldcup-panel .entry-list button').first();if(await cup.count()){await cup.click();await sleep(2500);}
 const vote=page.locator('.worldcup-panel [data-cup-choice]').first();if(await vote.count()){await vote.click();await sleep(600);const vf=page.locator('.worldcup-panel form[data-cup-vote]');if(await vf.count()){await vf.locator('input[name=consent]').check({force:true});await vf.locator('button[type=submit]').click();await sleep(2500);}}
 await page.evaluate(()=>{const s=document.querySelector('.worldcup-panel .community-scroll');const m=s.querySelector('.worldcup-match');s.scrollTop=m?m.offsetTop-150:0;document.activeElement?.blur?.();});await sleep(400);
 await page.screenshot({path:'/tmp/space-doodle/shots/social/after-worldcup-voted-narrow.png'});
 console.log(JSON.stringify(await page.evaluate(()=>[...document.querySelectorAll('.worldcup-cover')].map(c=>c.dataset.tint+' '+getComputedStyle(c).backgroundColor))));
 console.log(JSON.stringify(await page.evaluate(()=>[...document.querySelectorAll('.worldcup-mine')].map(n=>n.textContent))));
}finally{await browser.close();}})().catch(e=>{console.error(e.message);process.exit(1);});
