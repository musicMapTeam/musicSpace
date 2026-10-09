// director smoke test: 6 s clip of the RC4 upload panel with auto-zoom on clicks (compare zoomed/unzoomed legibility)
import { launch, Session, sleep } from './rec.mjs';
import { startServer, hostRoom, PHOTO } from './world.mjs';
const server = await startServer(); const browser = await launch();
try {
  const A = await hostRoom(browser, server.base, { name: '阿遥' });
  const P = A.page; await A.hideCursor(); await A.freeze();
  await A.directorOn({ k: 5, auto: { z: 1.45, hold: 1.0 } });
  A.startRecording('/tmp/space-video-prep/work-v2/test-director.mp4');
  await A.hold(0.4); await A.showCursor();
  await A.click(P.locator('#room-first-photo'), { move: 0.7, post: 0.5 });
  await P.locator('#panel input[type=file]').setInputFiles(PHOTO.stage); await A.hold(0.8);
  await A.focusOn(P.locator('#panel'), { pad: 1.1 }); await A.hold(1.0);
  await A.click(P.getByRole('button', { name: '保存这张照片' }), { move: 0.6, post: 0.4 });
  await A.hold(1.8); A.unfocus(); await A.hold(1.2);
  const r = await A.stopRecording(); console.log(JSON.stringify(r)); await A.close();
} finally { await browser.close(); await server.stop(); }
