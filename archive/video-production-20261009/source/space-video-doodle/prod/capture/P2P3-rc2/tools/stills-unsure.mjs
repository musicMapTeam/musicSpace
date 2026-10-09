// Die-cuts of the honest case (TAKE-P2 state) on 0.22.0-rc.2, from a fresh world that is never saved:
// 「舞台那张」 -> 「✦ 不确定，请选择」, dashed suggestions 舞台 + 人海, nothing selected; the stage polaroid 21:47.  DOM audit before each cut.
import fs from 'node:fs';
import { launch } from '/tmp/space-video-doodle/capture-test/rec2.mjs';
import { openApp, lookAndEnter, VIEW, ROOT, CLOCK, BASE, sleep, audit } from './lib.mjs';
import { StillKit } from './stillkit.mjs';

const browser = await launch();
let s;
try {
  s = await openApp(browser, VIEW.phone, { name: 'phone-unsure', cursor: false });
  const p = s.page;
  const K = new StillKit(s, ROOT, { audit: async id => { const a = await audit(p); if (a.banned.length) throw new Error(`banned copy before ${id}: ${JSON.stringify(a.banned)}`); return { banned: 0, watch: a.watch, chars: a.chars }; } });
  await p.evaluate(() => Promise.all([...document.fonts].map(f => f.load().catch(() => null))));
  await lookAndEnter(s);
  await sleep(9500);
  await p.locator('[data-tour-action="sample:sample-stage"]').click();
  await p.waitForFunction(() => !!document.querySelector('.moment-ai-tag') && document.querySelector('#panel').scrollTop > 40, null, { timeout: 60000 });
  await sleep(1200);
  const state = await p.evaluate(() => ({ sheet: document.querySelector('#panel')?.innerText.replace(/\s+/g, ' ').trim(), tag: document.querySelector('.moment-ai-tag')?.textContent.trim(), chips: [...document.querySelectorAll('[data-moment-viewpoint]')].map(c => c.dataset.momentViewpoint + (c.classList.contains('is-suggested') ? ' suggested' : '') + (c.getAttribute('aria-pressed') === 'true' ? ' selected' : '')) }));
  if (state.tag !== '不确定，请选择') throw new Error('the build answered differently: ' + JSON.stringify(state));
  await K.cut('CUT-04u', 'cut/CUT-04u_ai-tag-unsure', ['.moment-ai-tag'], { pad: 14, storyboard: 'A3, W3', note: '「✦ 不确定，请选择」 (dashed) — the honest case, stage sample, nothing selected' });
  await K.cut('CUT-04v', 'cut/CUT-04v_viewpoint-chips-unsure-dashed', ['.moment-chips'], { pad: 14, storyboard: 'A3', note: 'the four chips: 舞台 and 人海 dashed with sparkles (AI suggestions), nothing selected' });
  await K.cut('CUT-04w', 'cut/CUT-04w_viewpoint-block-unsure', ['.moment-view'], { pad: 14, storyboard: 'A3', note: '我拍的这一面 + dashed suggestions + 不确定，请选择 + hint 「配对时用它找另一面，你说了算。」' });
  await K.cut('POL-09', 'cut/POL-09_upload-polaroid-stage-2147', ['.moment-taken'], { pad: 18, storyboard: 'A3 / M1 polaroid', note: 'upload form polaroid of 舞台那张 with 拍摄于 21:47 · 来自照片自带的信息 · 修改时间 (rc.2: no sample note)' });
  await K.thaw();
  await p.locator('#panel-close').click();                               // never saved
  await p.waitForFunction(() => document.querySelector('#panel')?.hidden, null, { timeout: 10000 });
  fs.writeFileSync(`${ROOT}/logs/stills-unsure.json`, JSON.stringify({ items: K.items, state, base: BASE, clock: CLOCK, errors: s.errors }, null, 1));
  console.log('DONE', JSON.stringify(state));
} catch (e) { console.error('FAILED', e); process.exitCode = 1; }
finally { await s?.ctx.close().catch(() => {}); await browser.close(); }
