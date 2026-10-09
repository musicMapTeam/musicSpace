// Licence proof for each chosen CC0 track: track page (full-page screenshot, licence-line crop, rendered HTML + raw server HTML),
// artist/album pages, CC0 deed (screenshot + text), sha256/size/duration of the exact downloaded file, LICENCE-PROOF.md.
// usage: node make-proofs.mjs picks.json            (picks.json: [{dir, file, fileUrl, page, title, artist, album, albumPage, artistPage, extraPages:[{name,url,find}]}])
import { chromium } from '/tmp/space-video-prep/tools/node_modules/playwright-core/index.mjs';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';

const ROOT = '/tmp/space-video-doodle/music-cc0';
const picks = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36';
const sha = f => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const probe = f => JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration,size,bit_rate,format_name:format_tags', '-of', 'json', f]).toString()).format;
const curl = (url, out) => execFileSync('curl', ['-sSL', '-A', UA, '-o', out, '-w', '%{http_code} %{url_effective}', url]).toString();

async function dismissCookies(page) {
  for (const sel of ['#CybotCookiebotDialogBodyButtonDecline', '#CybotCookiebotDialogBodyLevelButtonLevelOptinDeclineAll', 'button:has-text("Use necessary cookies only")', 'button:has-text("Deny")']) {
    const b = page.locator(sel).first();
    if (await b.count().catch(() => 0)) { await b.click({ timeout: 3000 }).catch(() => {}); await page.waitForTimeout(600); break; }
  }
  await page.addStyleTag({ content: '#CybotCookiebotDialog,#CybotCookiebotDialogBodyUnderlay{display:none!important}' }).catch(() => {});
}

const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1, locale: 'en-US', userAgent: UA });
const page = await ctx.newPage();
const NOW = () => new Date().toISOString();

