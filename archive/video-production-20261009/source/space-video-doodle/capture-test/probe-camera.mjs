// Real-time probe of the room's camera moves on a phone (person close-up, photo wall, overview) + model warm-up path.
import { launch, Session, PHONE, DESKTOP, sleep } from './rec2.mjs';
const BASE = process.env.SPACE_BASE || 'http://127.0.0.1:47811/musicSpace/';
const mode = process.argv[2] || 'phone'; const V = mode === 'phone' ? PHONE : DESKTOP;
const OUT = `/tmp/space-video-doodle/capture-test/probe/cam-${mode}`;
const browser = await launch();
const s = await Session.open(browser, { url: BASE, ...V, cursor: false, name: mode });
const p = s.page; const t0 = Date.now();
const reqs = []; p.on('requestfinished', r => { if (/\.onnx|\.wasm/.test(r.url())) reqs.push(`${((Date.now() - t0) / 1000).toFixed(1)}s ${r.url().split('/').pop()}`); });
const qa = () => p.evaluate(() => { const q = window.__SPACE_EVENT_QA__(); return { view: q.camera?.view, moving: q.camera?.moving, cam: q.camera?.camera?.position?.map(v => +v.toFixed(2)), canvas: [...document.querySelectorAll('#world canvas')].map(c => `${c.width}x${c.height} css ${c.clientWidth}x${c.clientHeight} @${Math.round(c.getBoundingClientRect().top)}`), ctx: document.querySelector('#context-actions:not([hidden])')?.innerText?.replace(/\s+/g, ' '), panel: document.querySelector('#panel:not([hidden])') ? 'open' : 'closed' }; });
const shot = async label => { console.log(label, ((Date.now() - t0) / 1000).toFixed(1) + 's', JSON.stringify(await qa())); await s.still(`${OUT}/${label}.png`); };
await p.waitForFunction(() => window.__SPACE_BOOT__ === 'ready', null, { timeout: 60000 }); await sleep(2000);
await shot('00-landing');
await p.getByRole('button', { name: /进入示例现场/ }).first().click(); await sleep(900);
await p.locator('#panel form[data-form=demo-entry] input[name=consent]').check();
await p.locator('#panel form[data-form=demo-entry] button[type=submit]').click();
await p.waitForFunction(() => /回声现场/.test(document.body.innerText) && document.querySelector('#panel')?.hidden, null, { timeout: 30000 });
await sleep(2000); await shot('01-room');
console.log('model requests so far', JSON.stringify(reqs));
const toggle = p.locator('[data-tour-toggle]'); if (await toggle.count()) { await toggle.click(); await sleep(800); await shot('02-tour-collapsed'); }
const person = p.locator('#hotspots .hotspot[data-kind=person]').nth(1); console.log('person', await person.innerText());
await person.click(); await sleep(250); await shot('03-person-moving'); await sleep(1500); await shot('04-person');
await p.locator('nav.camera-nav button[data-view=photos]').click(); await sleep(300); await shot('05-photos-moving'); await sleep(1500); await shot('06-photos');
await p.locator('nav.camera-nav button[data-view=overview]').click(); await sleep(1800); await shot('07-overview');
if (await toggle.count()) { await p.locator('[data-tour-toggle]').click(); await sleep(600); }
// warm-up path: open the upload sheet with 「用我自己的照片」 and see whether the model loads by itself
await p.locator('.demo-tour [data-tour-action="open:upload"]').click().catch(e => console.log('no open:upload', e.message)); await sleep(4000);
console.log('model requests after opening upload sheet', JSON.stringify(reqs));
const ai = await p.evaluate(() => document.querySelector('#panel')?.innerText.match(/AI[^\n]{0,40}/g));
console.log('AI lines in panel', JSON.stringify(ai)); await shot('08-upload-own');
await p.locator('#panel-close').click(); await sleep(800); await shot('09-closed');
console.log('errors', JSON.stringify(s.errors));
await s.close(); await browser.close();
