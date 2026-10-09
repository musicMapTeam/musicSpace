const enter=async page=>{
  if(!(await page.locator('form[data-form="demo-entry"]').count()))await page.locator('#join').click();
  await page.waitForSelector('form[data-form="demo-entry"]',{timeout:20000});
  await page.locator('form[data-form="demo-entry"] input[name=consent]').check({force:true});
  await page.waitForFunction(()=>!document.querySelector('form[data-form="demo-entry"] button[type=submit]')?.disabled,null,{timeout:60000});
  await page.locator('form[data-form="demo-entry"] button[type=submit]').click();
  await page.waitForFunction(()=>!document.querySelector('form[data-form="demo-entry"]'),null,{timeout:60000});
  await sleep(1500);
};
