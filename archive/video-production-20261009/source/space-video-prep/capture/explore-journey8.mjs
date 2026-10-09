import { launch, newPage, sleep, BASE, ensureDir } from './lib.mjs';
import { hostCreatesRoom, guestJoins, uploadPhoto, panelInfo } from './flows.mjs';
const browser = await launch();
const A = await newPage(browser);
const B = await newPage(browser);
await hostCreatesRoom(A.page, { name: '阿遥', title: '返场夜', venue: '月台 Livehouse' });
await guestJoins(B.page, new URL(A.page.url()).search, { name: 'Lin' });
await uploadPhoto(A.page, '/tmp/space-video-prep/repo-rc4/web/assets/stage-scene.png', { visibility: 'room' });
await uploadPhoto(B.page, '/tmp/space-video-prep/repo-rc4/web/assets/crowd-scene.png', { visibility: 'room' });
await sleep(1500);
await A.page.getByRole('button', { name: /刷新照片/ }).click(); await sleep(1000);
await A.page.locator('#panel button', { hasText: 'Lin' }).first().click(); await sleep(1200);
await A.page.getByRole('button', { name: /用我的照片，交换这个视角/ }).click(); await sleep(1500);
const info = await A.page.evaluate(() => {
  const chain = el => { const a = []; while (el && el !== document.body) { a.push(el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).join('.') : '')); el = el.parentElement; } return a.join(' < '); };
  return { selects: [...document.querySelectorAll('select')].map(s => ({ chain: chain(s), opts: [...s.options].map(o => o.value + ':' + o.text) })),
    checkboxes: [...document.querySelectorAll('input[type=checkbox]')].map(c => chain(c)),
    buttons: [...document.querySelectorAll('button')].filter(b => b.offsetParent).map(b => (b.innerText || b.getAttribute('aria-label') || '').trim().slice(0, 30) + ' @' + chain(b).split(' < ').slice(0, 3).join('<')) };
});
console.log(JSON.stringify(info, null, 1));
await browser.close();
