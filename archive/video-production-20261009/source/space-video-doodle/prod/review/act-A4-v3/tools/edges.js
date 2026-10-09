// evaluated in the stage page (render.mjs --at X --eval "$(cat edges.js)"): screen y (and x range) of the accepted / pending /
// compose UI rows through each phone, at a list of storyboard positions
(() => {
  const rows = { header: [45, 200], rule: [228, 252], sticker: [282, 532], name: [568, 622], pairTop: [665, 700], captions: [1150, 1262], pairBot: [1300, 1320],
    line: [1380, 1419], button: [1509, 1640], shuaxin: [1738, 1790], waitLine: [1349, 1387], youxiao: [1247, 1278], recall: [1481, 1613],
    select: [1185, 1388], reasonTxt: [1538, 1650], consent: [1844, 1914], send: [1983, 2142], title: [121, 196] };
  const out = {};
  const poss = ['51:1.1', '51:2.9', '51:3.5', '52:4', '53:1.6', '53:2.9', '53:3.1', '53:3.5', '53:4.9', '54:1.05'];
  for (const pos of poss) {
    const t = DM.Tc(pos);
    const sh = DM.shots.find(s => s.active(t) && s.nodes.some(n => n.label === 'phone exchange'));
    if (!sh) { out[pos] = 'no phone'; continue; }
    const ph = sh.nodes.find(n => n.label === 'phone exchange');
    const r = {};
    for (const [k, [y0, y1]] of Object.entries(rows)) {
      const a = sh.toScreen(t, ...ph.toWorld(t, 540, y0)), b = sh.toScreen(t, ...ph.toWorld(t, 540, y1));
      r[k] = [Math.round(a[1]), Math.round(b[1])];
    }
    out[pos] = sh.id + ' ' + Object.entries(r).map(([k, v]) => `${k} ${v[0]}..${v[1]}`).join(' | ');
  }
  return out;
})()
