// Reusable UI flows for the RC4 event room (driven through the real UI; no storage or API shortcuts).
import { sleep, BASE } from './lib.mjs';

export const panelInfo = page => page.evaluate(() => {
  const p = document.querySelector('#panel');
  const vis = p && !p.hidden && getComputedStyle(p).display !== 'none';
  return {
    visible: vis,
    text: (p?.innerText || '').replace(/\n+/g, ' | ').slice(0, 1200),
    inputs: [...document.querySelectorAll('#panel input, #panel select, #panel textarea')].map(e => ({ type: e.type, name: e.name, ph: e.placeholder, val: (e.value || '').slice(0, 30) })),
    buttons: [...document.querySelectorAll('#panel button')].map(b => (b.innerText || b.getAttribute('aria-label') || '').trim().slice(0, 40)),
  };
});

export async function openEventRoom(page, query = '') {
  await page.goto(`${BASE}/event-room/${query}`, { waitUntil: 'load' });
  await page.waitForFunction(() => /已连接/.test(document.querySelector('#render-status')?.innerText || ''), null, { timeout: 20000 });
  await sleep(1200);
}

export async function hostCreatesRoom(page, { name = '阿遥', title = '返场夜', venue = '月台 Livehouse', song = 'late-train', participation = 'open' } = {}) {
  await openEventRoom(page);
  await page.getByRole('button', { name: '带上小人，进入现场' }).click(); await sleep(400);
  await page.getByRole('button', { name: /我是主办方/ }).click(); await sleep(400);
  await page.locator('#panel input[name=name]').fill(name);
  await page.getByRole('button', { name: '保存昵称，继续' }).click(); await sleep(600);
  await page.locator('#panel input[name=title]').fill(title);
  await page.locator('#panel input[name=venue]').fill(venue);
  await page.locator('#panel select[name=songId]').selectOption(song);
  await page.locator(`#panel input[name=participation][value=${participation}]`).check();
  const consent = page.locator('#panel input[name=consent]');
  if (!(await consent.isChecked())) await consent.check();
  await page.getByRole('button', { name: '开房并进入现场' }).click();
  await sleep(1800);
}

export async function guestJoins(page, search, { name = 'Lin', participation = 'open' } = {}) {
  await openEventRoom(page, search);
  await page.getByRole('button', { name: '用默认小人，继续入场' }).click(); await sleep(500);
  await page.locator('#panel input[name=name]').fill(name);
  await page.getByRole('button', { name: '保存昵称，继续' }).click(); await sleep(700);
  await page.locator(`#panel input[name=participation][value=${participation}]`).check();
  const consent = page.locator('#panel input[name=consent]');
  if (!(await consent.isChecked())) await consent.check();
  await page.getByRole('button', { name: '我愿意，进入这一场' }).click();
  await sleep(1800);
}

export async function uploadPhoto(page, file, { visibility = 'room' } = {}) {
  // visibility: 'private' | 'room'
  await page.getByRole('button', { name: /留下第一张照片|留一张|上传|添加照片/ }).first().click(); await sleep(500);
  await page.locator('#panel input[type=file]').setInputFiles(file); await sleep(900);
  const sel = page.locator('#panel select[name=visibility]');
  const opts = await sel.evaluate(s => [...s.options].map(o => o.value + ':' + o.text));
  console.log('visibility options', opts);
  await sel.selectOption(visibility === 'room' ? { index: 1 } : { index: 0 });
  await page.getByRole('button', { name: '保存这张照片' }).click(); await sleep(1500);
}

export const visibleUI = page => page.evaluate(() => {
  const chain = el => { const a = []; while (el && el !== document.body) { a.push(el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (typeof el.className === 'string' && el.className.trim() ? '.' + el.className.trim().split(/\s+/)[0] : '')); el = el.parentElement; } return a.join('<'); };
  const vis = e => { const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none'; };
  const overlays = [...document.querySelectorAll('.frame > section, .frame > aside, .frame > div[role=dialog], .frame > dialog')].filter(vis).map(s => ({ cls: s.className, id: s.id, text: (s.innerText || '').replace(/\n+/g, ' | ').slice(0, 700) }));
  const buttons = [...document.querySelectorAll('button, a[href], select, input:not([type=hidden]), textarea')].filter(vis).map(b => ((b.innerText || b.getAttribute('aria-label') || b.name || b.type || '').trim().slice(0, 28)) + ' @' + chain(b).split('<').slice(0, 3).join('<'));
  return { overlays, buttons };
});
