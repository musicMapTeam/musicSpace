// Styling check only: the example cast never joins a creation corner, so the joined corner is mocked with the panel's own markup.
const L=require('./lib.cjs');
const [,,prefix='after',kind='phone']=process.argv;
(async()=>{const b=await L.launch();const {ctx,page}=await L.open(b,kind);
await L.enter(page);
const skip=page.locator('button:visible',{hasText:'跳过路线'});if(await skip.count())await skip.first().click().catch(()=>{});
await page.evaluate(async()=>{
  const {renderAvatarSvg}=await import('/@fs/Users/alakazan/workplace/tme/musicSpace/web/illustrated-avatar/index.js');
  const model=await import('/@fs/Users/alakazan/workplace/tme/musicSpace/web/avatar/model.js');
  const {renderCornerPng}=await import('/corner-png.js');
  const a1=model.DEFAULT_AVATAR,a2=model.applyLookPreset(model.DEFAULT_AVATAR,model.TEMPLATES[2].avatar);
  const p1=await (await fetch('/demo/yao-stage.jpg')).blob(),p2=await (await fetch('/demo/man-crowd.jpg')).blob();
  const u1=URL.createObjectURL(p1),u2=URL.createObjectURL(p2);
  const png=await renderCornerPng({contributions:[{userId:'a',name:'阿遥·示例',note:'这一晚，我在舞台前排。',avatar:a1,photo:{id:1}},{userId:'b',name:'访客5323',note:'返场那首我在台下跟着唱，灯一亮全场都在挥手。',avatar:a2,photo:{id:2}}],revision:3,photos:new Map([['a',p1],['b',p2]])});
  const root=document.createElement('section');root.className='community-panel corner-panel';root.setAttribute('role','dialog');
  const side=(name,note,av,url)=>`<div class="corner-side"><div class="corner-avatar">${renderAvatarSvg(av,{view:'quarter',width:145,height:315})}</div><b>${name}</b><p>${note}</p><img src="${url}" alt=""><figcaption>小人与留言：${name} · 照片同署名</figcaption></div>`;
  root.innerHTML=`<header><span class="eyebrow">TWO SIDES / 两个人的创作角</span><button data-corner-close aria-label="关闭创作角">×</button></header><div class="community-scroll"><h2>一起留张纪念。</h2><p role="status">成品已生成；下载仍需你主动选择。</p><button data-corner-refresh>重新读取</button><figure class="corner-art"><small>MUSIC SPACE / TWO SIDES</small><h3>同一晚，我们的另一面。</h3><div class="corner-pair">${side('阿遥·示例','这一晚，我在舞台前排。',a1,u1)}${side('访客5323','返场那首我在台下跟着唱，灯一亮全场都在挥手。',a2,u2)}</div><figcaption>二维手绘小人 · 双方主动提供的共同草稿</figcaption></figure><p>版本 3 · 你已确认 · 对方已确认</p><p role="status">这一版本已保存到我的创作；对方是否保存，由对方另行选择。</p><form data-corner-export><label><input type="checkbox" name="export" required checked>我选择导出双方确认的署名、小人、留言及所选照片</label><p class="fine">内容编辑、素材变动或关系失效后需重新确认。主动下载的文件无法远程收回。</p><button type="submit">生成共同纪念PNG</button></form><img class="corner-result-preview" src="${URL.createObjectURL(png)}" alt="实际生成的共同纪念PNG"><button data-corner-download>核对权限并下载</button></div>`;
  document.querySelector('.frame').append(root);
});
await page.waitForTimeout(1200);
await page.screenshot({path:`/tmp/space-doodle/shots/social/${prefix}-corner-art-${kind}.png`});
await page.evaluate(()=>document.querySelector('.corner-panel .community-scroll').scrollTo(0,99999));await page.waitForTimeout(300);
await page.screenshot({path:`/tmp/space-doodle/shots/social/${prefix}-corner-art-end-${kind}.png`});
await b.close();})();
