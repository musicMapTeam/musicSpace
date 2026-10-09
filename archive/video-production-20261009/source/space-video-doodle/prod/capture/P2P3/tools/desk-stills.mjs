// CUT-01 / CUT-03 (3840x2160 = CSS 1440x810 @ 8/3) from my own fresh desktop world, so the cut-out set is self-contained:
//   CUT-01  room overview, all five present (林间·示例 arrives ~8 s after the visitor), route card skipped, no pointer
//   CUT-03a the 3D photo wall (photos view) with the cast's 4 photos
//   CUT-03  the same view after 「放一张」 -> 人海 · 示例照片 -> 保存这张照片: 5 photos
// (The desktop capture pass has equivalent stills from its D-02/D-03 takes: prod/capture/desktop/stills/.)
import fs from 'node:fs';
import { launch } from '/tmp/space-video-doodle/capture-test/rec2.mjs';
import { openApp, lookAndEnter, VIEW, ROOT, CLOCK, sleep } from './lib.mjs';
import { StillKit } from './stillkit.mjs';

const browser = await launch();
let s;
const out = { clock: CLOCK };
const settle = async () => { await sleep(250); await s.page.waitForFunction(() => !window.__SPACE_EVENT_QA__().camera.moving, null, { timeout: 15000 }); await sleep(900); };
const people = () => s.page.evaluate(() => [...document.querySelectorAll('#hotspots .hotspot[data-kind=person]')].filter(e => e.getClientRects().length).map(e => e.innerText.replace(/\s+/g, ' ').trim()));
try {
  s = await openApp(browser, VIEW.desk4k, { name: 'desk-stills', cursor: false });
  const p = s.page;
  const K = new StillKit(s, ROOT);
  await p.evaluate(() => Promise.all([...document.fonts].map(f => f.load().catch(() => null))));
  await lookAndEnter(s);
  await sleep(10000);
  const skip = p.locator('[data-tour-skip]'); if (await skip.count() && await skip.first().isVisible()) { await skip.first().click(); }
  await p.mouse.move(-50, -50);
  await sleep(2000);
  out.overviewPeople = await people();
  out.qa1 = await p.evaluate(() => { const q = window.__SPACE_EVENT_QA__(); return { view: q.camera?.view, members: q.members.map(m => m.name), photos: q.photos.length }; });
  await K.full('CUT-01', 'stills/CUT-01_room-overview-4k', { storyboard: 'H1 (polaroid), E4/W5 reference', note: 'desktop 3D room overview, five present with labels (林间·示例 · 安静 included), 阿宁 · 我; no pointer' });
  await K.thaw();
  await p.locator('nav.camera-nav button[data-view=photos]').click(); await settle();
  await p.mouse.move(-50, -50); await sleep(600);
  out.qa2 = await p.evaluate(() => { const q = window.__SPACE_EVENT_QA__(); return { view: q.camera?.view, photos: q.photos.length }; });
  await K.full('CUT-03a', 'stills/CUT-03a_3d-wall-4-photos-4k', { storyboard: 'A4 36:1 reference', note: '3D photo wall (sign 同一晚，另一面。) with the four example photos' });
  await K.thaw();
  await p.locator('#context-actions [data-open="upload"]').first().click();
  await p.waitForSelector('#panel:not([hidden]) [data-sample-photo="sample-crowd"]', { timeout: 20000 }); await sleep(500);
  await p.locator('[data-sample-photo="sample-crowd"]').first().click();
  await p.waitForFunction(() => /AI 判断：/.test(document.querySelector('.moment-ai-tag')?.textContent || ''), null, { timeout: 60000 });
  out.ai = await p.evaluate(() => document.querySelector('.moment-ai-tag')?.textContent.trim());
  await sleep(600);
  await p.locator('#panel form[data-form="upload"] button[type=submit]').click();
  await p.waitForSelector('[data-moment-badge="other-side"]', { timeout: 30000 }); await sleep(1500);
  await p.locator('#panel-close').click(); await sleep(800);
  if (!(await p.evaluate(() => window.__SPACE_EVENT_QA__().camera.view === 'photos'))) await p.locator('nav.camera-nav button[data-view=photos]').click();
  await settle(); await sleep(2600);                                   // the toast 已分享给本场成员 goes away
  await p.mouse.move(-50, -50); await sleep(300);
  out.qa3 = await p.evaluate(() => { const q = window.__SPACE_EVENT_QA__(); return { view: q.camera?.view, photos: q.photos.length }; });
  await K.full('CUT-03', 'stills/CUT-03_3d-wall-5-photos-4k', { storyboard: 'H1 (polaroid), A4 36:3 reference', note: 'the same photos view after saving the 人海 sample: five photos (yours included)' });
  await K.thaw();
  fs.writeFileSync(`${ROOT}/logs/desk-stills.json`, JSON.stringify({ items: K.items, out, errors: s.errors }, null, 1));
  console.log(JSON.stringify(out, null, 1));
} catch (e) { console.error('FAILED', e); try { await s?.page.screenshot({ path: `${ROOT}/review/desk-stills-FAIL.png` }); } catch {} process.exitCode = 1; }
finally { await s?.ctx.close().catch(() => {}); await browser.close(); }
