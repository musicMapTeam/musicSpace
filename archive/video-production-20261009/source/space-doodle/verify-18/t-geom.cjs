// verify-18: toast geometry vs the close buttons of tall panels / overlays, with real product messages
const { chromium } = require('/tmp/space-video-prep/tools/node_modules/playwright-core');
const fs = require('fs');
const OUT = '/tmp/space-doodle/verify-18';
const VP = {
  w320: { viewport: { width: 320, height: 568 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  w360: { viewport: { width: 360, height: 740 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  w390: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  w430: { viewport: { width: 430, height: 932 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
};
const [, , vp = 'w390', url = 'http://127.0.0.1:5190/'] = process.argv;
const MSGS = ['已分享给本场成员', '这张照片已被收回或移除', '招呼已送达，等待对方决定', '选择已提交，等待更新关系状态', '已屏蔽，联系与待回应招呼已结束', '现在愿意打招呼。是否招手，由你决定。', '已收回这张照片的全部在线分享，原件保留', '已停止等待。若请求已到达，停止等待不会撤销服务器操作。'];
const sleep = ms => new Promise(r => setTimeout(r, ms));
let browser;
setTimeout(async () => { console.error('watchdog'); try { await browser?.close(); } catch {} process.exit(2); }, 280000).unref();
(async () => {
  browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: ['--use-gl=angle', '--ignore-gpu-blocklist', '--hide-scrollbars'] });
  const ctx = await browser.newContext({ ...VP[vp] });
  const page = await ctx.newPage(); page.setDefaultTimeout(25000);
  const out = { vp, panels: {} };
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__SPACE_BOOT__ === 'ready', null, { timeout: 90000 });
    await page.evaluate(() => document.fonts.ready); await sleep(800);
    if (process.env.FIX) await page.addStyleTag({ content: process.env.FIX });
    await page.locator('#join').click();
    await page.waitForSelector('form[data-form="demo-entry"]');
    await page.locator('form[data-form="demo-entry"] input[name=consent]').check();
    await page.waitForFunction(() => !document.querySelector('form[data-form="demo-entry"] button[type=submit]')?.disabled, null, { timeout: 60000 });
    await page.locator('form[data-form="demo-entry"] button[type=submit]').click();
    await page.waitForSelector(".frame[data-stage='room']", { timeout: 30000 });
    await sleep(1500);
    const open = async (kind, id) => { await page.evaluate(([k, i]) => { const b = document.createElement('button'); b.dataset.open = k; if (i) b.dataset.id = i; b.style.cssText = 'position:fixed;left:-9999px'; document.body.append(b); b.click(); b.remove(); }, [kind, id]); await sleep(1500); };
    const probe = async (label, closeSel) => {
      const rows = [];
      for (const msg of MSGS) {
        const r = await page.evaluate(async ([msg, closeSel]) => {
          const t = document.querySelector('#toast'); t.textContent = msg; t.classList.add('visible');
          await new Promise(res => setTimeout(res, 420));
          const R = n => { const r = n.getBoundingClientRect(); return [r.left, r.top, r.right, r.bottom].map(Math.round); };
          const c = [...document.querySelectorAll(closeSel)].find(n => n.getClientRects().length);
          if (!c) { t.classList.remove('visible'); return { msg, close: null }; }
          const cr = c.getBoundingClientRect(); const h = document.elementFromPoint(cr.left + cr.width / 2, cr.top + cr.height / 2);
          const res = { msg, n: msg.length, toast: R(t), close: R(c), centreHit: h === t || t.contains(h) ? 'TOAST' : (h === c || c.contains(h) ? 'close' : (h && (h.id || h.className))) };
          t.classList.remove('visible'); return res;
        }, [msg, closeSel]);
        rows.push(r);
      }
      out.panels[label] = rows;
    };
    await open('wall'); await probe('wall #panel-close', '#panel:not([hidden]) #panel-close');
    await page.evaluate(() => { const t = document.querySelector('#toast'); t.textContent = '已收回这张照片的全部在线分享，原件保留'; t.classList.add('visible'); }); await sleep(450);
    await page.screenshot({ path: `${OUT}/${vp}-geom-wall${process.env.FIX ? '-fix' : ''}.png` });
    await page.evaluate(() => { document.querySelector('#toast').classList.remove('visible'); document.querySelector('#panel-close').click(); }); await sleep(500);
    await page.locator('#social-inbox').click(); await sleep(1200); await probe('inbox #panel-close', '#panel:not([hidden]) #panel-close');
    await page.evaluate(() => document.querySelector('#panel-close').click()); await sleep(500);
    // a private chat with an example person: the overlay sheet header
    const people = await page.evaluate(() => [...document.querySelectorAll('#hotspots [data-kind="person"]')].map(n => ({ id: n.dataset.sceneTarget, label: n.textContent.trim() })));
    const p = people.find(x => x.label.includes('阿遥')) || people[0];
    await open('chats', p.id); await sleep(800);
    await probe('private-chat close', '.private-chat:not([hidden]) .chat-close');
    await page.screenshot({ path: `${OUT}/${vp}-geom-chat${process.env.FIX ? '-fix' : ''}.png` });
  } catch (e) { out.error = e.message.split('\n').slice(0, 3).join(' | '); }
  fs.writeFileSync(`${OUT}/${vp}-geom${process.env.FIX ? '-fix' : ''}.json`, JSON.stringify(out));
  for (const [k, rows] of Object.entries(out.panels)) { console.log('==', k); for (const r of rows) console.log('  ', r.n, JSON.stringify(r.toast), JSON.stringify(r.close), r.centreHit, r.msg); }
  if (out.error) console.log('ERR', out.error);
  await browser.close();
})();
