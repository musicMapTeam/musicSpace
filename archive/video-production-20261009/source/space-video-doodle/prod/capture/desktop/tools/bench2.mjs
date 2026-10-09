// Are frames between two boils pixel-identical on the landing and in the room?  Saves PNG pairs to ../probe/pairs/
import { launch, DESKTOP4K, killSinks, sleep } from './rig.mjs';
import { openApp, ROOT, enterAsAning, waitForCast, skipTour } from './flow4k.mjs';
import fs from 'node:fs';
import crypto from 'node:crypto';
const D = `${ROOT}/probe/pairs`; fs.mkdirSync(D, { recursive: true });
const md5 = b => crypto.createHash('md5').update(b).digest('hex').slice(0, 10);
const browser = await launch();
let s;
try {
  s = await openApp(browser, DESKTOP4K, { name: 'bench2' });
  await s.park(); await s.freeze();
  const run = async tag => {
    const out = [];
    for (let i = 0; i < 12; i++) { await s.step(1); const a = await s.grab(); const b = await s.grab(); out.push(`${md5(a)}${md5(a) === md5(b) ? '' : '!'}`); if (i < 3) fs.writeFileSync(`${D}/${tag}-${i}.png`, a); }
    console.log(tag, out.join(' '));
  };
  await run('landing');
  await s.unfreeze();
  await enterAsAning(s); await waitForCast(s); await skipTour(s); await s.park(); await sleep(1500);
  await s.freeze();
  await run('room');
} catch (e) { console.error('FAILED', e); killSinks(); }
finally { await s?.ctx.close().catch(() => {}); await browser.close(); }
