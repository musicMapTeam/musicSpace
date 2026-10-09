// Are two takes pixel-identical?  Two fresh sessions -> landing -> entry sheet (covers the 3D scene, so no boil) -> freeze -> step 90 frames
// -> grab PNGs (two grabs in a row within a session, plus one per session) and save them for comparison.
import { launch, Session, PHONE, sleep } from './rec2.mjs';
import { openApp, SEL } from './flow.mjs';
import fs from 'node:fs';
import crypto from 'node:crypto';
const OUTD = '/tmp/space-video-doodle/capture-test/determinism'; fs.mkdirSync(OUTD, { recursive: true });
const md5 = b => crypto.createHash('md5').update(b).digest('hex').slice(0, 12);
const browser = await launch();
const res = [];
for (const take of [1, 2]) {
  const s = await openApp(browser, PHONE, { cursor: false });
  await SEL.landingEnter(s.page).click(); await sleep(1500);
  await s.freeze();
  await s.step(90);
  const a = await s.grab('png'); await sleep(300); const b = await s.grab('png');
  await s.step(1); const c = await s.grab('png');
  fs.writeFileSync(`${OUTD}/take${take}-a.png`, a); fs.writeFileSync(`${OUTD}/take${take}-c.png`, c);
  res.push({ take, a: md5(a), b: md5(b), c: md5(c) });
  await s.ctx.close();
}
console.log(JSON.stringify(res));
await browser.close();
