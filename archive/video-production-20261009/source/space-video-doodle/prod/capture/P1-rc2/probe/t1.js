s = await fresh(); page = s.page;
await sleep(2500);
await shot('01-landing');
return { boot: await page.evaluate(() => window.__SPACE_BOOT__), text: await txt('body'), btns: await btns() };
