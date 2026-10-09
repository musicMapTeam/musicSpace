// Avatar stickers (CUT-10) on 0.22.0-rc.2 (cast names without 「·示例」): the cast and the visitor, exported as the product's own SVG
// and rasterised with alpha.
// 1. fresh phone world, visitor 阿宁 in 失真 (rig seed), enter, join the after-show chat room: the three cast SVGs the product
//    draws there (阿遥/小满/北屿, quarter view) are the reference.
// 2. the wardrobe (我的小人): first the visitor's own saved look in 4 views; then each cast member rebuilt from its definition in
//    the build (preset + skin/expression/accessory/pose overrides; the build: 阿遥 = 回声+skin2/smile/none/wave, 小满 = 循迹+skin1/
//    wink/headphones/sing, 北屿 = 断拍+skin3/focused/cap/sway, 林间 = 脉冲+skin0/neutral/none/listen) in 4 views.  The rebuilt
//    quarter views of 阿遥/小满/北屿 are compared with the chat-room references; 林间 (who never posts) is only trusted if all three
//    match exactly.  The wardrobe is cancelled (nothing saved).
// 3. every SVG is rasterised alone on a transparent page at 4x (960x2000) -> avatars/png/*.png, plus a trimmed copy.
import fs from 'node:fs';
import { launch } from '/tmp/space-video-doodle/capture-test/rec2.mjs';
import { chromium } from '/tmp/space-video-prep/tools/node_modules/playwright-core/index.mjs';
import { openApp, lookAndEnter, VIEW, ROOT, CLOCK, BASE, sleep, audit } from './lib.mjs';

