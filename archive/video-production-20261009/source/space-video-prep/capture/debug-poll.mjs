import { launch, Session, sleep } from './rec.mjs';
import { startServer, hostRoom, guestRoom, PHONE } from './world.mjs';
const server = await startServer(); const browser = await launch();
const A = await hostRoom(browser, server.base, { session: PHONE });
await A.page.locator('#join').click(); await sleep(1000);
await A.page.locator('#panel-close').click(); await sleep(500);
await A.freeze();
const B = await guestRoom(browser, server.base, A.room, { session: PHONE });   // B joins in real time while A is frozen
const qa = () => A.page.evaluate(() => { const q = window.__SPACE_EVENT_QA__?.(); return q ? { members: q.members.length, poll: q.poll, hidden: document.hidden } : null; });
console.log('after B joined, A frozen:', JSON.stringify(await qa()));
for (let s = 1; s <= 8; s++) { await A.step(60); console.log(`A virtual +${s}s`, JSON.stringify(await qa())); }
await A.page.evaluate(() => window.dispatchEvent(new Event('focus'))); await sleep(500); await A.step(10);
console.log('after focus event', JSON.stringify(await qa()));
await browser.close(); await server.stop(); process.exit(0);
