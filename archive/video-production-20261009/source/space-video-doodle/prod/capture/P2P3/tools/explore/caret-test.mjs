// Does a per-process NSUserDefaults override stop the caret blink (deterministic frames)?  variant: 'none' | 'defaults'
import { chromium } from '/tmp/space-video-prep/tools/node_modules/playwright-core/index.mjs';
import crypto from 'node:crypto';
const variant = process.argv[2] || 'none';
const extra = variant === 'defaults' ? ['-NSTextInsertionPointBlinkPeriodOn', '200000', '-NSTextInsertionPointBlinkPeriodOff', '200000'] : [];
const b = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--use-angle=metal', '--hide-scrollbars', ...extra] });
const ctx = await b.newContext({ viewport: { width: 300, height: 120 }, deviceScaleFactor: 2 });
const p = await ctx.newPage();
await p.setContent('<input id=i style="font:24px sans-serif;margin:20px;width:200px">');
await p.focus('#i'); await p.keyboard.type('abc');
const cdp = await ctx.newCDPSession(p);
const hs = [];
for (let i = 0; i < 16; i++) { await new Promise(r => setTimeout(r, 170)); const s = await cdp.send('Page.captureScreenshot', { format: 'png', fromSurface: true }); hs.push(crypto.createHash('md5').update(s.data).digest('hex').slice(0, 5)); }
console.log(variant, 'pages:', b.contexts().map(c => c.pages().length).join(','), 'unique frames over 2.7 s:', new Set(hs).size, hs.join(' '));
await b.close();
