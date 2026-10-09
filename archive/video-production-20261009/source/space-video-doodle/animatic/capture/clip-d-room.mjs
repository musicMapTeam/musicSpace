// Clip D (desktop 2880x1620 = 1440x810 CSS @2): the doodle 3D room overview with all five present (阿遥/小满/北屿/林间 + 阿宁·我),
// route card skipped, 3.6 s held so the product's own 7 Hz line boil is captured.  Uses the capture-test rig (read-only import).
// Setup is real time (not recorded); recording is frame-stepped on the fake clock.  Needs SPACE_BASE (dist-pages served under /musicSpace/).
import { launch, killSinks } from '/tmp/space-video-doodle/capture-test/rec2.mjs';
import { openApp, SEL, sleep } from '/tmp/space-video-doodle/capture-test/flow.mjs';
const OUT = '/tmp/space-video-doodle/animatic/capture/D-desktop-room-2880.mp4';
const browser = await launch();
let s;
try {
  s = await openApp(browser, { width: 1440, height: 810, dpr: 2, mobile: false }, { cursor: 'touch', name: 'desktop' });
  const p = s.page;
  // visitor look = preset 失真 (data-preset=4): the cast wears the other presets and a new visitor's default look is random
  await p.locator('#join').click();
  await p.waitForSelector('form[data-form="demo-entry"] button.primary:not([disabled])', { timeout: 60000 });
  await p.locator('form[data-form="demo-entry"] button', { hasText: '现在换个造型' }).first().click();
  await sleep(1500);
  const sum = p.locator('.wardrobe summary', { hasText: '试试组合示例' }).first();
  await sum.scrollIntoViewIfNeeded(); await sum.click(); await sleep(400);
  const pre = p.locator('[data-preset="4"]'); await pre.scrollIntoViewIfNeeded(); await pre.click(); await sleep(600);
  const nick = p.locator('.wardrobe input[aria-label="昵称"]'); if (await nick.count()) await nick.fill('阿宁');
  await p.locator('[data-wardrobe-save]').first().click(); await sleep(1500);
  await p.locator('#join').click();
  await p.waitForSelector('form[data-form="demo-entry"] button.primary:not([disabled])', { timeout: 60000 });
  const nameField = p.locator('form[data-form="demo-entry"] input[name=name]');
  if (await nameField.isEditable()) await nameField.fill('阿宁');   // after a wardrobe save the nickname is already set (read-only)
  await p.locator(SEL.consent).check();
  await p.locator('form[data-form="demo-entry"] button.primary').click();
  await p.waitForFunction(() => !document.querySelector('form[data-form="demo-entry"]'), null, { timeout: 60000 });
  await sleep(9500);                                     // 林间·示例 arrives ~8 s after the visitor
  const skip = p.locator('button:visible', { hasText: '跳过路线' });
  if (await skip.count()) await skip.first().click();
  await p.mouse.move(-50, -50);
  await sleep(1800);
  const names = await p.evaluate(() => [...document.querySelectorAll('#hotspots .hotspot[data-kind=person]')].map(e => e.innerText.replace(/\s+/g, ' ').trim()));
  console.log('people:', JSON.stringify(names));
  await s.freeze();
  s.startRecording(OUT);
  await s.hold(3.6);
  const r = await s.stopRecording();
  console.log(JSON.stringify({ ...r, events: undefined, marks: undefined }));
  console.log('errors', JSON.stringify(s.errors));
} catch (e) { console.error('FAILED', e); killSinks(); }
finally { await s?.ctx.close().catch(() => {}); await browser.close(); }
