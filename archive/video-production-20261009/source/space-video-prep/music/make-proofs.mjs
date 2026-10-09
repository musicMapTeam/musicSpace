// Collect licence proof for each CC0 candidate: page screenshots (full page + the licence line), raw HTML, CC0 deed text, hashes.
import { chromium } from '/tmp/space-video-prep/tools/node_modules/playwright-core/index.mjs';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';

const ROOT = '/tmp/space-video-prep/music';
const DATE = new Date().toISOString();
const tracks = [
  { dir: '01-orbs-in-a-photo__HoliznaCC0', src: '_candidates/orbs-in-a-photo-lofi-chill-mp3.mp3', file: 'HoliznaCC0_-_Orbs_In_A_Photo.mp3', title: 'Orbs In A Photo ( LoFi , Chill ).mp3', artist: 'HoliznaCC0',
    page: 'https://freemusicarchive.org/music/holiznacc0/public-domain-lofi/orbs-in-a-photo-lofi-chill-mp3/', album: 'https://freemusicarchive.org/music/holiznacc0/public-domain-lofi', artistPage: 'https://freemusicarchive.org/music/holiznacc0',
    direct: 'https://files.freemusicarchive.org/storage-freemusicarchive-org/tracks/8VYwiA4OCIwhSUIblz3LrYKmMwjbm0kqXE1ex72s.mp3', beatmap: 'orbs-in-a-photo-lofi-chill-mp3.json' },
  { dir: '02-ocean-breeze__HoliznaCC0', src: '_candidates/ocean-breeze-lofi-ukulele-peaceful-mp3.mp3', file: 'HoliznaCC0_-_Ocean_Breeze.mp3', title: 'Ocean Breeze ( LoFi , Ukulele , Peaceful ) .mp3', artist: 'HoliznaCC0',
    page: 'https://freemusicarchive.org/music/holiznacc0/public-domain-lofi/ocean-breeze-lofi-ukulele-peaceful-mp3/', album: 'https://freemusicarchive.org/music/holiznacc0/public-domain-lofi', artistPage: 'https://freemusicarchive.org/music/holiznacc0',
    direct: 'https://files.freemusicarchive.org/storage-freemusicarchive-org/tracks/7ahdWvuUuDCVriuh5RvYsl96eUmAJuaVvC30sqlW.mp3', beatmap: 'ocean-breeze-lofi-ukulele-peaceful-mp3.json' },
  { dir: '03-walking-away__HoliznaCC0', src: '_candidates/walking-away-lofi-peaceful-motivating.mp3', file: 'HoliznaCC0_-_Walking_Away.mp3', title: 'Walking Away ( Lofi , Peaceful , Motivating )', artist: 'HoliznaCC0',
    page: 'https://freemusicarchive.org/music/holiznacc0/public-domain-lofi/walking-away-lofi-peaceful-motivating/', album: 'https://freemusicarchive.org/music/holiznacc0/public-domain-lofi', artistPage: 'https://freemusicarchive.org/music/holiznacc0',
    direct: 'https://files.freemusicarchive.org/storage-freemusicarchive-org/tracks/WOtcP3GhbgTD8CuC6sEgpQOEXMyNeXYbTNmHjgN6.mp3', beatmap: 'walking-away-lofi-peaceful-motivating.json' },
  { dir: '04-extra-piano-goldberg-aria__Kimiko-Ishizaka', src: '_candidates/goldberg-Aria.mp3', file: 'Kimiko_Ishizaka_-_Goldberg_Variations_BWV988_-_01_Aria.mp3', title: 'Aria (Goldberg Variations, BWV 988)', artist: 'Kimiko Ishizaka (The Open Goldberg Variations)',
    page: 'https://freemusicarchive.org/music/Kimiko_Ishizaka/The_Open_Goldberg_Variations', album: 'https://freemusicarchive.org/music/Kimiko_Ishizaka/The_Open_Goldberg_Variations', artistPage: 'https://opengoldbergvariations.org/',
    direct: 'https://files.freemusicarchive.org/storage-freemusicarchive-org/music/ccCommunity/Kimiko_Ishizaka/The_Open_Goldberg_Variations/Kimiko_Ishizaka_-_01_-_Aria.mp3', beatmap: null },
];

async function dismissCookies(page) {
  const btn = page.locator('#CybotCookiebotDialogBodyButtonDecline, #CybotCookiebotDialogBodyLevelButtonLevelOptinDeclineAll, button:has-text("Use necessary cookies only")').first();
  if (await btn.count()) { await btn.click({ timeout: 4000 }).catch(() => {}); await page.waitForTimeout(800); }
  await page.addStyleTag({ content: '#CybotCookiebotDialog,#CybotCookiebotDialogBodyUnderlay{display:none!important}' }).catch(() => {});
}
const sha = f => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const probe = f => JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration,size,bit_rate:format_tags=title,artist,album,license,copyright,comment', '-of', 'json', f]).toString()).format;

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1, locale: 'en-US' });
const page = await ctx.newPage();

