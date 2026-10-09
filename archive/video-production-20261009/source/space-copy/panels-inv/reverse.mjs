import {readFileSync, readdirSync, statSync} from 'node:fs';
import {join} from 'node:path';
const root = '/Users/alakazan/workplace/tme/musicSpace';
const panelFiles = 'moment-upload,moment-wall,moment-model,exchange-panel,exchange-suggest,memory-card,memory-card-view,memory-card-png,recap-view,chat-panel,community-panel,space-management,corner-panel,corner-png,music-games,music-topics,music-card,worldcup-panel,personal-space,moderation-panel,wardrobe,identity-continuity-panel,original-map-entry'.split(',').map(n => `web/event-room/${n}.js`);
const sources = panelFiles.map(f => [f, readFileSync(join(root, f), 'utf8')]);
const app = readFileSync(join(root, 'web/event-room/app.js'), 'utf8');
const walk = dir => readdirSync(dir).flatMap(n => { const p = join(dir, n); return statSync(p).isDirectory() ? walk(p) : [p]; });
const tests = [...walk(join(root,'tests')), ...walk(join(root,'runtime-preview/tests')), ...walk(join(root,'scripts/test'))].filter(f => /\.(m?js)$/.test(f));
const re = /[一-鿿][^'"`/<>\n\\()|\[\]{}$*+?]*[一-鿿。？！]|[一-鿿]{2,}/g;
for (const t of tests) {
  const lines = readFileSync(t, 'utf8').split('\n');
  lines.forEach((line, i) => {
    if (!/assert|includes|match/.test(line)) return;
    for (const m of line.matchAll(re)) {
      const frag = m[0];
      if ([...frag].length < 4) continue;
      const hits = sources.filter(([, c]) => c.includes(frag)).map(([f]) => f.replace('web/event-room/', ''));
      if (hits.length) console.log(`${t.replace(root + '/', '')}:${i + 1}\t${frag}\t${hits.join(',')}${app.includes(frag) ? '\t(+app.js)' : ''}`);
    }
  });
}
