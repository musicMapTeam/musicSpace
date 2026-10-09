// screen y of the rows of whichever product screen is on the phone (badge view / compose / pending / accepted) at many positions
(() => {
  const SCR = {
    badge: { panelEyebrow: [262, 292], panelTitle: [330, 400], time: [455, 560], viewpoints: [610, 680], note: [715, 760], pill: [880, 1038], reason1: [1077, 1124], reason2: [1160, 1204], offer: [1256, 1423], photoTop: [1450, 1460], nav: [2000, 2216], footer: [2254, 2306] },
    compose: { header: [45, 200], line: [318, 361], pair: [410, 1043], capt: [889, 989], label: [1110, 1145], select: [1185, 1388], reasonPill: [1430, 1510], reasonTxt: [1538, 1650], dash: [1760, 1775], consent: [1844, 1914], send: [1983, 2142] },
    pending: { header: [45, 200], status: [303, 409], name: [470, 520], pair: [550, 1187], capt: [1030, 1130], youxiao: [1247, 1278], waitLine: [1349, 1387], recall: [1481, 1613], shuaxin: [1710, 1760] },
    accepted: { header: [45, 200], sticker: [282, 532], name: [568, 622], pair: [665, 1316], capt: [1150, 1262], line: [1380, 1419], button: [1509, 1640], shuaxin: [1738, 1790] },
  };
  const which = pos => { const b = pos.split(':'); const v = parseFloat(b[0]) + (parseFloat(b[1]) - 1) / 4;
    return v < 45 ? 'badge' : v < 47.5 ? 'compose' : v < 51 ? 'pending' : 'accepted'; };
  const out = {};
  const poss = ['43:1.1', '44:2', '44:4.9', '45:1.6', '45:2.5', '45:3.5', '46:1.9', '46:3.5', '47:1.5', '47:2.5', '47:3.6', '48:1.5', '48:3.5', '49:3', '50:3.9', '50:4.3'];
  for (const pos of poss) {
    const t = DM.Tc(pos);
    const sh = DM.shots.find(s => s.active(t) && s.nodes.some(n => n.label === 'phone exchange'));
    if (!sh) { out[pos] = 'no phone'; continue; }
    const ph = sh.nodes.find(n => n.label === 'phone exchange');
    const w = which(pos); const r = [];
    for (const [k, [y0, y1]] of Object.entries(SCR[w])) {
      const a = sh.toScreen(t, ...ph.toWorld(t, 540, y0)), b = sh.toScreen(t, ...ph.toWorld(t, 540, y1));
      const y0s = Math.round(a[1]), y1s = Math.round(b[1]); const cut = (y0s < 0 && y1s > 0) || (y0s < 1080 && y1s > 1080);
      r.push(`${cut ? '**' : ''}${k} ${y0s}..${y1s}${cut ? '**' : ''}`);
    }
    out[pos] = w + ': ' + r.join(' | ');
  }
  return out;
})()
