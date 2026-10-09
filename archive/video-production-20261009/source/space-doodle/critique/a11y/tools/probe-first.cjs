const L = require('./lib.cjs');
setTimeout(() => { console.error('watchdog'); process.exit(2); }, 200000).unref();
(async () => {
  const vp = process.argv[2] || 'w390';
  const b = await L.launch();
  try {
    const { page } = await L.open(b, vp);
    const res = await L.scanState(page, vp, 'probe-first', { noScroll: true });
    const d = res[0];
    console.log('text items', d.text.length, 'targets', d.targets.length, 'pseudo', d.pseudo.length);
    console.log(JSON.stringify(d.overflow).slice(0, 1500));
    for (const t of d.text.slice(0, 80)) console.log(t.sel.slice(-60).padEnd(60), JSON.stringify(t.text).slice(0, 26).padEnd(28), t.fontSize, t.family, 'dom', t.domContrast, 'px', t.px && t.px.p10, t.px && t.px.bgMedian, 'vis', t.visibleFrac, t.occluders.join('|').slice(0, 50));
    console.log('--- targets');
    for (const t of d.targets) console.log(t.sel.slice(-60).padEnd(60), JSON.stringify(t.text).slice(0, 20).padEnd(22), t.w + 'x' + t.h, 'hit', t.hitW + 'x' + t.hitH, t.centreHit ? '' : 'COVERED ' + t.covering);
  } finally { await b.close(); }
})();
