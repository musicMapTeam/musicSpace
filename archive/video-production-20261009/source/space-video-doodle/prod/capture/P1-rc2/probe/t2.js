await page.click('#join'); await sleep(1500);
await shot('02-entry');
return { panel: await txt('#panel'), btns: await btns(), form: await page.evaluate(() => !!document.querySelector('form[data-form="demo-entry"]')) };
