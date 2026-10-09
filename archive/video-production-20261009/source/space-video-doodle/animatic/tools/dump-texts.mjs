// Dumps every visible text run of a scene with the font role it is set in -> JSON for tools/glyphcheck.py
import { chromium } from '/tmp/space-video-prep/tools/node_modules/playwright-core/index.mjs';
import fs from 'node:fs';
const scene = process.argv[2] || 'animatic', out = process.argv[3];
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
await page.goto(`http://127.0.0.1:47930/stage.html?scene=${scene}`); await page.evaluate(() => window.__ready);
const res = await page.evaluate(() => {
  for (const sh of DM.shots) sh.el.style.display = 'block';
  const ROLE = f => /Display/.test(f) ? 'display' : /Marker/.test(f) ? 'marker' : /Hand/.test(f) ? 'hand' : /Note/.test(f) ? 'note' : /Logo/.test(f) ? 'logo' : /Digits/.test(f) ? 'digits' : 'OTHER:' + f;
  const out = {}; const w = document.createTreeWalker(document.getElementById('stage'), NodeFilter.SHOW_TEXT);
  while (w.nextNode()) { const n = w.currentNode; const t = n.data.trim(); if (!t) continue; const fam = getComputedStyle(n.parentElement).fontFamily.split(',')[0].replace(/"/g, '').trim();
    const r = ROLE(fam); (out[r] = out[r] || new Set()).add(t); }
  return Object.fromEntries(Object.entries(out).map(([k, v]) => [k, [...v]]));
});
fs.writeFileSync(out, JSON.stringify(res, null, 1)); console.log(Object.entries(res).map(([k, v]) => k + ':' + v.length).join(' '));
await browser.close();
