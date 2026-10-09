// More Node-only screens: identity backup panel, guest preview via invite on phone, join by typed code, create-form validation.
const { launch, open, sleep, OUT, save } = require('./lib.cjs');
const port = process.argv[2] || '8890'; const label = process.argv[3] || 'nm';
const base = `http://127.0.0.1:${port}`;
const connected = p => p.waitForFunction(() => /已连接/.test(document.querySelector('#render-status')?.innerText || ''), null, { timeout: 30000 });
(async () => {
  const browser = await launch(); const out = {};
  // A hosts on desktop
  const A = await open(browser, 'desktop');
  await A.page.goto(`${base}/event-room/`, { waitUntil: 'load' }); await connected(A.page); await sleep(1500);
  await A.page.getByRole('button', { name: '带上小人，进入现场' }).click(); await sleep(800);
  // identity backup from the entry choice (before profile)
  await A.page.getByRole('button', { name: '备份或恢复我的小人身份' }).click(); await sleep(1500);
  await A.page.screenshot({ path: `${OUT}/${label}-desktop-identity-backup-entry.png` });
  out.identityEntry = (await A.page.evaluate(() => (document.querySelector('#panel:not([hidden]), [role=dialog]:not([hidden])')?.innerText || '').replace(/\n+/g, ' | ').slice(0, 300)));
  await A.page.keyboard.press('Escape'); await sleep(500);
  await A.page.getByRole('button', { name: '带上小人，进入现场' }).click().catch(() => {}); await sleep(800);
  // create form validation: submit empty
  await A.page.getByRole('button', { name: /我是主办方/ }).click(); await sleep(700);
  await A.page.locator('#panel input[name=name]').fill('阿遥'); await A.page.getByRole('button', { name: '保存昵称，继续' }).click(); await sleep(900);
  await A.page.getByRole('button', { name: '开房并进入现场' }).click(); await sleep(1200);
  await A.page.screenshot({ path: `${OUT}/${label}-desktop-create-invalid.png` });
  out.createInvalid = await A.page.evaluate(() => ({ invalid: [...document.querySelectorAll('#panel :invalid')].map(e => e.name), problem: (document.querySelector('#panel .problem, #panel [role=alert], #toast')?.innerText || '').slice(0, 200) }));
  await A.page.locator('#panel input[name=title]').fill('返场夜'); await A.page.locator('#panel input[name=venue]').fill('月台 Livehouse');
  await A.page.locator('#panel input[name=participation][value=open]').check(); const c = A.page.locator('#panel input[name=consent]'); if (!(await c.isChecked())) await c.check();
  await A.page.getByRole('button', { name: '开房并进入现场' }).click(); await sleep(3000);
  const code = new URL(A.page.url()).searchParams.get('room'); out.code = code;
  // B joins by typing the code on phone
  const B = await open(browser, 'phone');
  await B.page.goto(`${base}/event-room/`, { waitUntil: 'load' }); await connected(B.page); await sleep(1500);
  await B.page.getByRole('button', { name: '带上小人，进入现场' }).click(); await sleep(800);
  const codeInput = B.page.locator('#panel input').first(); await codeInput.fill(code); await sleep(300);
  await B.page.screenshot({ path: `${OUT}/${label}-phone-join-code-typed.png` });
  await B.page.getByRole('button', { name: '看看这一场' }).click(); await sleep(2500);
  await B.page.screenshot({ path: `${OUT}/${label}-phone-guest-preview.png` });
  out.preview = (await B.page.evaluate(() => (document.querySelector('#panel:not([hidden])')?.innerText || '').replace(/\n+/g, ' | ').slice(0, 300)));
  out.console = { A: A.log.console, B: B.log.console, Aerr: A.log.pageerror, Berr: B.log.pageerror };
  save(`${label}-more.json`, out); console.log(JSON.stringify(out, null, 1));
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
