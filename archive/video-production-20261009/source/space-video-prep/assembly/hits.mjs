#!/usr/bin/env node
// hits.mjs : retime the two "moment" cues of the original score (AI chime, consent swell) to where they really happen in the FINAL footage.
// usage:  node hits.mjs timeline.v2.json hits.json > ../music/score-config.final.json
//   hits.json = { "A2a": { "ai_chime": 2.6 }, "M2": { "consent_swell": 9.4 } }   (seconds inside the RAW clip where the chip / 「交换已接受」 appears)
// Output = score config (bars are 1-based, fractional allowed for these two cues).  Then:
//   SCORE_CONFIG=music/score-config.final.json SCORE_OUT=music/original-v2-final python3 music/gen_original_v2.py   (8 s)  and normalise (see MUSIC.md)
import fs from 'node:fs';
const [tlFile, hitsFile, baseCfg = new URL('../music/score-config.json', import.meta.url).pathname] = process.argv.slice(2);
const tl = JSON.parse(fs.readFileSync(tlFile, 'utf8')), hits = JSON.parse(fs.readFileSync(hitsFile, 'utf8')), cfg = JSON.parse(fs.readFileSync(baseCfg, 'utf8'));
let t = 0; const start = {}, shot = {};
for (const s of tl.shots) { start[s.id] = t; shot[s.id] = s; t += s.dur; }
const BAR = 2.5; cfg.cues = { ...cfg.cues };
for (const [id, cues] of Object.entries(hits)) for (const [name, raw] of Object.entries(cues)) {
  const s = shot[id]; if (!s) { console.error('unknown shot', id); process.exit(1); }
  const T = start[id] + (raw - (s.in || 0)) / (s.speed || 1);
  cfg.cues[name] = +(T / BAR + 1).toFixed(3);
  console.error(`${id}.${name}: raw ${raw}s -> programme ${T.toFixed(2)} s -> bar ${cfg.cues[name]}`);
}
console.log(JSON.stringify(cfg, null, 1));
