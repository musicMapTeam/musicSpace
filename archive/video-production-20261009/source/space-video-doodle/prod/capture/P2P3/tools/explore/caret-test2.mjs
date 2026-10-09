// Spawn Chrome ourselves (so Cocoa NSArgumentDomain defaults can be passed) and connect over CDP; measure caret blink.
import { chromium } from '/tmp/space-video-prep/tools/node_modules/playwright-core/index.mjs';
import { spawn } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
const variant = process.argv[2] || 'defaults';
const port = 48395;
const udd = fs.mkdtempSync('/tmp/space-video-doodle/prod/capture/P2P3/review/caret/udd-');
const extra = variant === 'defaults' ? ['-NSTextInsertionPointBlinkPeriod', '200000'] : [];
const ch = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${udd}`, '--no-first-run', '--no-default-browser-check', '--use-angle=metal', '--hide-scrollbars', ...extra], { stdio: ['ignore', 'ignore', 'pipe'] });
let ws = null; ch.stderr.on("data", d => { process.stderr.write("[chrome] " + String(d).slice(0, 300)); const m = String(d).match(/ws:\/\/\S+/); if (m) ws = m[0]; });
for (let i = 0; i < 100 && !ws; i++) await new Promise(r => setTimeout(r, 100));
const b = await chromium.connectOverCDP(ws);
const ctx = await b.newContext({ viewport: { width: 300, height: 120 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const p = await ctx.newPage();
await p.setContent('<input id=i style="font:24px sans-serif;margin:20px;width:200px">');
await p.focus('#i'); await p.keyboard.type('abc');
const cdp = await ctx.newCDPSession(p);
const hs = [];
for (let i = 0; i < 16; i++) { await new Promise(r => setTimeout(r, 170)); const s = await cdp.send('Page.captureScreenshot', { format: 'png', fromSurface: true }); hs.push(crypto.createHash('md5').update(s.data).digest('hex').slice(0, 5)); if (i === 3) fs.writeFileSync(`/tmp/space-video-doodle/prod/capture/P2P3/review/caret/${variant}.png`, Buffer.from(s.data, 'base64')); }
console.log(variant, 'unique frames over 2.7 s:', new Set(hs).size, hs.join(' '));
await b.close(); ch.kill('SIGTERM'); await new Promise(r => setTimeout(r, 500)); fs.rmSync(udd, { recursive: true, force: true });
