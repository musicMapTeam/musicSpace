// positive control for the copy scan: the About sheet holds the single allowed disclosure (演示 / 自动回复) -> ban() must report it
import { launch, Session, PHONE, sleep } from '../rig/rec2.mjs';
import { PAGE_HELPERS } from '../p1lib.mjs';
const b = await launch();
try {
  const s = await Session.open(b, { url: 'http://127.0.0.1:47871/musicSpace/', ...PHONE, cursor: 'touch', name: 'ctl', clockStart: '2026-10-08T22:40:00+08:00' });
  await s.page.waitForFunction(() => window.__SPACE_BOOT__ === 'ready', null, { timeout: 60000 });
  await s.page.evaluate(PAGE_HELPERS);
  await sleep(1500);
  const landing = await s.page.evaluate(() => window.__p1.ban());
  await s.page.click('[data-open=about]'); await sleep(1500);
  const about = await s.page.evaluate(() => window.__p1.ban());
  console.log(JSON.stringify({ landing, about }));
  await s.ctx.close();
} finally { await b.close(); }
