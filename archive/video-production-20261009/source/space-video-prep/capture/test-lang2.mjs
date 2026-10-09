import { chromium } from '/tmp/space-video-prep/tools/node_modules/playwright-core/index.mjs';
for (const exe of ['chrome-plain.sh', 'chrome-zh.sh']) {
  try {
    const b = await chromium.launch({ executablePath: '/tmp/space-video-prep/tools/' + exe, headless: true });
    const p = await (await b.newContext({ viewport: { width: 500, height: 120 }, locale: 'zh-CN' })).newPage();
    await p.setContent('<input type=file><input type=date>');
    await p.screenshot({ path: `/tmp/space-video-prep/work-v2/lang-${exe}.png` });
    console.log(exe, 'OK'); await b.close();
  } catch (e) { console.log(exe, 'FAIL', String(e.message).split('\n')[0]); }
}
