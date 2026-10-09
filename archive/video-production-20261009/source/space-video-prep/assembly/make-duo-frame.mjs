// Build the split-screen "two devices" background + phone bezel (1920x992 footage area; the 88 px caption band is added by assemble.mjs).
// usage: node make-duo-frame.mjs [labelA] [roleA] [labelB] [roleB]
import { chromium } from '/tmp/space-video-prep/tools/node_modules/playwright-core/index.mjs';
import fs from 'node:fs';
const [la = '阿遥', ra = '主办方 · 手机 A', lb = 'Lin', rb = '同场观众 · 手机 B'] = process.argv.slice(2);
const css = fs.readFileSync('/tmp/space-video-prep/cards/cards.css', 'utf8');
const PW = 416, PH = 900, GAP = 84, Y = 46;
const AX = 960 - GAP / 2 - PW, BX = 960 + GAP / 2;
const av = (id, v) => `file:///tmp/space-video-prep/cards/assets/avatar-${id}-${v}.svg`;
const bg = `<!doctype html><meta charset=utf-8><style>${css}
html,body{width:1920px;height:992px}
.card{position:absolute;inset:0}.frame{border-width:18px}
.side{position:absolute;top:210px;width:380px;text-align:left}
.side h2{font-size:84px;font-weight:600;letter-spacing:.02em;color:var(--green)}
.side p{font-family:var(--mono);font-size:20px;letter-spacing:.16em;color:var(--muted);margin-top:10px}
.side img{height:420px;margin-top:26px;filter:drop-shadow(0 16px 12px rgba(0,0,0,.22))}
.ph{position:absolute;top:${Y}px;width:${PW}px;height:${PH}px;border-radius:44px;box-shadow:0 40px 60px rgba(24,45,38,.38),0 6px 0 rgba(24,45,38,.35)}
.link{position:absolute;left:${960 - GAP / 2}px;width:${GAP}px;top:${Y + PH / 2 - 26}px;height:52px;display:grid;place-items:center;font-size:40px;color:var(--green);font-weight:800}
.eyebrow.tl{position:absolute;left:96px;top:62px}.eyebrow.tr{position:absolute;right:96px;top:62px}
.tag{position:absolute;left:0;right:0;bottom:44px;text-align:center;font-family:var(--mono);font-size:19px;letter-spacing:.2em;color:var(--green2)}
</style><body><div class="card paper grain">
<div class="eyebrow tl">TWO PEOPLE · TWO DEVICES</div><div class="eyebrow tr">同一场 · 各自的手机</div>
<div class="side" style="left:96px"><h2>${la}</h2><p>${ra}</p><img src="${av('static', 'front')}"></div>
<div class="side" style="right:96px;text-align:right"><h2>${lb}</h2><p>${rb}</p><img src="${av('echo', 'front')}" style="margin-left:auto;display:block"></div>
<div class="ph" style="left:${AX}px"></div><div class="ph" style="left:${BX}px"></div>
<div class="link">⇄</div>
<div class="frame"></div></div>`;
const bezel = `<!doctype html><meta charset=utf-8><style>html,body{margin:0;width:1920px;height:992px;background:transparent}
.b{position:absolute;top:${Y - 16}px;width:${PW + 32}px;height:${PH + 32}px;box-sizing:border-box;border:16px solid #17191d;border-radius:60px;box-shadow:inset 0 0 0 3px rgba(255,255,255,.10)}
.b::before{content:"";position:absolute;left:50%;top:-1px;width:120px;height:20px;margin-left:-60px;background:#17191d;border-radius:0 0 14px 14px}</style>
<body><div class="b" style="left:${AX - 16}px"></div><div class="b" style="left:${BX - 16}px"></div>`;
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1920, height: 992 }, deviceScaleFactor: 1 });
fs.writeFileSync('/tmp/space-video-prep/assembly/work/duo-bg.html', bg);
await page.goto('file:///tmp/space-video-prep/assembly/work/duo-bg.html'); await page.evaluate(() => document.fonts.ready); await page.waitForTimeout(500);
await page.screenshot({ path: '/tmp/space-video-prep/assembly/work/duo-bg.png' });
await page.setContent(bezel); await page.screenshot({ path: '/tmp/space-video-prep/assembly/work/duo-bezel.png', omitBackground: true });
await browser.close();
console.log(JSON.stringify({ phoneW: PW, phoneH: PH, ax: AX, bx: BX, y: Y }));
