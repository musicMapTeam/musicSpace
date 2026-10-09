// Real-time walk through the judge route on the Doodle build (phone or desktop), saving a still + a dump of the visible UI at every step.
// usage: node probe-route.mjs phone|desktop
import { launch, Session, PHONE, DESKTOP, sleep } from './rec2.mjs';
const BASE = process.env.SPACE_BASE || 'http://127.0.0.1:47811/musicSpace/';
const mode = process.argv[2] || 'phone'; const V = mode === 'phone' ? PHONE : DESKTOP;
const OUT = `/tmp/space-video-doodle/capture-test/probe/${mode}`;
const browser = await launch();
const s = await Session.open(browser, { url: BASE, ...V, cursor: false, name: mode });
const p = s.page; const t0 = Date.now();
const dump = async label => {
  const info = await p.evaluate(() => {
    const vis = e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== 'hidden'; };
    return {
      status: document.querySelector('#render-status')?.innerText,
      buttons: [...document.querySelectorAll('button')].filter(vis).map(b => (b.innerText || b.getAttribute('aria-label') || '').trim().replace(/\s+/g, ' ')).filter(Boolean).slice(0, 50),
      inputs: [...document.querySelectorAll('input,select,textarea')].filter(vis).map(b => `${b.tagName.toLowerCase()}[${b.type || ''}${b.name ? ' name=' + b.name : ''}]${b.checked ? ' checked' : ''}`).slice(0, 20),
      panel: (document.querySelector('#panel:not([hidden])')?.innerText || '').replace(/\s+/g, ' ').slice(0, 600),
      qa: (() => { try { const q = window.__SPACE_EVENT_QA__(); return { route: q.route, members: q.members.length, photos: q.photos.length, view: q.camera?.view, moving: q.camera?.moving, style: q.camera?.scene?.renderStyle }; } catch (e) { return String(e); } })(),
    };
  });
  console.log(`--- ${label} @${((Date.now() - t0) / 1000).toFixed(1)}s\n${JSON.stringify(info)}`);
  await s.still(`${OUT}/${label}.png`);
};
const btn = re => p.getByRole('button', { name: re }).first();
try {
  await p.waitForFunction(() => window.__SPACE_BOOT__ === 'ready', null, { timeout: 60000 });
  await sleep(2500); await dump('01-landing');
  await btn(/进入示例现场/).click(); await sleep(1200); await dump('02-entry');
  const consent = p.locator('#panel form[data-form=demo-entry] input[name=consent]');
  await consent.check(); await sleep(300);
  await p.locator('#panel form[data-form=demo-entry] button[type=submit]').click();
  await p.waitForFunction(() => /回声现场/.test(document.body.innerText) && document.querySelector('#panel')?.hidden, null, { timeout: 30000 }).catch(e => console.log('WARN room wait', e.message));
  await sleep(2500); await dump('03-room');
  // hotspots
  const hs = await p.evaluate(() => [...document.querySelectorAll('#hotspots .hotspot')].map(h => ({ id: h.dataset.sceneTarget, kind: h.dataset.kind, label: h.innerText.trim(), hidden: h.hidden, box: (r => [r.x, r.y, r.width, r.height].map(Math.round))(h.getBoundingClientRect()) })));
  console.log('hotspots', JSON.stringify(hs));
  const tAI = Date.now();
  await p.locator('.demo-tour [data-tour-action="sample:sample-crowd"]').click();
  await sleep(600); await dump('04-upload-form');
  await p.waitForFunction(() => /AI 判断：|不确定，请选择/.test(document.querySelector('#panel')?.innerText || ''), null, { timeout: 120000 }).catch(() => console.log('WARN no AI verdict'));
  console.log('AI verdict after', ((Date.now() - tAI) / 1000).toFixed(1), 's');
  await sleep(500); await dump('05-ai-chip');
  await btn(/保存这张照片/).click(); await sleep(3000); await dump('06-after-save');
  await p.waitForFunction(() => !!document.querySelector('[data-moment-badge="other-side"]'), null, { timeout: 30000 }).catch(() => console.log('WARN no badge'));
  await sleep(800); await dump('07-wall-badge');
  const offer = p.locator('[data-exchange-offer]').first();
  if (await offer.count()) { await offer.scrollIntoViewIfNeeded(); await sleep(400); await dump('07b-offer-visible'); await offer.click(); await sleep(1500); await dump('08-compose'); }
  const xc = p.locator('[data-x-consent]').first(); if (await xc.count()) { await xc.check().catch(async () => xc.click()); await sleep(400); }
  await dump('09-compose-ticked');
  const send = p.locator('[data-x-send]').first(); if (await send.count()) { await send.click(); await sleep(700); await dump('10-sent'); }
  const tX = Date.now();
  await p.waitForFunction(() => /交换已接受/.test(document.body.innerText), null, { timeout: 60000 }).catch(() => console.log('WARN no accept'));
  console.log('accepted after', ((Date.now() - tX) / 1000).toFixed(1), 's');
  await sleep(1200); await dump('11-accepted');
} catch (e) { console.log('ERROR', e.message); await dump('zz-error').catch(() => {}); }
console.log('errors', JSON.stringify(s.errors), 'console', JSON.stringify(s.console.slice(0, 20)));
await s.close(); await browser.close();
