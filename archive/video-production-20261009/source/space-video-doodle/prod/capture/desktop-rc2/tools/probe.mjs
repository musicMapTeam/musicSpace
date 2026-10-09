// Real-time probe of every desktop take on the rc2 build (/tmp/space-final/dist-pages, 0.22.0-rc.2), CSS 1440x810 @1, no recording.
// Verifies selectors, states, waits and the visible copy (textAudit) before the frame-stepped takes.  Stills -> ../probe/
import { launch, DESKTOP1X } from './rig.mjs';
import { openApp, enterAsAning, waitForCast, skipTour, viewNow, scrollNow, SEL, qa, sleep, ROOT, textAudit } from './flow4k.mjs';
const OUTD = `${ROOT}/probe`;
const browser = await launch();
let s;
const T0 = Date.now(); const ts = () => ((Date.now() - T0) / 1000).toFixed(1) + 's';
const audits = {};
const shot = async (label) => { await s.still(`${OUTD}/${label}.png`); const a = await textAudit(s); audits[label] = a.hits; console.log(ts(), 'shot', label, JSON.stringify(await qa(s)), 'AUDIT', a.hits.length ? JSON.stringify(a.hits) : 'clean'); };
const vis = (sel) => s.page.evaluate(sel => { const e = document.querySelector(sel); return e && e.getClientRects().length ? e.innerText.replace(/\s+/g, ' ').trim().slice(0, 600) : null; }, sel);
try {
  s = await openApp(browser, DESKTOP1X, { cursor: false, name: 'probe' });
  const p = s.page;
  await shot('d01-landing');
  const land = await p.evaluate(() => {
    const out = {};
    const find = t => { const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); let n; while ((n = w.nextNode())) { if (n.textContent.includes(t) && n.parentElement.getClientRects().length) { const b = n.parentElement.getBoundingClientRect(); if (b.width) return { tag: n.parentElement.tagName, cls: String(n.parentElement.className).slice(0, 60), box: [b.left, b.top, b.width, b.height].map(Math.round) }; } } return null; };
    for (const t of ['同一刻', '另一面', '就是这一刻', '另一个视角', '进到同一个现场', '进入现场', '关于 Music Space', '音乐探索', '现场进行中']) out[t] = find(t);
    out.header = document.querySelector('header')?.innerText.replace(/\s+/g, ' ');
    out.footer = document.querySelector('footer')?.innerText.replace(/\s+/g, ' ');
    out.presenceTitle = document.querySelector('#presence-title')?.innerText;
    out.welcome = !!document.querySelector('section.presence.welcome');
    out.captionNote = document.querySelector('.caption-note')?.innerText;
    out.canvas = [...document.querySelectorAll('canvas')].map(c => `${c.width}x${c.height} css ${c.clientWidth}x${c.clientHeight}`);
    return out;
  });
  console.log('landing', JSON.stringify(land));
  console.log('landing text:', (await p.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ').slice(0, 1500));
  await p.locator(SEL.join).click();
  await p.waitForSelector(`${SEL.entryForm} button.primary:not([disabled])`, { timeout: 60000 }); await sleep(800);
  await shot('d00-entry-sheet');
  console.log('entry text:', await vis('#panel'));
  await p.keyboard.press('Escape').catch(() => {}); await sleep(600);
  await p.locator('#panel-close:visible').click().catch(() => {}); await sleep(600);
  await enterAsAning(s);
  await shot('d02-room-entered');
  const wait = await waitForCast(s); console.log('cast wait ms', wait);
  await shot('d02-room-cast');
  console.log('tour', await vis('.demo-tour:not([hidden])'));
  console.log('skip', await skipTour(s));
  await sleep(800);
  await shot('d02-room-skipped');
  const room = await p.evaluate(() => ({ hotspots: [...document.querySelectorAll('#hotspots .hotspot')].map(e => `${e.dataset.kind}:${e.getAttribute('title')}|${e.innerText.replace(/\s+/g, ' ').trim()}`), canvas: [...document.querySelectorAll('#world canvas, canvas')].map(c => `${c.width}x${c.height} css ${c.clientWidth}x${c.clientHeight}`), header: document.querySelector('header')?.innerText.replace(/\s+/g, ' '), footer: document.querySelector('footer')?.innerText.replace(/\s+/g, ' '), nav: document.querySelector('nav.camera-nav')?.innerText.replace(/\s+/g, ' ') }));
  console.log('room', JSON.stringify(room));
  console.log('room text:', (await p.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ').slice(0, 2000));
  for (const v of ['photos', 'person', 'overview']) {
    const t = Date.now(); await p.locator(SEL.nav(v)).click(); await sleep(60);
    let moving = true; while (moving && Date.now() - t < 8000) { moving = (await qa(s)).moving; await sleep(30); }
    console.log('view', v, 'move ms', Date.now() - t); await sleep(500); await shot(`d02-view-${v}`);
    console.log('  context', await vis('#context-actions'));
    if (v === 'person') console.log('  person panel', await vis('#panel:not([hidden])'));
  }
  if (await p.locator('#panel:not([hidden]) #panel-close').count()) { await p.locator('#panel-close').click(); await sleep(600); }
  await viewNow(s, 'photos'); await shot('d03a-photos-before');
  console.log('context actions', await vis('#context-actions'));
  await p.locator('[data-open="upload"]:visible').first().click(); await sleep(900);
  await shot('d03-upload-open');
  console.log('upload panel', await vis('#panel'));
  const samples = await p.evaluate(() => [...document.querySelectorAll('[data-sample-photo]')].map(e => `${e.dataset.samplePhoto}:${e.innerText.replace(/\s+/g, ' ').trim()}:${e.getClientRects().length}`));
  console.log('samples', JSON.stringify(samples));
  const t1 = Date.now();
  await p.locator('[data-sample-photo="sample-crowd"]').first().click();
  await p.waitForFunction(() => /AI 判断：|不确定，请选择/.test(document.querySelector('#panel')?.innerText || ''), null, { timeout: 90000 });
  console.log('AI verdict after ms', Date.now() - t1, await p.evaluate(() => document.querySelector('.moment-ai-tag')?.innerText));
  await scrollNow(s, SEL.aiTag); await sleep(300); await shot('d03-upload-ai');
  console.log('upload panel (AI)', await vis('#panel'));
  await p.locator(SEL.save).click();
  await p.waitForFunction(sel => !!document.querySelector(sel), SEL.badge, { timeout: 30000 }); await sleep(1200);
  await shot('d03-after-save-wall');
  console.log('toast', await vis('#toast'));
  console.log('wall panel', await vis('#panel'));
  await scrollNow(s, SEL.badge); await sleep(300); await shot('d05-wall-badge');
  await p.locator(SEL.offer).click(); await sleep(900); await shot('d05-compose');
  console.log('compose', await vis('#panel'));
  const sel = await p.evaluate(() => [...(document.querySelector('select[data-x-choice]')?.options || [])].map(o => (o.selected ? '*' : '') + o.textContent));
  console.log('choice', JSON.stringify(sel));
  await scrollNow(s, SEL.xSend, { block: 'end' }); await sleep(300); await p.locator(SEL.xConsent).check(); await sleep(300); await shot('d05-consent');
  const t2 = Date.now(); await p.locator(SEL.xSend).click();
  await p.waitForFunction(() => !!document.querySelector('.exchange-status'), null, { timeout: 20000 }); await sleep(300);
  await scrollNow(s, '.exchange-status', { block: 'start', offset: -24 }); await shot('d05-pending');
  console.log('pending', await vis('#panel'));
  await p.waitForFunction(() => /交换已接受/.test(document.querySelector('.exchange-status')?.innerText || ''), null, { timeout: 30000 });
  console.log('send -> accepted ms', Date.now() - t2);
  await sleep(600); await scrollNow(s, '.exchange-status', { block: 'start', offset: -24 }); await shot('d05-accepted');
  console.log('accepted', await vis('#panel'));
  await p.evaluate(() => { const pn = document.querySelector('#panel'); pn.scrollTo({ top: pn.scrollHeight, behavior: 'instant' }); }); await sleep(300); await shot('d05-accepted-bottom');
  console.log('revoke btn', await vis('[data-x-action="revoke"]'), 'fine', await vis('.exchange-fine'));
  await p.locator(SEL.xClose).first().click().catch(e => console.log('xclose', e.message)); await sleep(800);
  if (await p.locator('#panel:not([hidden]) #panel-close').count()) { await p.locator('#panel-close').click(); await sleep(600); }
  await shot('d03b-after-exchange-closed');
  await viewNow(s, 'photos'); await shot('d03b-photos-after');
  await viewNow(s, 'overview'); await shot('d04-overview');
  const t3 = Date.now(); await p.locator(SEL.person('林间')).first().click(); await sleep(60);
  let mv = true; while (mv && Date.now() - t3 < 8000) { mv = (await qa(s)).moving; await sleep(30); } console.log('person 林间 move ms', Date.now() - t3);
  await sleep(400); await shot('d04-linjian-close');
  console.log('context actions', await vis('#context-actions'));
  await p.getByRole('button', { name: '认识一下' }).first().click(); await sleep(900); await shot('d04-linjian-card');
  console.log('linjian card', await vis('#panel'));
  if (await p.locator('#panel:not([hidden]) #panel-close').count()) { await p.locator('#panel-close').click(); await sleep(600); }
  await viewNow(s, 'overview');
  await p.locator(SEL.person('小满')).first().click(); await sleep(1500); await shot('d06-xiaoman-close');
  console.log('context actions 小满', await vis('#context-actions'));
  await p.getByRole('button', { name: '认识一下' }).first().click(); await sleep(900); await shot('d06-xiaoman-card');
  console.log('xiaoman card', await vis('#panel'));
  const t4 = Date.now(); await p.locator('[data-social-send]').first().click(); await sleep(400); await shot('d06-greet-sent');
  console.log('toast', await vis('#toast'), 'panel', await vis('#panel'));
  await p.waitForFunction(() => /你们已经认识了/.test(document.querySelector('#panel')?.innerText || ''), null, { timeout: 30000 });
  console.log('greet -> accepted ms', Date.now() - t4); await sleep(500); await shot('d06-greet-accepted');
  console.log('friends panel', await vis('#panel'));
  const btns = await p.evaluate(() => [...document.querySelectorAll('#panel button, #panel a')].map(b => `${b.getAttribute('data-open') || ''}|${b.innerText.replace(/\s+/g, ' ').trim()}`).filter(x => x.length > 1).slice(0, 30));
  console.log('panel buttons', JSON.stringify(btns));
  await p.locator('#panel [data-open="chats"]').first().click(); await sleep(1200); await shot('d06-chat-open');
  const chat = await p.evaluate(() => { const c = document.querySelector('.private-chat'); if (!c) return null; const b = c.getBoundingClientRect(); return { box: [b.left, b.top, b.width, b.height].map(Math.round), text: c.innerText.slice(0, 600).replace(/\s+/g, ' '), ta: !!c.querySelector('textarea') }; });
  console.log('chat', JSON.stringify(chat));
  await p.locator('.private-chat textarea').fill('返场那首我在人海里，手都举酸了！'); await sleep(300); await shot('d06-chat-typed');
  const t5 = Date.now(); await p.locator('.private-chat .chat-composer button[type=submit]').click(); await sleep(500); await shot('d06-chat-sent');
  await p.waitForFunction(() => /今晚的返场太好听了/.test(document.querySelector('.private-chat')?.innerText || ''), null, { timeout: 30000 });
  console.log('chat reply ms', Date.now() - t5); await sleep(700); await shot('d06-chat-reply');
  console.log('chat after', await vis('.private-chat'));
  await p.keyboard.press('Escape'); await sleep(800);
  if (await p.locator('#panel:not([hidden]) #panel-close').count()) { await p.locator('#panel-close').click(); await sleep(600); }
  await p.locator('[data-open="about"]:visible').first().click().catch(e => console.log('about', e.message)); await sleep(1000); await shot('d07-about');
  console.log('about', await vis('#panel'));
  console.log('errors', JSON.stringify(s.errors), 'console', JSON.stringify(s.console.slice(0, 12)));
  console.log('AUDIT SUMMARY', JSON.stringify(audits));
} catch (e) { console.error('FAILED', e); try { await s.still(`${OUTD}/zz-failed.png`); } catch {} }
finally { await s?.ctx.close().catch(() => {}); await browser.close(); }
