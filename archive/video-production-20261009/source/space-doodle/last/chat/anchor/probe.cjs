const { chromium } = require('/tmp/space-video-prep/tools/node_modules/playwright-core');
(async () => {
  const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
  const page = await browser.newPage({ viewport: { width: 800, height: 700 } });
  const html = n => `<style>body{margin:0}.panel{position:absolute;top:20px;bottom:20px;left:20px;width:400px;display:flex;flex-direction:column}
   .thread{overflow:auto;flex:1;padding:16px}.msgs{display:flex;flex-direction:column;gap:18px}.msg{height:72px;background:#eee}
   .row:empty{display:none}.row{padding:8px}</style><div class="panel"><div class="thread"><div class="msgs">${'<div class="msg"></div>'.repeat(n)}</div></div><div class="row"></div><div style="height:150px">composer</div></div>`;
  for (const [n, extra] of [[4, 0], [5, 0], [6, 0], [4, 1], [5, 1]]) {
    await page.setContent(html(n));
    const r = await page.evaluate(async ([extra]) => {
      const th = document.querySelector('.thread'), row = document.querySelector('.row'), msgs = document.querySelector('.msgs');
      // pad content so that max scroll is small/large
      if (extra) msgs.style.paddingBottom = '0px';
      th.scrollTop = th.scrollHeight; await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
      const before = { st: th.scrollTop, sh: th.scrollHeight, ch: th.clientHeight };
      row.textContent = 'status line that appears below the thread'; row.style.height = '33px';
      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
      const after = { st: th.scrollTop, sh: th.scrollHeight, ch: th.clientHeight };
      return { before, after };
    }, [extra]);
    console.log(`n=${n}`, JSON.stringify(r));
  }
  await browser.close();
})();
