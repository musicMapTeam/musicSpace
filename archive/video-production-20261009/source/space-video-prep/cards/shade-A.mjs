import { chromium } from '/tmp/space-video-prep/tools/node_modules/playwright-core/index.mjs';
const b = await chromium.launch({ channel: 'chrome', headless: true });
const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
await p.goto('file:///tmp/space-video-prep/cards/card-h-shade-A.html');
await p.screenshot({ path: '/tmp/space-video-prep/cards/out/h-shade-A.png', omitBackground: true });
await b.close();
