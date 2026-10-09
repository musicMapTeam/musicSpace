/* test of the end-card path (QR decode in QC, link pill, script lines T140-T146): not part of the film */
(() => {
  const sh = DM.shot('T-end', '83:1', '91:1', { drift: { s: 1.02 } });
  DM.say(sh, 'T140', { x: 110, y: 330 });
  DM.say(sh, 'T141', { x: 110, y: 600 });
  DM.say(sh, 'T142', { x: 110, y: 112, ax: 0, size: 112 });
  DM.say(sh, 'T143', { x: 1440, y: 150, ax: 0.5, size: 52 });
  DM.say(sh, 'T144', { x: 1440, y: 240, ax: 0.5 });
  const card = DM.card(sh, { w: 470, hgt: 470, x: 1440, y: 590, r: -2, pad: '30px', html: `<img src="${DM.asset('qr')}" style="width:404px;height:404px;display:block;image-rendering:pixelated">` });
  card.in('slap', '85:1', { big: 1.12, spin: 3 });
  DM.tape(sh, { x: 1240, y: 360, r: -32, w: 160 }).show('85:1'); DM.tape(sh, { x: 1650, y: 350, r: 28, color: 'p', w: 160 }).show('85:1');
  DM.say(sh, 'T145', { x: 110, y: 975, size: 30 });
  DM.say(sh, 'T146', { x: 110, y: 1010, size: 30, text: DM.map().track.credit });
  DM.mark('qr', '86:1');
})();
