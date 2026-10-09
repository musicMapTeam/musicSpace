import { launch, newPage, sleep, BASE } from './lib.mjs';
const browser = await launch();
for (const [w, h] of [[1920, 1080], [1440, 744], [1280, 720]]) {
  const { page } = await newPage(browser, { width: w, height: h, dpr: 1 });
  await page.goto(BASE + '/event-room/', { waitUntil: 'load' }); await sleep(1500);
  await page.getByRole('button', { name: '带上小人，进入现场' }).click(); await sleep(400);
  await page.getByRole('button', { name: /我是主办方/ }).click(); await sleep(400);
  await page.locator('#panel input[name=name]').fill('阿遥'); await page.getByRole('button', { name: '保存昵称，继续' }).click(); await sleep(900);
  await page.screenshot({ path: `/tmp/space-video-prep/stills/radio-${w}x${h}.png` });
  const info = await page.evaluate(() => { const l = [...document.querySelectorAll('#panel label')].map(e => ({ cls: e.className, w: Math.round(e.getBoundingClientRect().width), h: Math.round(e.getBoundingClientRect().height), text: e.innerText.slice(0, 20) })); const p = document.querySelector('#panel').getBoundingClientRect(); return { panelW: Math.round(p.width), labels: l }; });
  console.log(w, h, JSON.stringify(info));
}
await browser.close();
