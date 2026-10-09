// TAKE-P4 (new in rc.2) -> P-22 (phone 1080x2340, 60 fps): 双人纪念 from the invitation to the finished keepsake.  Spare footage for S8:
// in rc.2 the cast joins a creation corner, writes its side and confirms the same version, so the keepsake PNG really gets made.
// Fresh world (P1-like visitor: 阿宁 in 失真), real-time setup (not recorded): enter, wait 9.5 s, 人海那张 -> 保存这张照片 (so 我的照片 1
// exists), 同场的人 -> 小满 -> 向 小满 招个手 -> 你们已经是朋友了.  Recorded on the WORK_BPM grid (origin f60), every wait recorded in full:
//   b0 tap 邀请共同创作 -> b2 tick 邀请 TA，并展示我的昵称和小人 -> b3 发出邀请 (「已确认。」 「等 TA 加入。」) -> 小满 joins (autopilot; the card
//   「同一晚，我们的另一面。」 with both avatars, his line and photo) -> scroll to the whole card -> scroll to 我们的共同草稿 -> 我的一句话
//   返场那首我在人海里，手都举酸了！ (32nds) -> 我的照片 = 我的照片 1 · 已上墙 -> tick 把我的小人、留言和照片给 TA -> 保存我的部分 ->
//   tick 我确认这一版 -> 确认这一版本 -> 小满 confirms (你已确认 · 对方已确认) -> tick 把这一版存到我的创作 -> 保存到我的创作 ->
//   tick 导出这一版 -> 生成纪念图 PNG -> 「纪念图做好了。」 + the preview -> scroll to it, hold.
// The photo <select> is set the way the native picker does it (value + input/change events; the picker itself is not drawn headless).
// usage: node tools/take-corner.mjs [outName=P-22]
import fs from 'node:fs';
import { launch, killSinks } from '/tmp/space-video-doodle/capture-test/rec2.mjs';
import { openApp, lookAndEnter, freezeKeep, VIEW, ROOT, sleep, CLOCK, NO_CARET, BASE, auditOrThrow, scrollTo } from './lib.mjs';
import { tapAt, makeLog, onBeat, beatFrames, WORK_BPM } from './beat.mjs';


/** recorded eased scroll of the corner sheet's scroller so that `selector` sits at `block` (+offset): cubic ease-in-out sampled per output
 *  frame, rounded to whole CSS px (Chrome renders this scroller on whole px) and forced to move at least 1 px every frame, so the ease's
 *  slow ends never leave a repeated frame inside the motion */
async function scrollCorner(s, selector, { frames, block = 'center', offset = 0 } = {}) {
  const info = await s.page.evaluate(([sel, block, offset]) => {
    const sc = document.querySelector('.corner-panel .community-scroll'); const el = document.querySelector(sel); if (!sc || !el) return null;
    const er = el.getBoundingClientRect(), sr = sc.getBoundingClientRect();
    let to = sc.scrollTop + (er.top - sr.top) - (block === 'center' ? (sr.height - er.height) / 2 : block === 'end' ? sr.height - er.height : 0) + offset;
    to = Math.round(Math.max(0, Math.min(sc.scrollHeight - sc.clientHeight, to))); return { from: Math.round(sc.scrollTop), to };
  }, [selector, block, offset]);
  if (!info || Math.abs(info.to - info.from) < 2) return info;
  const n = Math.max(2, Math.min(frames, Math.abs(info.to - info.from)));
  const ease = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  const sg = Math.sign(info.to - info.from);
  const ys = []; for (let i = 1; i <= n; i++) ys.push(Math.round(info.from + (info.to - info.from) * ease(i / n)));
  for (let i = 0; i < n; i++) { const prev = i ? ys[i - 1] : info.from; if ((ys[i] - prev) * sg < 1) ys[i] = prev + sg; }          // forward: >= 1 px per frame
  ys[n - 1] = info.to;
  for (let i = n - 2; i >= 0; i--) if ((ys[i + 1] - ys[i]) * sg < 1) ys[i] = ys[i + 1] - sg;                                    // backward: keep it under the target
  for (const y of ys) { await s.page.evaluate(v => { document.querySelector('.corner-panel .community-scroll').scrollTop = v; }, y); await s.frames(1); }
  return { ...info, frames: n };
}

