// Bench: 4K PNG grab speed on the landing (3D boil running) and the dual-output sink, 90 frames.
import { launch, DESKTOP4K, killSinks } from './rig.mjs';
import { openApp, ROOT, CAM_PROBE } from './flow4k.mjs';
const browser = await launch();
let s;
try {
  s = await openApp(browser, DESKTOP4K, { name: 'bench' });
  const gl = await s.page.evaluate(() => { const c = document.querySelector('canvas'); return c ? `${c.width}x${c.height} css ${c.clientWidth}x${c.clientHeight}` : null; });
  console.log('canvas', gl);
  await s.park(); await s.freeze();
  s.startRecording(`${ROOT}/probe/bench-4k.mp4`, `${ROOT}/probe/bench-1080.mp4`);
  await s.hold(1.5);
  const r = await s.stopRecording();
  console.log(JSON.stringify({ ...r, marks: undefined, events: undefined }, null, 1));
} catch (e) { console.error('FAILED', e); killSinks(); }
finally { await s?.ctx.close().catch(() => {}); await browser.close(); }