const OUT = `${ROOT}/avatars`;
fs.mkdirSync(`${OUT}/svg`, { recursive: true }); fs.mkdirSync(`${OUT}/png`, { recursive: true });
const CAST = [
  { key: 'yao', name: '阿遥', preset: 3, skin: 2, expression: 'smile', accessory: 'none', pose: 'wave' },
  { key: 'man', name: '小满', preset: 2, skin: 1, expression: 'wink', accessory: 'headphones', pose: 'sing' },
  { key: 'bei', name: '北屿', preset: 1, skin: 3, expression: 'focused', accessory: 'cap', pose: 'sway' },
  { key: 'lin', name: '林间', preset: 5, skin: 0, expression: 'neutral', accessory: 'none', pose: 'listen' },
];
const ANGLES = ['front', 'side', 'back', 'quarter'];
const norm = svg => svg.replace(/<title>[^<]*<\/title>/g, '').replace(/ (aria-label|role)="[^"]*"/g, '').replace(/ id="[^"]*"/g, ' id="X"').replace(/url\(#[^)]*\)/g, 'url(#X)').replace(/ xmlns="[^"]*"/g, '').replace(/ (width|height)="[^"]*"/g, '');
const withNs = svg => svg.includes('xmlns=') ? svg : svg.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
const report = { base: BASE, clock: CLOCK, references: {}, rebuilt: {}, validation: {}, files: [], audits: [] };

const browser = await launch();
let s;
try {
  s = await openApp(browser, VIEW.phone, { name: 'phone-avatars', cursor: false });
  const p = s.page;
  await lookAndEnter(s);
  await sleep(2000);
  const skip = p.locator('[data-tour-skip]'); if (await skip.count() && await skip.first().isVisible()) { await skip.first().click(); await sleep(600); }
  await p.locator('#scene-details').click(); await sleep(1200);
  await p.locator('#panel [data-open="conversation"]').first().click();
  await p.waitForSelector('.community-panel form[data-group-join]', { timeout: 20000 }); await sleep(500);
  const join = p.locator('.community-panel form[data-group-join]');
  await join.locator('input[name=consent]').check(); await join.locator('button[type=submit]').click();
  await p.waitForSelector('.community-panel article svg[data-illustrated-avatar]', { timeout: 20000 }); await sleep(1500);
  report.audits.push({ at: 'chat room', ...(await audit(p)) });
  const refs = await p.evaluate(() => [...document.querySelectorAll('.community-panel article')].map(a => { const svg = a.querySelector('svg[data-illustrated-avatar]'); return svg ? { name: (a.innerText || '').split('\n')[0].trim(), svg: svg.outerHTML } : null; }).filter(Boolean));
  for (const r of refs) { const c = CAST.find(c => c.name === r.name); if (c && !report.references[c.key]) { report.references[c.key] = r.svg; fs.writeFileSync(`${OUT}/svg/cast-${c.key}-quarter.chatroom.svg`, withNs(r.svg)); } }
  await p.locator('[data-group="close"]').first().click().catch(() => {}); await sleep(800);
  for (let i = 0; i < 3; i++) { const open = await p.evaluate(() => document.querySelector('#panel') && !document.querySelector('#panel').hidden); if (!open) break; await p.locator('#panel-close').click().catch(() => {}); await sleep(400); }

  // wardrobe
  await p.locator('#my-look').click();
  await p.waitForSelector('.wardrobe .wardrobe-figure svg', { timeout: 20000 }); await sleep(1200);
  const figure = () => p.evaluate(() => document.querySelector('.wardrobe .wardrobe-figure svg').outerHTML);
  const angle = async a => { await p.locator(`.wardrobe [data-angle="${a}"]`).click(); await sleep(350); };
  const pick = async (cat, part, value) => {
    await p.locator(`.wardrobe [data-category="${cat}"]`).click(); await sleep(250);
    const b = p.locator(`.wardrobe [data-part="${part}"][data-value="${value}"]`).first();
    await b.scrollIntoViewIfNeeded(); await b.click(); await sleep(300);
  };
  // the visitor's own saved look first (exactly what the clips show)
  report.visitorLayers = await p.evaluate(() => [...document.querySelectorAll('.wardrobe [data-layer]')].map(e => e.dataset.layer + ':' + e.dataset.part).join(' '));
  for (const a of ANGLES) { await angle(a); const svg = await figure(); fs.writeFileSync(`${OUT}/svg/visitor-aning-shizhen-${a}.svg`, withNs(svg)); report.files.push(`svg/visitor-aning-shizhen-${a}.svg`); }
  report.audits.push({ at: 'wardrobe', ...(await audit(p)) });
  const sum = p.locator('.wardrobe summary', { hasText: '试试现成搭配' }).first();
  for (const c of CAST) {
    await sum.scrollIntoViewIfNeeded();
    if (!(await p.evaluate(() => [...document.querySelectorAll('.wardrobe details')].find(d => /试试现成搭配/.test(d.querySelector('summary')?.textContent || ''))?.open))) { await sum.click(); await sleep(300); }
    const pre = p.locator(`.wardrobe [data-preset="${c.preset}"]`); await pre.scrollIntoViewIfNeeded(); await pre.click(); await sleep(400);
    await pick('palette', 'skin', String(c.skin));
    await pick('expression', 'expression', c.expression);
    await pick('accessory', 'accessory', c.accessory);
    await pick('pose', 'pose', c.pose);
    report.rebuilt[c.key] = { layers: await p.evaluate(() => [...document.querySelectorAll('.wardrobe [data-layer]')].map(e => e.dataset.layer + ':' + e.dataset.part).join(' ')) };
    for (const a of ANGLES) {
      await angle(a); const svg = await figure();
      fs.writeFileSync(`${OUT}/svg/cast-${c.key}-${a}.svg`, withNs(svg)); report.files.push(`svg/cast-${c.key}-${a}.svg`);
      if (a === 'quarter' && report.references[c.key]) report.validation[c.key] = norm(svg) === norm(report.references[c.key]) ? 'identical to the chat-room drawing' : 'DIFFERENT';
    }
  }
  await p.locator('[data-wardrobe-close]').first().click().catch(() => {}); await sleep(600);   // cancel: nothing saved
  report.errors = s.errors;
} catch (e) { console.error('FAILED', e); report.failed = String(e.stack || e); process.exitCode = 1; }
finally { await s?.ctx.close().catch(() => {}); await browser.close(); }

// rasterise each SVG alone (no page CSS involved: the SVGs are self-contained)
const b2 = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: ['--force-color-profile=srgb', '--hide-scrollbars'] });
const pg = await b2.newPage({ viewport: { width: 960, height: 2000 }, deviceScaleFactor: 1 });
for (const f of fs.readdirSync(`${OUT}/svg`).filter(f => f.endsWith('.svg'))) {
  const svg = fs.readFileSync(`${OUT}/svg/${f}`, 'utf8').replace(/ width="[^"]*"/, ' width="960"').replace(/ height="[^"]*"/, ' height="2000"');
  await pg.setContent(`<!doctype html><html><body style="margin:0;background:transparent">${svg}</body></html>`);
  await pg.waitForTimeout(50);
  const png = `${OUT}/png/${f.replace(/\.svg$/, '')}.png`;
  await pg.screenshot({ path: png, omitBackground: true, clip: { x: 0, y: 0, width: 960, height: 2000 } });
}
await b2.close();
fs.writeFileSync(`${ROOT}/logs/avatars.json`, JSON.stringify({ ...report, references: Object.keys(report.references) }, null, 1));
console.log(JSON.stringify({ validation: report.validation, rebuilt: report.rebuilt, visitorLayers: report.visitorLayers, failed: report.failed }, null, 1));
