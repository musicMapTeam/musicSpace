// Real-time probe of every desktop take on the build to film (dist-pages 8fa52f0), CSS 1440x810 @1 (fast stills), no recording.
// Verifies selectors, states and waits before the frame-stepped takes.  Stills -> ../probe/
import { launch, DESKTOP1X } from './rig.mjs';
import { openApp, enterAsAning, waitForCast, skipTour, viewNow, scrollNow, SEL, qa, sleep, ROOT } from './flow4k.mjs';
const OUTD = `${ROOT}/probe`;
const browser = await launch();
let s;
const T0 = Date.now(); const ts = () => ((Date.now() - T0) / 1000).toFixed(1) + 's';
const shot = async (label) => { await s.still(`${OUTD}/${label}.png`); console.log(ts(), 'shot', label, JSON.stringify(await qa(s))); };
try {
  s = await openApp(browser, DESKTOP1X, { cursor: false, name: 'probe' });
  const p = s.page;
  await shot('d01-landing');
  // landing: element boxes for the match cut + any running animations
  const land = await p.evaluate(() => {
    const out = {};
    const find = t => { const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); let n; while ((n = w.nextNode())) { if (n.textContent.includes(t) && n.parentElement.getClientRects().length) { const b = n.parentElement.getBoundingClientRect(); if (b.width) return { tag: n.parentElement.tagName, cls: n.parentElement.className, box: [b.left, b.top, b.width, b.height].map(Math.round) }; } } return null; };
    for (const t of ['同一刻', '另一面', '就是这一刻', '这一晚的', '进到同一个现场', '进入示例现场', '示例站', '音乐探索']) out[t] = find(t);
    out.anims = document.getAnimations().map(a => `${a.animationName || a.id || a.constructor.name}:${a.playState}:${a.effect?.getComputedTiming?.().iterations}`).slice(0, 20);
    out.canvas = [...document.querySelectorAll('canvas')].map(c => `${c.width}x${c.height} css ${c.clientWidth}x${c.clientHeight}`);
    return out;
  });
  console.log('landing', JSON.stringify(land, null, 0));
  await enterAsAning(s);
  await shot('d02-room-entered');
  const wait = await waitForCast(s); console.log('cast wait ms', wait);
  await shot('d02-room-cast');
  const tourText = await p.evaluate(() => document.querySelector('.demo-tour:not([hidden])')?.innerText.replace(/\s+/g, ' '));
  console.log('tour', tourText);
  console.log('skip', await skipTour(s));
  await sleep(800);
  await shot('d02-room-skipped');
  const room = await p.evaluate(() => ({ hotspots: [...document.querySelectorAll('#hotspots .hotspot')].map(e => `${e.dataset.kind}:${e.innerText.replace(/\s+/g, ' ').trim()}`), canvas: [...document.querySelectorAll('#world canvas, canvas')].map(c => `${c.width}x${c.height} css ${c.clientWidth}x${c.clientHeight}`), header: document.querySelector('header')?.innerText.replace(/\s+/g, ' '), anims: document.getAnimations().length }));
  console.log('room', JSON.stringify(room));
  // camera moves: measure duration in real time
  for (const v of ['photos', 'person', 'overview']) {
    const t = Date.now(); await p.locator(SEL.nav(v)).click(); await sleep(60);
    let moving = true; while (moving && Date.now() - t < 8000) { moving = (await qa(s)).moving; await sleep(30); }
    console.log('view', v, 'move ms', Date.now() - t); await sleep(500); await shot(`d02-view-${v}`);
    if (v === 'person') { const pv = await p.evaluate(() => document.querySelector('#panel:not([hidden])')?.innerText.slice(0, 200).replace(/\s+/g, ' ')); console.log('person panel', pv); }
  }
  // close any panel
  if (await p.locator('#panel:not([hidden]) #panel-close').count()) { await p.locator('#panel-close').click(); await sleep(600); }
  // photos view -> 放一张 -> sample crowd -> AI -> save
  await viewNow(s, 'photos'); await shot('d03a-photos-before');
  const ctx = await p.evaluate(() => document.querySelector('#context-actions:not([hidden])')?.innerText.replace(/\s+/g, ' '));
  console.log('context actions', ctx);
  await p.locator('[data-open="upload"]:visible').first().click(); await sleep(900);
  await shot('d03-upload-open');
  const samples = await p.evaluate(() => [...document.querySelectorAll('[data-sample-photo]')].map(e => `${e.dataset.samplePhoto}:${e.innerText.replace(/\s+/g, ' ').trim()}:${e.getClientRects().length}`));
  console.log('samples', JSON.stringify(samples));
  const t1 = Date.now();
  await p.locator('[data-sample-photo="sample-crowd"]').first().click();
  await p.waitForFunction(() => /AI 判断：|不确定，请选择/.test(document.querySelector('#panel')?.innerText || ''), null, { timeout: 90000 });
  console.log('AI verdict after ms', Date.now() - t1, await p.evaluate(() => document.querySelector('.moment-ai-tag')?.innerText));
  await scrollNow(s, SEL.aiTag); await sleep(300); await shot('d03-upload-ai');
  await p.locator(SEL.save).click();
  await p.waitForFunction(sel => !!document.querySelector(sel), SEL.badge, { timeout: 30000 }); await sleep(1200);
  await shot('d03-after-save-wall');
  await scrollNow(s, SEL.badge); await sleep(300); await shot('d05-wall-badge');
  // exchange
  await p.locator(SEL.offer).click(); await sleep(900); await shot('d05-compose');
  const sel = await p.evaluate(() => document.querySelector('select[data-x-choice]')?.selectedOptions?.[0]?.textContent);
  console.log('choice', sel);
  await scrollNow(s, SEL.xSend, { block: 'end' }); await sleep(300); await p.locator(SEL.xConsent).check(); await sleep(300); await shot('d05-consent');
  const t2 = Date.now(); await p.locator(SEL.xSend).click();
  await p.waitForFunction(() => !!document.querySelector('.exchange-status'), null, { timeout: 20000 }); await sleep(300);
  await scrollNow(s, '.exchange-status', { block: 'start', offset: -24 }); await shot('d05-pending');
  await p.waitForFunction(() => /交换已接受/.test(document.querySelector('.exchange-status')?.innerText || ''), null, { timeout: 30000 });
  console.log('send -> accepted ms', Date.now() - t2);
  await sleep(600); await scrollNow(s, '.exchange-status', { block: 'start', offset: -24 }); await shot('d05-accepted');
  const panelScroll = await p.evaluate(() => { const pn = document.querySelector('#panel'); return { sh: pn.scrollHeight, ch: pn.clientHeight, st: pn.scrollTop }; });
  console.log('panel scroll', JSON.stringify(panelScroll));
  await p.evaluate(() => { const pn = document.querySelector('#panel'); pn.scrollTo({ top: pn.scrollHeight, behavior: 'instant' }); }); await sleep(300); await shot('d05-accepted-bottom');
  await p.locator(SEL.xClose).first().click().catch(e => console.log('xclose', e.message)); await sleep(800);
  if (await p.locator('#panel:not([hidden]) #panel-close').count()) { await p.locator('#panel-close').click(); await sleep(600); }
  await shot('d03b-after-exchange-closed');
  await viewNow(s, 'photos'); await shot('d03b-photos-after');
  await viewNow(s, 'overview'); await shot('d04-overview');
  // 林间
  const t3 = Date.now(); await p.locator(SEL.person('林间')).first().click(); await sleep(60);
  let mv = true; while (mv && Date.now() - t3 < 8000) { mv = (await qa(s)).moving; await sleep(30); } console.log('person 林间 move ms', Date.now() - t3);
  await sleep(400); await shot('d04-linjian-close');
  const ctx2 = await p.evaluate(() => document.querySelector('#context-actions:not([hidden])')?.innerText.replace(/\s+/g, ' '));
  console.log('context actions', ctx2);
  await p.getByRole('button', { name: '认识一下' }).first().click(); await sleep(900); await shot('d04-linjian-card');
  if (await p.locator('#panel:not([hidden]) #panel-close').count()) { await p.locator('#panel-close').click(); await sleep(600); }
  await viewNow(s, 'overview');
  // 小满: greet -> accepted -> private chat
  await p.locator(SEL.person('小满')).first().click(); await sleep(1500); await shot('d06-xiaoman-close');
  const ctx3 = await p.evaluate(() => document.querySelector('#context-actions:not([hidden])')?.innerText.replace(/\s+/g, ' '));
  console.log('context actions 小满', ctx3);
  await p.getByRole('button', { name: '认识一下' }).first().click(); await sleep(900); await shot('d06-xiaoman-card');
  const t4 = Date.now(); await p.locator('[data-social-send]').first().click(); await sleep(400); await shot('d06-greet-sent');
  await p.waitForFunction(() => /你们已经认识了/.test(document.querySelector('#panel')?.innerText || ''), null, { timeout: 30000 });
  console.log('greet -> accepted ms', Date.now() - t4); await sleep(500); await shot('d06-greet-accepted');
  const btns = await p.evaluate(() => [...document.querySelectorAll('#panel button, #panel a')].map(b => `${b.getAttribute('data-open') || ''}|${b.innerText.replace(/\s+/g, ' ').trim()}`).filter(x => x.length > 1).slice(0, 30));
  console.log('panel buttons', JSON.stringify(btns));
  await p.locator('#panel [data-open="chats"], #panel button:has-text("私聊")').first().click(); await sleep(1200); await shot('d06-chat-open');
  const chat = await p.evaluate(() => { const c = document.querySelector('.private-chat'); if (!c) return null; const b = c.getBoundingClientRect(); return { box: [b.left, b.top, b.width, b.height].map(Math.round), text: c.innerText.slice(0, 400).replace(/\s+/g, ' '), ta: !!c.querySelector('textarea') }; });
  console.log('chat', JSON.stringify(chat));
  await p.locator('.private-chat textarea').fill('返场那首我在人海里，手都举酸了！'); await sleep(300); await shot('d06-chat-typed');
  const t5 = Date.now(); await p.locator('.private-chat .chat-composer button[type=submit]').click(); await sleep(500); await shot('d06-chat-sent');
  await p.waitForFunction(() => /今晚的返场太好听了/.test(document.querySelector('.private-chat')?.innerText || ''), null, { timeout: 30000 });
  console.log('chat reply ms', Date.now() - t5); await sleep(700); await shot('d06-chat-reply');
  const chatScroll = await p.evaluate(() => [...document.querySelectorAll('.private-chat *')].filter(e => e.scrollHeight > e.clientHeight + 4 && /(auto|scroll)/.test(getComputedStyle(e).overflowY)).map(e => `${e.className}:${e.scrollTop}/${e.scrollHeight - e.clientHeight}`));
  console.log('chat scrollers', JSON.stringify(chatScroll));
  await p.keyboard.press('Escape'); await sleep(800);
  if (await p.locator('#panel:not([hidden]) #panel-close').count()) { await p.locator('#panel-close').click(); await sleep(600); }
  // about sheet
  await p.locator('[data-open="about"]').first().click().catch(e => console.log('about', e.message)); await sleep(1000); await shot('d07-about');
  console.log('errors', JSON.stringify(s.errors), 'console', JSON.stringify(s.console.slice(0, 12)));
} catch (e) { console.error('FAILED', e); try { await s.still(`${OUTD}/zz-failed.png`); } catch {} }
finally { await s?.ctx.close().catch(() => {}); await browser.close(); }
