// TAKE-P3 -> P-21 (phone 1080x2340, 60 fps): spare for the +4 elastic bars, 成员音乐话题.
// Fresh example world (P1-like visitor: 阿宁 in 失真), joined the after-show chat room in real time (not recorded).
// Recorded, every action on the WORK_BPM beat grid from frame 60:
//   b0 tap 「成员音乐话题 · 发布与讨论」 -> b2 open 「留下我的音乐话题」 -> b4 title 晚班列车 (16ths) -> b6 artist 纸灯乐队 (16ths)
//   -> b8 note 返场前那段鼓点，你们是不是也在跟着拍手？ (32nds) -> b11 tick consent -> b12 「发布音乐话题」 -> the posted card, hold.
// Both names are the example's own fictional song (晚班列车 / 纸灯乐队).  The caret is hidden (it blinks on real time).
// usage: node tools/take-p3.mjs [outName=P-21]
import fs from 'node:fs';
import { launch, killSinks } from '/tmp/space-video-doodle/capture-test/rec2.mjs';
import { openApp, lookAndEnter, freezeKeep, VIEW, ROOT, sleep, CLOCK, NO_CARET } from './lib.mjs';
import { tapAt, makeLog, onBeat, beatFrames, WORK_BPM } from './beat.mjs';

const NAME = process.argv[2] || 'P-21';
const OUT = `${ROOT}/clips/${NAME}.mp4`;
const TITLE = '晚班列车', ARTIST = '纸灯乐队', NOTE = '返场前那段鼓点，你们是不是也在跟着拍手？';
const browser = await launch();
let s;
const report = { take: 'TAKE-P3', clip: NAME, clock: CLOCK, workBpm: WORK_BPM, beatFrames: +beatFrames().toFixed(3), caret: 'hidden (caret-color: transparent)' };
try {
  s = await openApp(browser, VIEW.phone, { name: 'phone-p3', css: NO_CARET });
  const p = s.page;
  await lookAndEnter(s);
  await sleep(9500);                                                     // 林间 arrives; same world state as P1 at this point
  const skip = p.locator('[data-tour-skip]'); if (await skip.count() && await skip.first().isVisible()) { await skip.first().click(); await sleep(800); }
  await p.locator('#scene-details').click(); await sleep(1200);
  await p.locator('#panel [data-open="conversation"]').first().click();
  await p.waitForSelector('.community-panel form[data-group-join]', { timeout: 20000 });
  await sleep(600);
  const join = p.locator('.community-panel form[data-group-join]');
  await join.locator('input[name=consent]').check(); await join.locator('button[type=submit]').click();
  await p.waitForSelector('.community-panel [data-group-topics]', { timeout: 20000 });
  await sleep(2500);
  // the actions row scrolls sideways: bring 「成员音乐话题」 to the left edge (a swipe a person would do; hides the Music Map chip)
  await p.evaluate(() => { const row = document.querySelector('.conversation-actions'); const b = row.querySelector('[data-group-topics]'); row.scrollLeft = b.offsetLeft - row.offsetLeft - 2; });
  await p.evaluate(() => Promise.all([...document.fonts].map(f => f.load().catch(() => null))));
  await p.mouse.move(-40, -40); s.mouse = { x: -40, y: -40 };
  await sleep(1200);
  report.chatStart = await p.evaluate(() => ({ row: [...document.querySelectorAll('.conversation-actions button')].map(b => { const r = b.getBoundingClientRect(); return b.textContent.trim() + ' @' + Math.round(r.left); }), lines: [...document.querySelectorAll('.community-panel article')].slice(0, 4).map(a => a.innerText.replace(/\s+/g, ' ').slice(0, 50)) }));
  report.freeze = await freezeKeep(s);
  s.frameProbe = () => {
    const m = document.querySelector('.music-topics');
    if (!m || m.hidden || !m.getClientRects().length) return document.querySelector('.community-panel:not([hidden])') ? 'chat' : '-';
    const f = m.querySelector('form[data-topic-create]'); const v = n => f?.querySelector(`[name=${n}]`);
    const st = m.querySelector('[role=status],[role=alert]')?.textContent.trim().slice(0, 12) || '';
    return `topics|open=${m.querySelector('details')?.open ? 1 : 0}|t=${v('title')?.value.length ?? '-'}|a=${v('artist')?.value.length ?? '-'}|n=${v('note')?.value.length ?? '-'}|c=${v('consent')?.checked ? 1 : 0}|cards=${m.querySelectorAll('article.music-reference').length}|${st}|sc=${m.querySelector('.community-scroll')?.scrollTop | 0}`;
  };
  s.startRecording(OUT);
  const L = makeLog(s);
  L.add('chat room (after-show), actions row shows 成员音乐话题');
  const O = 60;                                                           // beat grid origin
  const B = k => onBeat(O, k);
  await tapAt(s, '.community-panel [data-group-topics]', B(0), { label: 'b0 tap 成员音乐话题 · 发布与讨论', L });
  await s.until(() => !!document.querySelector('.music-topics details > summary')?.getClientRects().length, { max: 200 });
  await tapAt(s, '.music-topics details > summary', B(2), { label: 'b2 tap 留下我的音乐话题 (form opens)', L });
  const typeOn = async (sel, text, b0, sub, label) => {
    await tapAt(s, `.music-topics form[data-topic-create] ${sel}`, B(b0), { label: `b${b0} tap ${label}`, L });
    const chars = [...text];
    for (let i = 0; i < chars.length; i++) {
      const at = onBeat(O, b0 + (i + 1) / sub);
      await s.frames(Math.max(0, at - s.sink.frames));
      await p.keyboard.insertText(chars[i]);
    }
    L.add(`${label} typed (${chars.length} chars, 1/${sub * 4} notes)`);
  };
  await typeOn('input[name=title]', TITLE, 4, 4, '音乐名称 晚班列车');
  await typeOn('input[name=artist]', ARTIST, 6, 4, '音乐人 纸灯乐队');
  await typeOn('input[name=note]', NOTE, 8, 8, '我想聊的一句话');
  await tapAt(s, '.music-topics form[data-topic-create] input[name=consent]', B(11), { label: 'b11 tick 明确向当前聊天室发布我的自填文字', L });
  await tapAt(s, '.music-topics form[data-topic-create] button', B(12), { label: 'b12 tap 发布音乐话题', L });
  const ok = await s.until(() => !!document.querySelector('.music-topics article.music-reference'), { max: 300 });
  if (!ok) throw new Error('topic card never appeared');
  const C = s.probeLog.findIndex(v => /cards=1/.test(v));
  L.log.push({ label: 'posted card on screen (成员自填 · 未核实 / 晚班列车 / 纸灯乐队 / 阿宁 留下的话题)', frame: C, t: +(C / 60).toFixed(3) });
  await s.frames(Math.max(0, B(16) - s.sink.frames));
  L.add('end (4 beats of hold on the card)');
  report.card = await p.evaluate(() => document.querySelector('.music-topics article.music-reference')?.innerText.replace(/\s+/g, ' '));
  report.cardBox = await p.evaluate(() => { const r = document.querySelector('.music-topics article.music-reference')?.getBoundingClientRect(); return r && { x: r.x, y: r.y, w: r.width, h: r.height }; });
  const r = await s.stopRecording();
  report.rec = { ...r, events: undefined, marks: undefined };
  report.timeline = L.log;
  const pr = s.probeLog; const runs = []; let last = null, start = 0;
  pr.forEach((v, i) => { if (v !== last) { if (last !== null) runs.push(`${start}+${i - start}:${last}`); last = v; start = i; } }); runs.push(`${start}+${pr.length - start}:${last}`);
  report.probeRuns = runs;
  report.errors = s.errors; report.console = s.console.slice(0, 10);
  fs.writeFileSync(`${ROOT}/clips/${NAME}.take.json`, JSON.stringify(report, null, 1));
  console.log(JSON.stringify({ ...report, probeRuns: runs.length > 60 ? runs.slice(0, 60).concat(['...']) : runs }, null, 1));
} catch (e) { console.error('FAILED', e); killSinks(); process.exitCode = 1; }
finally { await s?.ctx.close().catch(() => {}); await browser.close(); }
