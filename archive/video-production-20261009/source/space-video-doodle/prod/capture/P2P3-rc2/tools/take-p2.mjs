// TAKE-P2 -> P-06 (phone 1080x2340, 60 fps), re-shot on 0.22.0-rc.2: the honest case.  Fresh world, visitor 阿宁 in 失真, never saved.
// Room with the onboarding card 「第一次来 1/4 · 放一张今晚的照片」 -> tap 「舞台那张」 -> upload sheet, the on-device AI answers 「不确定，请选择」 with two dashed
// suggestions (舞台, 人海), nothing selected -> exactly 3 beats (WORK_BPM) after the AI line is on screen, tap 舞台 -> selected.
// Then the sheet is closed without saving (not recorded).  Setup is real time; the recording is frame-stepped on the fake clock.
// usage: node tools/take-p2.mjs [outName=P-06]
import fs from 'node:fs';
import { launch, killSinks } from '/tmp/space-video-doodle/capture-test/rec2.mjs';
import { openApp, lookAndEnter, freezeKeep, VIEW, ROOT, sleep, CLOCK, BASE, audit, auditOrThrow } from './lib.mjs';
import { tapAt, makeLog, onBeat, beatFrames, WORK_BPM } from './beat.mjs';

const NAME = process.argv[2] || 'P-06';
const OUT = `${ROOT}/clips/${NAME}.mp4`;
const browser = await launch();
let s;
const report = { take: 'TAKE-P2 (rc.2)', clip: NAME, base: BASE, clock: CLOCK, workBpm: WORK_BPM, beatFrames: +beatFrames().toFixed(3), audits: [] };
try {
  s = await openApp(browser, VIEW.phone, { name: 'phone-p2' });
  const p = s.page;
  await lookAndEnter(s);
  const tRoom = Date.now();
  await p.evaluate(() => Promise.all([...document.fonts].map(f => f.load().catch(() => null))));   // no font swap mid-take
  await p.waitForSelector('[data-tour-action="sample:sample-stage"]', { state: 'visible', timeout: 30000 });
  const wait = 9500 - (Date.now() - tRoom); if (wait > 0) await sleep(wait);   // 林间 arrives, AI model downloads in the background
  report.roomText = await p.evaluate(() => [...document.querySelectorAll('#hotspots .hotspot[data-kind=person]')].map(e => e.innerText.replace(/\s+/g, ' ').trim()));
  report.ai = await p.evaluate(() => { try { const q = window.__SPACE_EVENT_QA__?.(); return q?.ai || q?.moments?.ai || null; } catch (e) { return String(e); } });
  report.build = await p.evaluate(() => fetch('build.json').then(r => r.json()).then(b => ({ version: b.version, commit: b.commit, builtAt: b.builtAt })).catch(e => String(e)));
  report.tourCard = await p.evaluate(() => document.querySelector('.demo-tour')?.innerText.replace(/\s+/g, ' ').trim());
  await auditOrThrow(p, 'room before recording', report.audits);
  await p.mouse.move(-40, -40); s.mouse = { x: -40, y: -40 };
  await sleep(600);
  report.freeze = await freezeKeep(s);
  // per frame: P panel open, scrollTop, ai line state (T thinking / U unsure / A sure), suggested + selected chips, photo decoded
  s.frameProbe = () => {
    const panel = document.querySelector('#panel');
    if (!panel || panel.hidden) return '-';
    const tag = document.querySelector('.moment-ai-tag');
    const line = document.querySelector('[data-ai-line]');
    const lt = (line?.textContent || '').trim();
    const st = tag ? (/不确定/.test(tag.textContent) ? 'U' : /AI 判断/.test(tag.textContent) ? 'A' : 'X') : (/判断视角|下载|准备/.test(lt) ? 'T' : '0');
    let vis = '';
    if (tag) { const r = tag.getBoundingClientRect(); vis = r.top >= 0 && r.bottom <= innerHeight - 90 ? 'v' : 'h'; }
    const chips = [...document.querySelectorAll('[data-moment-viewpoint]')].map(c => c.dataset.momentViewpoint[0] + (c.classList.contains('is-suggested') ? '~' : '') + (c.getAttribute('aria-pressed') === 'true' ? '*' : '')).join('');
    const img = document.querySelector('#panel .photo-review');
    return `P${panel.scrollTop | 0}|${st}${vis}|${chips}|${img ? (img.complete && img.naturalWidth ? 'img' : 'noimg') : '-'}`;
  };
  s.startRecording(OUT);
  const L = makeLog(s);
  L.add('room (onboarding card 第一次来 1/4 · 放一张今晚的照片)');
  const t1 = await tapAt(s, '[data-tour-action="sample:sample-stage"]', 120, { label: 'tap 舞台那张', L });
  // the sheet opens; the AI answers in real time; the product jump-scrolls to the photo facts when the sheet animation ends
  const ok = await s.until(() => {
    const tag = document.querySelector('.moment-ai-tag'); const panel = document.querySelector('#panel');
    if (!tag || !panel || panel.hidden) return false;
    const r = tag.getBoundingClientRect(); return panel.scrollTop > 40 && r.top >= 0 && r.bottom <= innerHeight - 90;
  }, { max: 400 });
  if (!ok) throw new Error('AI line never came into view');
  // first captured frame that shows it (from the per-frame probe, not from the moment until() noticed it)
  let U = s.probeLog.findIndex(v => /\|Uv\|/.test(v));
  if (U < 0) { await s.frames(1); U = s.probeLog.findIndex(v => /\|Uv\|/.test(v)); }
  L.log.push({ label: 'AI line 「不确定，请选择」 + dashed 舞台/人海 on screen (sync point 33:4)', frame: U, t: +(U / 60).toFixed(3) });
  const F0 = s.probeLog.findIndex(v => v !== '-');
  L.log.push({ label: 'upload sheet first frame (fading in over the room)', frame: F0, t: +(F0 / 60).toFixed(3) });
  report.aiLine = await p.evaluate(() => ({ tag: document.querySelector('.moment-ai-tag')?.textContent.trim(), cls: document.querySelector('.moment-ai-tag')?.className, line: document.querySelector('[data-ai-line]')?.textContent.replace(/\s+/g, ' ').trim(), chips: [...document.querySelectorAll('[data-moment-viewpoint]')].map(c => c.dataset.momentViewpoint + (c.classList.contains('is-suggested') ? ' suggested' : '') + (c.getAttribute('aria-pressed') === 'true' ? ' selected' : '')), taken: document.querySelector('.moment-taken')?.textContent.replace(/\s+/g, ' ').trim() }));
  await auditOrThrow(p, 'upload sheet (AI line on screen)', report.audits);
  report.sheetText = await p.evaluate(() => document.querySelector('#panel')?.innerText.replace(/\s+/g, ' ').trim());
  const up2 = onBeat(U, 3);
  await tapAt(s, '[data-moment-viewpoint="stage"]', up2, { label: 'tap 舞台 chip (3 beats after the AI line = 34:3)', L });
  await s.frames(1);
  report.afterTap = await p.evaluate(() => [...document.querySelectorAll('[data-moment-viewpoint]')].map(c => c.dataset.momentViewpoint + (c.classList.contains('is-suggested') ? ' suggested' : '') + (c.getAttribute('aria-pressed') === 'true' ? ' selected' : '')));
  await s.frames(Math.round(2 * beatFrames()) + 45 - 1);
  L.add('end');
  await auditOrThrow(p, 'end of take', report.audits);
  const r = await s.stopRecording();
  report.rec = { ...r, events: undefined, marks: undefined };
  report.timeline = L.log;
  const pr = s.probeLog; const runs = []; let last = null, start = 0;
  pr.forEach((v, i) => { if (v !== last) { if (last !== null) runs.push(`${start}+${i - start}:${last}`); last = v; start = i; } }); runs.push(`${start}+${pr.length - start}:${last}`);
  report.probeRuns = runs;
  await s.unfreeze();
  await p.locator('#panel-close').click();              // close without saving: the world stays unsaved
  await p.waitForFunction(() => document.querySelector('#panel')?.hidden, null, { timeout: 10000 });
  report.savedPhotos = await p.evaluate(() => document.querySelectorAll('[data-moment-badge], .wall-photo').length);
  report.errors = s.errors; report.console = s.console.slice(0, 10);
  fs.writeFileSync(`${ROOT}/clips/${NAME}.take.json`, JSON.stringify(report, null, 1));
  console.log(JSON.stringify(report, null, 1));
} catch (e) { console.error('FAILED', e); killSinks(); process.exitCode = 1; }
finally { await s?.ctx.close().catch(() => {}); await browser.close(); }
