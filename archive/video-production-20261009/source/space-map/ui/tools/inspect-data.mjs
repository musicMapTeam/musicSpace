import { realArtists, realSongs, realEdges, qqLinkedCount } from '/Users/alakazan/workplace/tme/musicSpace/web/original-map/js/map-catalogue.js';
const names = a => [a.name, ...(a.aliases || [])];
let leaks = 0;
for (const edge of realEdges) {
  const song = realSongs[edge.song];
  const pair = new Set([edge.a, edge.b]);
  const others = realArtists.filter(a => !pair.has(a.id));
  const check = (label, text) => { const hit = others.filter(a => names(a).some(n => n.length > 1 && text?.includes(n))); if (hit.length) { leaks++; console.log('LEAK', edge.song, label, hit.map(a => a.name).join(','), '|', text); } };
  check('evidence', edge.evidence); check('sourceLabel', edge.sourceLabel); check('reason', song.listenReason); check('qqcredit', song.listenLinks[0]?.credit);
  check('recordingLabel', song.recordingLabel); check('versionLabel', song.versionLabel);
  for (const s of song.creditSources) check('creditSource ' + s.id, s.label);
}
console.log('leaks', leaks, 'songs', Object.keys(realSongs).length, 'artists', realArtists.length, 'groups', realArtists.filter(a => a.entity === 'group').length, 'qq', qqLinkedCount);
const dates = new Set(); for (const s of Object.values(realSongs)) { dates.add('song ' + s.checkedAt); s.creditSources.forEach(c => dates.add('src ' + c.checkedAt)); if (s.listenLinks[0]) dates.add('qq ' + s.listenLinks[0].checkedAt); if (s.listenCheckedAt) dates.add('qqx ' + s.listenCheckedAt); }
console.log([...dates].sort().join(' | '));
for (const s of Object.values(realSongs)) if (/[（(]/.test(s.recordingLabel)) console.log('LABEL', s.id, s.recordingLabel);
const counts = Object.values(realSongs).map(s => s.creditSources.length); console.log('sources per song', Math.min(...counts), Math.max(...counts));
console.log('credits max', Math.max(...Object.values(realSongs).map(s => s.credits.length)));
for (const s of Object.values(realSongs)) if (s.listenLinks[0] && !s.listenLinks[0].creditMatches) console.log('QQCREDIT', s.id, s.listenLinks[0].credit);