const NAME = process.argv[2] || 'P-22';
const OUT = `${ROOT}/clips/${NAME}.mp4`;
const LINE = '返场那首我在人海里，手都举酸了！';
const browser = await launch();
let s;
const report = { take: 'TAKE-P4 corner keepsake (rc.2, new)', clip: NAME, base: BASE, clock: CLOCK, workBpm: WORK_BPM, beatFrames: +beatFrames().toFixed(3), caret: 'hidden (caret-color: transparent)', audits: [] };
try {
  s = await openApp(browser, VIEW.phone, { name: 'phone-p4', css: NO_CARET });
  const p = s.page;
  await lookAndEnter(s);
  await sleep(9500);
  await p.locator('[data-tour-action="sample:sample-crowd"]').click();
  await p.waitForFunction(() => /AI 判断：/.test(document.querySelector('.moment-ai-tag')?.textContent || ''), null, { timeout: 60000 });
  await sleep(800);
  await p.locator('form[data-form="upload"] button[type=submit]').click();
  await p.waitForSelector('[data-moment-badge="other-side"]', { timeout: 30000 });
  await sleep(2600);
  for (let i = 0; i < 3; i++) { const open = await p.evaluate(() => document.querySelector('#panel') && !document.querySelector('#panel').hidden); if (!open) break; await p.locator('#panel-close').click().catch(() => {}); await sleep(500); }
  await p.locator('[data-view="person"]').click(); await sleep(1500);
  await p.locator('[data-person]', { hasText: '小满' }).first().click(); await sleep(2000);
  await p.locator('[data-social-send]').first().click();
  await p.waitForFunction(() => /你们已经是朋友了/.test(document.querySelector('#panel')?.innerText || ''), null, { timeout: 30000 });
  await sleep(3000);                                                    // toasts gone, 3D close-up settled
  report.build = await p.evaluate(() => fetch('build.json').then(r => r.json()).then(b => ({ version: b.version, commit: b.commit, builtAt: b.builtAt })).catch(e => String(e)));
  await p.evaluate(() => Promise.all([...document.fonts].map(f => f.load().catch(() => null))));
  await p.mouse.move(-40, -40); s.mouse = { x: -40, y: -40 };
  await sleep(800);
  report.friendCard = await p.evaluate(() => document.querySelector('#panel')?.innerText.replace(/\s+/g, ' ').trim());
  await auditOrThrow(p, 'friend card before recording', report.audits);
  report.freeze = await freezeKeep(s);
  s.frameProbe = () => {
    const c = document.querySelector('.corner-panel');
    if (!c || !c.getClientRects().length) return document.querySelector('#panel:not([hidden])') ? 'card' : '-';
    const t = c.innerText;
    const v = (t.match(/版本 (\d+) · 你(.)确认 · 对方(.)确认/) || []);
    const sc = c.querySelector('.community-scroll');
    const img = c.querySelector('img.corner-result-preview');
    return `corner|${/等 TA 加入/.test(t) ? 'wait' : /小满 的这一面/.test(t) ? 'joined' : 'open'}|v${v[1] || '-'}${v[2] || ''}${v[3] || ''}|n=${c.querySelector('[name=note]')?.value.length ?? '-'}|ph=${c.querySelector('select[name=photoId]')?.value ? 1 : 0}|${img ? (img.complete && img.naturalWidth ? 'png' : 'png-loading') : '-'}|sc=${sc?.scrollTop | 0}|f=${[...c.querySelectorAll('form')].map(f => (f.getAttributeNames().find(n => n.startsWith('data-corner-')) || '?').slice(12)).join(',')}|${(c.querySelector('[role=status]')?.textContent || '').trim().slice(0, 10)}`;
  };
  s.startRecording(OUT);
  const L = makeLog(s);
  report.timeline = L.log;
  L.add('friend card over the 3D close-up of 小满 (你们已经认识了 / 邀请共同创作 / 和 小满 私聊 ↗ / 你们已经是朋友了。)');
  const O = 60;
  const B = k => onBeat(O, k);
  const nextB = () => { const f = s.sink.frames + 4; return Math.ceil((f - O) / beatFrames()); };   // next beat index at least 4 frames ahead
  const tapB = async (sel, k, label) => {
    const r = await tapAt(s, sel, B(k), { label: `b${k} ${label}`, L });
    const last = L.log[L.log.length - 1];
    if (last.y < 0 || last.y > s.H || last.x < 0 || last.x > s.W) throw new Error(`tap outside the viewport: ${label} @${last.x},${last.y}`);
    return r;
  };
  const first = re => { const i = s.probeLog.findIndex(v => re.test(v)); return i; };
  await tapB('#panel [data-open="corners"]', 0, 'tap 邀请共同创作');
  await s.until(() => !!document.querySelector('.corner-panel form[data-corner-create] input[name=participation]')?.getClientRects().length, { max: 200 });
  await auditOrThrow(p, 'corner sheet open', report.audits);
  await tapB('.corner-panel form[data-corner-create] input[name=participation]', 2, 'tick 邀请 TA，并展示我的昵称和小人');
  await tapB('.corner-panel form[data-corner-create] button[type=submit]', 3, 'tap 发出邀请');
  if (!await s.until(() => /等 TA 加入/.test(document.querySelector('.corner-panel')?.innerText || ''), { max: 300 })) throw new Error('no 等 TA 加入');
  L.log.push({ label: '「已确认。」 + 「等 TA 加入。」 on screen', frame: first(/\|wait\|/), t: +(first(/\|wait\|/) / 60).toFixed(3) });
  await auditOrThrow(p, 'invitation sent', report.audits);
  if (!await s.until(() => /小满 的这一面/.test(document.querySelector('.corner-panel')?.innerText || ''), { max: 900 })) throw new Error('小满 never joined');
  report.sideOrder = await p.evaluate(() => [...document.querySelectorAll('.corner-panel .corner-pair .corner-side > b')].map(b => b.textContent.trim()));
  if (process.env.WANT_FIRST && report.sideOrder[0] !== process.env.WANT_FIRST) { const e = new Error(`side order ${report.sideOrder.join(' / ')} (this world lists ${report.sideOrder[0]} first; the product orders the two sides per world) -> retry`); e.retry = true; throw e; }
  const J = first(/\|joined\|/);
  L.log.push({ label: '小满 joined: the sheet goes full height with 「同一晚，我们的另一面。」, both avatars, 小满\'s line + photo', frame: J, t: +(J / 60).toFixed(3) });
  await auditOrThrow(p, '小满 joined', report.audits);
  let k = nextB() + 2;                                                   // 2 beats on the top of the card
  await s.frames(Math.max(0, B(k) - s.sink.frames));
  L.add(`b${k} scroll: the whole card`);
  await scrollCorner(s, '.corner-panel figure.corner-art', { frames: Math.round(beatFrames()), block: 'center' });
  k = nextB() + 2;                                                       // hold the whole card 2 beats
  await s.frames(Math.max(0, B(k) - s.sink.frames));
  L.add(`b${k} scroll: 我们的共同草稿 form`);
  await scrollCorner(s, '.corner-panel form[data-corner-edit]', { frames: Math.round(beatFrames()), block: 'center', offset: 70 });   // +70: see c9 probe (typing at sc 610 jumps 89 px per key in capture only)
  k = nextB();
  await tapB('.corner-panel form[data-corner-edit] input[name=note]', k, 'tap 我的一句话');
  const chars = [...LINE];
  for (let i = 0; i < chars.length; i++) { const at = onBeat(O, k + (i + 1) / 8); await s.frames(Math.max(0, at - s.sink.frames)); await p.keyboard.insertText(chars[i]); }
  L.add(`我的一句话 typed (${chars.length} chars, 1/32 notes)`);
  k = nextB();
  await s.frames(Math.max(0, B(k) - s.sink.frames));
  report.photoOption = await p.evaluate(() => { const sel = document.querySelector('.corner-panel form[data-corner-edit] select[name=photoId]'); const o = [...sel.options].find(o => o.value); if (!o) return null; sel.value = o.value; sel.dispatchEvent(new Event('input', { bubbles: true })); sel.dispatchEvent(new Event('change', { bubbles: true })); return o.text; });
  L.add(`b${k} 我的照片 -> ${report.photoOption} (native picker choice: value + input/change)`);
  k = nextB();
  await tapB('.corner-panel form[data-corner-edit] input[name=share]', k, 'tick 把我的小人、留言和照片给 TA');
  await tapB('.corner-panel form[data-corner-edit] button[type=submit]', k + 1, 'tap 保存我的部分');
  if (!await s.until(() => /版本 4/.test(document.querySelector('.corner-panel')?.innerText || '') && !!document.querySelector('.corner-panel form[data-corner-confirm]'), { max: 300 })) throw new Error('my part not saved');
  L.log.push({ label: 'version 4 (my line + my photo in the card)', frame: first(/\|v4/), t: +(first(/\|v4/) / 60).toFixed(3) });
  k = nextB();
  await s.frames(Math.max(0, B(k) - s.sink.frames));
  L.add(`b${k} scroll: the card with my side`);
  await scrollCorner(s, '.corner-panel figure.corner-art', { frames: Math.round(beatFrames()), block: 'center' });
  k = nextB() + 2;
  await s.frames(Math.max(0, B(k) - s.sink.frames));
  L.add(`b${k} scroll: 我确认这一版`);
  await scrollCorner(s, '.corner-panel form[data-corner-confirm]', { frames: Math.round(beatFrames()), block: 'center' });
  k = nextB();
  await tapB('.corner-panel form[data-corner-confirm] input[name=confirm]', k, 'tick 我确认这一版');
  await tapB('.corner-panel form[data-corner-confirm] button[type=submit]', k + 1, 'tap 确认这一版本');
  if (!await s.until(() => /你已确认 · 对方已确认/.test(document.querySelector('.corner-panel')?.innerText || ''), { max: 900 })) throw new Error('小满 never confirmed');
  L.log.push({ label: '「版本 4 · 你已确认 · 对方未确认」', frame: first(/\|v4已未/), t: +(first(/\|v4已未/) / 60).toFixed(3) });
  L.log.push({ label: '小满 confirmed: 「版本 4 · 你已确认 · 对方已确认」 + 把这一版存到我的创作', frame: first(/\|v4已已/), t: +(first(/\|v4已已/) / 60).toFixed(3) });
  await s.until(() => !!document.querySelector('.corner-panel form[data-corner-save] input[name=save]')?.getClientRects().length, { max: 120 });
  k = nextB() + 1;
  await s.frames(Math.max(0, B(k) - s.sink.frames));
  L.add(`b${k} scroll: 把这一版存到我的创作`);
  await scrollCorner(s, '.corner-panel form[data-corner-save]', { frames: Math.round(beatFrames()), block: 'center' });
  k = nextB();
  await tapB('.corner-panel form[data-corner-save] input[name=save]', k, 'tick 把这一版存到我的创作');
  await tapB('.corner-panel form[data-corner-save] button[type=submit]', k + 1, 'tap 保存到我的创作');
  if (!await s.until(() => !!document.querySelector('.corner-panel form[data-corner-export] input[name=export]')?.getClientRects().length, { max: 300 })) throw new Error('no export form');
  L.add('「已保存到我的创作。」 + 导出这一版 / 生成纪念图 PNG');
  k = nextB();
  await s.frames(Math.max(0, B(k) - s.sink.frames));
  L.add(`b${k} scroll: 导出这一版`);
  await scrollCorner(s, '.corner-panel form[data-corner-export]', { frames: Math.round(beatFrames()), block: 'center' });
  k = nextB();
  await tapB('.corner-panel form[data-corner-export] input[name=export]', k, 'tick 导出这一版');
  await tapB('.corner-panel form[data-corner-export] button[type=submit]', k + 1, 'tap 生成纪念图 PNG');
  if (!await s.until(() => { const i = document.querySelector('.corner-panel img.corner-result-preview'); return !!(i && i.complete && i.naturalWidth); }, { max: 600 })) throw new Error('no keepsake preview');
  if (first(/\|png\|/) < 0) await s.frames(1);
  L.log.push({ label: '「纪念图做好了。」 + keepsake preview decoded', frame: first(/\|png\|/), t: +(first(/\|png\|/) / 60).toFixed(3) });
  k = nextB();
  await s.frames(Math.max(0, B(k) - s.sink.frames));
  L.add(`b${k} scroll: the keepsake preview`);
  await scrollCorner(s, '.corner-panel img.corner-result-preview', { frames: Math.round(beatFrames()), block: 'center' });
  k = nextB() + 3;                                                       // ~3 s after 纪念图做好了。 the product re-renders and the scroll jumps back (seen at +194 frames): end before it
  await s.frames(Math.max(0, B(k) - s.sink.frames));
  L.add('end (3 beats on the keepsake preview)');
  await auditOrThrow(p, 'end of take (keepsake preview)', report.audits);
  report.corner = await p.evaluate(() => document.querySelector('.corner-panel')?.innerText.replace(/\s+/g, ' '));
  report.preview = await p.evaluate(() => { const i = document.querySelector('.corner-panel img.corner-result-preview'); const r = i?.getBoundingClientRect(); return i && { w: i.naturalWidth, h: i.naturalHeight, box: { x: r.x, y: r.y, w: r.width, h: r.height } }; });
  const r = await s.stopRecording();
  report.rec = { ...r, events: undefined, marks: undefined };
  report.timeline = L.log;
  const pr = s.probeLog; const runs = []; let last = null, start = 0;
  pr.forEach((v, i) => { if (v !== last) { if (last !== null) runs.push(`${start}+${i - start}:${last}`); last = v; start = i; } }); runs.push(`${start}+${pr.length - start}:${last}`);
  report.probeRuns = runs;
  await s.unfreeze();
  const dl = p.waitForEvent('download', { timeout: 30000 });
  await p.locator('.corner-panel [data-corner-download]').click();
  const d = await dl;
  const png = `${ROOT}/exports/CORNER-03p_creation-corner-keepsake-from-P-22.png`;
  await d.saveAs(png);
  report.keepsakePng = { file: png, suggested: d.suggestedFilename(), note: 'the same keepsake the clip shows (downloaded right after the recording, same world)' };
  report.errors = s.errors; report.console = s.console.slice(0, 10);
  fs.writeFileSync(`${ROOT}/clips/${NAME}.take.json`, JSON.stringify(report, null, 1));
  console.log(JSON.stringify({ ...report, probeRuns: runs.length > 80 ? runs.slice(0, 80).concat(['...']) : runs }, null, 1));
} catch (e) {
  console.error('FAILED', e); process.exitCode = e.retry ? 3 : 1;
  try { if (s?.sink) s.sink.done.catch(() => {}); } catch {}
  try { await s?.page.screenshot({ path: `${ROOT}/review/take-corner-FAIL.png` }); } catch {}
  try { report.failState = await s?.page.evaluate(() => ({ corner: document.querySelector('.corner-panel')?.innerText.replace(/\s+/g, ' ').slice(0, 1500), forms: [...document.querySelectorAll('.corner-panel form')].map(f => [...f.attributes].map(a => a.name).join(' ')) })); } catch {}
  try { fs.writeFileSync(`${ROOT}/logs/take-corner.fail.json`, JSON.stringify({ error: String(e && e.stack || e), report, timeline: report.timeline, probe: s?.probeLog?.slice(-60) }, null, 1)); } catch {}
  killSinks();
}
finally { await s?.ctx.close().catch(() => {}); await browser.close(); }
