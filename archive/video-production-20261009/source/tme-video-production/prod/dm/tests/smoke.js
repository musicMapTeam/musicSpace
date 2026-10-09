/* smoke test of the dm API (not part of the film): node tools/render.mjs --scene ../dm/tests/smoke --map flipping-in --stills 1:2,1:4,2:3 */
{
  const sh = DM.shot('T1', '1:1', '3:1', { cam: [['1:1', { s: 1 }], ['3:1', { s: 1.05, x: -20 }]] });
  sh.pulse(['1:1', '1:3', '2:1', '2:3'], 0.012);
  DM.burst(sh, { x: 520, y: 380, rOut: 330, rIn: 250, n: 20, color: 'yellow', z: 1 }).in('grow', '1:1', { dur: 0.16 });
  DM.say(sh, 'T010', { x: 130, y: 330, at: '1:1', until: '3:1' });
  DM.say(sh, 'T011', { x: 130, y: 600, at: '1:2', until: '3:1' });
  DM.say(sh, 'T013', { x: 140, y: 860, at: '1:3', until: '3:1' });
  DM.logo(sh, { x: 150, y: 110, ax: 0, size: 96, r: -2, at: '1:2.5' });
  const pol = DM.polaroid(sh, { src: 'photo:crowd', w: 480, hgt: 400, cap: 'TA 拍的 · 人海', tape: 'p', x: 1220, y: 420, r: 4, z: 5 }).in('slap', '1:2');
  DM.sticker(sh, { src: 'avatar:you', w: 120, x: 1500, y: 1040, ay: 1, z: 6 }).in('pop', '1:3').bob('1:3', '3:1', 12);
  DM.stamp(sh, { text: '示例角色 · 自动回复', color: 'mint', size: 50, x: 1250, y: 760, at: '1:4' });
  DM.chip(sh, { text: '示例照片 · 拍摄时间为虚构', size: 34, x: 1250, y: 860, at: '2:1' });
  DM.circle(sh, { x: 1220, y: 400, rx: 280, ry: 230, at: '2:1', color: 'pink' });
  DM.arrow(sh, { from: [900, 900], to: [1080, 640], bend: 0.25, at: '2:2', color: 'pink' });
  DM.pops(sh, [['star', 'yellow', 960, 120, 90], ['heart', 'pink', 1800, 200, 80], ['sparkle', 'mint', 1750, 900, 64]], '2:1', DM.beatS() / 2);
  DM.underline(sh, { x0: 140, x1: 820, y: 920, at: '2:3', wavy: true });
  DM.title(sh, { text: '它就说【不确定】。', recipe: 'ink-dashed', size: 'M', x: 1060, y: 980, at: '2:2' });
  DM.title(sh, { text: '[21:48]', recipe: 'digits', font: 'digits', size: 150, x: 1500, y: 150, at: '2:1', fx: 'POP' });
  DM.pillar(sh, { text: '隐私', color: 'mint', size: 120, x: 700, y: 140, at: '2:3', r: -3 });
}
DM.wipe('W-smoke', '2:4.5', '3:1', { colors: ['pink', 'yellow'] });
{
  const sh = DM.shot('T2', '3:1', '5:1', { enter: { kind: 'slap' } });
  const ph = DM.phone(sh, { media: DM.play(DM.clip('P-01'), { at: '3:1', from: 1.4 }), x: 520, y: 540, r: -2, shadow: 'pink',
    view: [['3:1', { s: 1 }], ['3:3', { s: 1.6, x: 540, y: 1700 }, DM.E.outExpo], ['4:1', { s: 1.6, x: 540, y: 1700 }], ['4:2', { s: 1 }, DM.E.ioC]] });
  ph.in('rise', '3:1', { dur: 0.35 });
  ph.punch('4:3', { s: 1.5, x: 330, y: 900 }, { until: '4:4' });
  DM.circle(sh, { on: ph, x: 540, y: 1700, rx: 300, ry: 120, at: '3:3', color: 'pink' });
  const [ax, ay] = [0, 0];
  DM.say(sh, 'T041', { x: 960, y: 300, at: '3:1' });
  DM.say(sh, 'T042', { x: 960, y: 560, at: '3:3' });
  const dk = DM.desk(sh, { media: 'D-01', w: 760, x: 1450, y: 860, r: 2, z: 3 }).in('slap', '4:1');
  DM.confetti(sh, { at: '4:1', x: 520, y: 400, n: 12, z: 9, id: 'cf-smoke' });
  DM.ripple(sh, { parent: ph, at: '4:2', x: 240, y: 700 });
}
