const kind=globalThis.__kind||'phone';
const {page}=await get(kind);
await L.enter(page);
const skip=page.locator('button:visible',{hasText:'跳过路线'});if(await skip.count())await skip.first().click().catch(()=>{});
await sleep(800);
return await people(page);