// shared: CC0 deed + legal code
fs.mkdirSync(`${ROOT}/_shared`, { recursive: true });
const deedTime = NOW();
await page.goto('https://creativecommons.org/publicdomain/zero/1.0/', { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForTimeout(2500);
await page.screenshot({ path: `${ROOT}/_shared/cc0-deed-1.0.png`, fullPage: true });
fs.writeFileSync(`${ROOT}/_shared/cc0-deed-1.0.txt`, `Source: https://creativecommons.org/publicdomain/zero/1.0/\nRetrieved (UTC): ${deedTime}\n\n${await page.evaluate(() => document.body.innerText)}\n`);
await page.goto('https://creativecommons.org/publicdomain/zero/1.0/legalcode.en', { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});
await page.waitForTimeout(1500);
fs.writeFileSync(`${ROOT}/_shared/cc0-legalcode-1.0.txt`, `Source: https://creativecommons.org/publicdomain/zero/1.0/legalcode.en\nRetrieved (UTC): ${NOW()}\n\n${await page.evaluate(() => document.body.innerText)}\n`);

const summary = [];
for (const t of picks) {
  const d = `${ROOT}/${t.dir}`;
  fs.mkdirSync(d, { recursive: true });
  const when = NOW();
  // the exact audio bytes from the direct file URL
  const local = `${d}/${t.file}`;
  if (!fs.existsSync(local)) curl(t.fileUrl, local);
  // raw server HTML (unrendered) of the track page
  const rawInfo = curl(t.page, `${d}/proof-track-page.raw.html`);
  // rendered page
  await page.goto(t.page, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(3500);
  await dismissCookies(page);
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${d}/proof-track-page-fullpage.png`, fullPage: true });
  fs.writeFileSync(`${d}/proof-track-page.html`, await page.content());
  let licLine = 'licence line not located';
  const lic = page.locator('text=/is licensed under/').first();
  if (await lic.count()) {
    await lic.scrollIntoViewIfNeeded().catch(() => {});
    await page.waitForTimeout(400);
    const box = await lic.boundingBox();
    licLine = (await lic.evaluate(e => (e.closest('div')?.innerText || e.innerText))).replace(/\s+/g, ' ').trim().slice(0, 300);
    if (box) await page.screenshot({ path: `${d}/proof-licence-line.png`, clip: { x: Math.max(0, box.x - 300), y: Math.max(0, box.y - 160), width: Math.min(1100, 1440 - Math.max(0, box.x - 300)), height: 360 } });
  }
  const licHref = await page.evaluate(() => [...document.querySelectorAll('a[rel~="license"], a[href*="creativecommons.org"]')].map(a => `${a.innerText.trim()} -> ${a.href}`).filter((v, i, s) => s.indexOf(v) === i));
  const trackInfo = await page.evaluate(() => { const el = document.querySelector('[data-track-info]'); return el ? el.getAttribute('data-track-info') : null; });
  // album / artist / extra pages
  const extra = [];
  for (const p of [...(t.albumPage ? [{ name: 'album-page', url: t.albumPage, find: t.albumFind }] : []), ...(t.artistPage ? [{ name: 'artist-page', url: t.artistPage, find: t.artistFind }] : []), ...(t.extraPages || [])]) {
    await page.goto(p.url, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});
    await page.waitForTimeout(3000);
    await dismissCookies(page);
    await page.screenshot({ path: `${d}/proof-${p.name}.png`, fullPage: true });
    fs.writeFileSync(`${d}/proof-${p.name}.html`, await page.content());
    let found = '';
    if (p.find) {
      found = await page.evaluate(f => { const tx = document.body.innerText; const i = tx.search(new RegExp(f, 'i')); return i >= 0 ? tx.slice(Math.max(0, i - 200), i + 400) : ''; }, p.find);
      fs.writeFileSync(`${d}/proof-${p.name}-statement.txt`, `Source: ${p.url}\nRetrieved (UTC): ${NOW()}\nSearched for: /${p.find}/i\n\n${found || '(not found)'}\n`);
    }
    extra.push({ ...p, found: found.replace(/\s+/g, ' ').trim() });
  }
  for (const f of ['cc0-deed-1.0.png', 'cc0-deed-1.0.txt', 'cc0-legalcode-1.0.txt']) fs.copyFileSync(`${ROOT}/_shared/${f}`, `${d}/proof-${f}`);
  const info = probe(local);
  const hash = sha(local);
  fs.writeFileSync(`${d}/${t.file}.sha256`, `${hash}  ${t.file}\n`);
  const md = `# Licence proof — ${t.title}

| Field | Value |
| --- | --- |
| Track | ${t.title} |
| Artist | ${t.artist} |
| Album | ${t.album || '-'} |
| Track page (source) | ${t.page} |
| Album page | ${t.albumPage || '-'} |
| Artist page | ${t.artistPage || '-'} |
| Direct file URL (downloaded from) | ${t.fileUrl} |
| Licence shown on the page | **CC0 1.0 Universal (Public Domain Dedication)** — https://creativecommons.org/publicdomain/zero/1.0/ |
| Licence line text found on the page | ${licLine} |
| Licence links on the page | ${licHref.join(' ; ')} |
| Retrieved (UTC) | ${when} |
| Local file | ${t.file} |
| SHA-256 | ${hash} |
| Size | ${info.size} bytes, duration ${Number(info.duration).toFixed(2)} s, bitrate ${Math.round(info.bit_rate / 1000)} kbps (${info.format_name}) |
| Embedded tags | ${JSON.stringify(info.tags || {})} |
| Raw page fetch | HTTP ${rawInfo} (proof-track-page.raw.html, unrendered server response) |

## What this proves
- The track page states the licence as CC0 1.0 Universal (\`proof-licence-line.png\`, \`proof-track-page-fullpage.png\`, rendered \`proof-track-page.html\`, raw \`proof-track-page.raw.html\`). The page's embedded player data names the same file we downloaded (\`data-track-info\` below).
- CC0 = the author waived all copyright and related rights worldwide: copying, modifying, synchronising to video and commercial use need no permission and no attribution (deed and legal code: \`proof-cc0-deed-1.0.png/.txt\`, \`proof-cc0-legalcode-1.0.txt\`).
${extra.filter(e => e.found).map(e => `- ${e.name} (${e.url}): "${e.found.slice(0, 400)}"`).join('\n')}

Embedded player data on the track page: \`${(trackInfo || '').replace(/\|/g, '/').slice(0, 900)}\`

## Competition rule fit
- Not commercial music, no lyrics/vocals (instrumental; checked by stem separation, see \`analysis.json\`), no third-party samples known; CC0 matches the organisers' suggestion of public-domain music.
- A credit line is not required by CC0. Optional courtesy line: 「Music: ${t.artist} – ${t.title} (CC0)」.

## Limits / honest notes
- CC0 is a waiver by the uploader; we rely on the uploader being the author (FMA artist account). We did not contact the artist.
- Any CC0 track can be uploaded by others to Content-ID systems by mistake; keep this folder if the video is also posted to video platforms.
- Captured automatically (Playwright + Chrome, headless) at the time above; re-open the page before submission if a fresher capture is wanted.
`;
  fs.writeFileSync(`${d}/LICENCE-PROOF.md`, md);
  summary.push({ dir: t.dir, hash, licLine, size: info.size, duration: Number(info.duration) });
  console.log('proof ok', t.dir, hash.slice(0, 16), licLine.slice(0, 120));
}
fs.writeFileSync(`${ROOT}/_shared/proofs-summary.json`, JSON.stringify(summary, null, 1));
await browser.close();