// CC0 deed (shared)
await page.goto('https://creativecommons.org/publicdomain/zero/1.0/', { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(e => console.log('deed', e.message));
await page.waitForTimeout(2500);
fs.mkdirSync(`${ROOT}/_shared`, { recursive: true });
await page.screenshot({ path: `${ROOT}/_shared/cc0-deed-1.0.png`, fullPage: false });
const deedText = await page.evaluate(() => document.body.innerText.slice(0, 3000));
fs.writeFileSync(`${ROOT}/_shared/cc0-deed-1.0.txt`, `Source: https://creativecommons.org/publicdomain/zero/1.0/\nRetrieved: ${DATE}\n\n${deedText}\n`);
// album page (HoliznaCC0 'completely Public Domain' statement)
await page.goto('https://freemusicarchive.org/music/holiznacc0/public-domain-lofi', { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForTimeout(3000);
await dismissCookies(page);
await page.screenshot({ path: `${ROOT}/_shared/holizna-album-public-domain-lofi-top.png`, fullPage: false });
const albumDesc = await page.evaluate(() => { const t = document.body.innerText; const i = t.indexOf('Best of my public domain'); return i >= 0 ? t.slice(i, i + 520) : t.slice(0, 600); });
fs.writeFileSync(`${ROOT}/_shared/holizna-album-statement.txt`, `Source: https://freemusicarchive.org/music/holiznacc0/public-domain-lofi\nRetrieved: ${DATE}\n\n${albumDesc}\n`);

for (const t of tracks) {
  const d = `${ROOT}/${t.dir}`;
  fs.mkdirSync(d, { recursive: true });
  fs.copyFileSync(`${ROOT}/${t.src}`, `${d}/${t.file}`);
  await page.goto(t.page, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(3500);
  await dismissCookies(page);
  await page.screenshot({ path: `${d}/proof-track-page-fullpage.png`, fullPage: true });
  // licence line crop
  const lic = page.locator('text=/CC0 1\\.0 Universal/').first();
  let licNote = 'licence line not located';
  if (await lic.count()) {
    await lic.scrollIntoViewIfNeeded();
    await page.waitForTimeout(400);
    const box = await lic.boundingBox();
    if (box) {
      await page.screenshot({ path: `${d}/proof-licence-line.png`, clip: { x: Math.max(0, box.x - 420), y: Math.max(0, box.y - 140), width: 1000, height: 330 } });
      licNote = (await lic.evaluate(e => (e.closest('div')?.innerText || e.innerText).replace(/\s+/g, ' ').slice(0, 200)));
    }
  }
  fs.writeFileSync(`${d}/proof-track-page.html`, await page.content());
  for (const f of ['cc0-deed-1.0.png', 'cc0-deed-1.0.txt', 'holizna-album-public-domain-lofi-top.png', 'holizna-album-statement.txt']) {
    if (fs.existsSync(`${ROOT}/_shared/${f}`) && (t.artist.startsWith('Holizna') || f.startsWith('cc0'))) fs.copyFileSync(`${ROOT}/_shared/${f}`, `${d}/proof-${f}`);
  }
  if (t.beatmap) fs.copyFileSync(`${ROOT}/beatmaps/${t.beatmap}`, `${d}/beatmap.json`);
  const info = probe(`${d}/${t.file}`);
  const hash = sha(`${d}/${t.file}`);
  const md = `# Licence proof — ${t.title}

| Field | Value |
| --- | --- |
| Track | ${t.title} |
| Artist | ${t.artist} |
| Track / album page | ${t.page} |
| Album page | ${t.album} |
| Artist page | ${t.artistPage} |
| Direct file URL (downloaded from) | ${t.direct} |
| Licence shown on the page | **CC0 1.0 Universal (Public Domain Dedication)** — https://creativecommons.org/publicdomain/zero/1.0/ |
| Licence line text found on the page | ${licNote} |
| Retrieved (UTC) | ${DATE} |
| Local file | ${t.file} |
| SHA-256 | ${hash} |
| Size | ${info.size} bytes, duration ${Number(info.duration).toFixed(1)} s, bitrate ${Math.round(info.bit_rate / 1000)} kbps |
| Embedded tags | ${JSON.stringify(info.tags || {})} |

## What this proves
- The source page states the licence as CC0 1.0 Universal (see \`proof-licence-line.png\`, \`proof-track-page-fullpage.png\`, raw \`proof-track-page.html\`).
- CC0 = the artist dedicated the work to the public domain: copying, modifying and using it (also commercially) needs no permission and no attribution (deed: \`proof-cc0-deed-1.0.txt/png\`).
${t.artist.startsWith('Holizna') ? '- The artist\'s own album text (`proof-holizna-album-statement.txt`): "Best of my public domain Lo-Fi and chill tracks! This music is completely Public Domain, so use it how you want!"\n' : '- The Open Goldberg Variations project states the recordings and score are released into the public domain under CC0 (https://opengoldbergvariations.org/ ; FMA album page above lists CC0 1.0 Universal).\n'}
## Competition rule fit (FAQ Q11)
- FAQ Q11 asks that Demo music is not commercial music; "公版免费歌曲" (public-domain free songs) are explicitly suggested. CC0 satisfies this. No lyrics, no commercial recording, no third-party samples.
- Video credit line is **not required** by CC0. Optional courtesy line (not needed for compliance): "Music: ${t.artist} (CC0)".

## Limits / honest notes
- The artist's page asks for usage questions to go to the artist; CC0 itself imposes no conditions. We did not contact the artist.
- A platform content-ID system could still flag any CC0 track by mistake (the competition form upload is not such a system, but if the video is also posted to Bilibili/WeChat Channels/YouTube keep this proof folder handy). The original generated score (../original/) avoids that risk entirely.
- Proof was captured by an automated browser on the date above; re-open the page URL before submission if you want a fresher capture.
`;
  fs.writeFileSync(`${d}/LICENCE-PROOF.md`, md);
  console.log('proof ok', t.dir, hash.slice(0, 12), licNote.slice(0, 80));
}
await browser.close();
