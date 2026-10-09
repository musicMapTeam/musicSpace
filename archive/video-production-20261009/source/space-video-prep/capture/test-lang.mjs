import { chromium } from '/tmp/space-video-prep/tools/node_modules/playwright-core/index.mjs';
const variants = { plain: {}, wrapper: { executablePath: '/tmp/space-video-prep/tools/chrome-zh.sh' }, wrapperLang: { executablePath: '/tmp/space-video-prep/tools/chrome-zh.sh', args: ['--lang=zh-CN'] } };
for (const [name, extra] of Object.entries(variants)) {
  const b = await chromium.launch({ ...(extra.executablePath ? {} : { channel: 'chrome' }), headless: true, ...extra });
  const c = await b.newContext({ viewport: { width: 500, height: 200 }, locale: 'zh-CN' });
  const p = await c.newPage();
  await p.setContent('<input type=file><select><option>仅自己保存</option></select><input type=date><button>x</button>');
  await p.screenshot({ path: `/tmp/space-video-prep/work-v2/lang-${name}.png` });
  console.log(name, 'accept-lang', await p.evaluate(() => navigator.languages.join(',')));
  await b.close();
}
