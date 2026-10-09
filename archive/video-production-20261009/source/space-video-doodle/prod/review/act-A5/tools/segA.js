  // ======================================================================= SEG A · S1 + S2 · 55:1 -> 59:1 (L1, one phone, screen swap on 57:1)
  {
    const P12 = DM.clip('P-12'), P13 = DM.clip('P-13');
    const sh = DM.shot('A5-S1S2-friends-chat', '55:1', '59:1', { drift: { s: 1.03, x: -6, y: 0 } });
    const ty = DM.shot('A5-S1S2-type', '55:1', '59:1', { paper: false, z: 30, drift: null, log: false });
    sh.pulse(['55:1', '57:1'], 0.016, 0.12);
    sh.pulse(['55:3', '56:1', '56:3', '57:3', '58:1', '58:3'], 0.006, 0.1);
    const media = DM.seq(
      feed(P12, '55:1', '55:3', 199),                                   // S1: greet click (f199) on 55:3, toast right after
      '56:1', feed(P12, '56:1', '56:1', 376),                           // page flip over the real ~3 s wait -> 「你们已经认识了」, ♡ 2 at f391 (56:1.5)
      '57:1', DM.ramp(P13, [['57:1', f2s(67)], ['57:3', f2s(154), E.lin], ['58:1', f2s(271), E.lin], ['58:3', srcAfter(271, '58:1', '58:3'), E.lin]]),
      '58:3', feed(P13, '58:3', '58:3', 520));                          // S2: open 57:1 (f67: the sheet has landed), composer tap ~57:2.75, typing 2x (32nds) 57:3, send 58:1, reply 58:3
    // S2 keeps the whole chat in frame (s <= 1.1: the bubbles run edge to edge, any tighter crop cuts them); the die-cuts carry the words
    const ph = DM.phone(sh, { media, x: L1.x, y: L1.y, r: L1.r, shadow: 'pink', z: 10, label: 'phone S1/S2',
      view: [['55:1', { s: 1.0 }], ['55:2.6', { s: 1.0 }], ['55:3', { s: 1.3, x: 490, y: 1470 }, E.outC], ['55:4.8', { s: 1.32, x: 490, y: 1470 }],
        ['56:1', { s: 1.0, x: 540, y: 1170 }, E.step], ['56:2', { s: 1.0, x: 540, y: 1170 }], ['56:2.5', { s: 1.25, x: 470, y: 1370 }, E.outC], ['56:4.9', { s: 1.28, x: 470, y: 1370 }],
        ['57:1', { s: 1.0, x: 540, y: 1170 }, E.step], ['57:2.75', { s: 1.03, x: 540, y: 1170 }], ['57:3', { s: 1.08, x: 540, y: 1260 }, E.outC],
        ['58:1', { s: 1.08, x: 540, y: 1260 }], ['59:1', { s: 1.1, x: 540, y: 1220 }, E.ioSine]] });
    ph.in('slap', '55:1', { big: 1.06, spin: -4, dy: -20, sfx: 'none', log: false });
    ph.pulse(['57:1'], 0.035, 0.1);
    ph.pulse(['58:1', '58:3'], 0.02, 0.1);
    flipX(ph, '56:1');
    DM.ev('56:1', 'flip', 'page flip over the greet wait', { sfx: 'flip', gain: -2 });
    DM.ev('57:1', 'cut', 'S2 screen swap: chat opens', { sfx: 'none' });
    backing(sh, L1, '55:1', '57:1', 'yellow', 0);
    backing(sh, L1, '57:1', '59:1', 'mint', 1);
    // taps that are in the footage (the rig's tap ring): sounds + events on their beats
    DM.ev('55:3', 'tap', 'tap 向 小满·示例 招个手');
    circleOn(ph, { x: 540, y: 1588, rx: 510, ry: 96, at: '55:2', dur: beat * 0.6, erase: '55:3', color: 'pink', width: 8, label: 'circle the greet button' });
    DM.deco(sh, { parent: ph.screen, kind: 'sparkle', color: 'pink', size: 44, x: 708 * 0.4, y: 40 * 0.4, z: 5 }).in('pop', '56:1.5', { gain: -8, label: '♡ 2 sparkle' }).out('pop', '57:1');
    DM.ev('57:2.75', 'tap', 'tap the composer', { gain: -6 });
    DM.ev('57:3', 'type', 'typing 返场那首我在人海里，手都举酸了！', { dur: Tc('58:1') - Tc('57:3'), note: 16, gain: -2 });
    DM.ev('58:1', 'tap', 'send', { sfx: 'blip', gain: 0 });
    DM.ev('58:3', 'cut', 'reply lands (wait cut)', { sfx: 'blip', gain: 0, note: 5 });
    // S1: the two new friends, 阿宁 (you) and 小满·示例 (the product's own avatars), at the foot of the type column; a heart on 56:3
    const you = DM.sticker(sh, { src: 'visitor-aning-shizhen-front', w: 128, x: 1250, y: 1012, ay: 1, z: 6, r: -2, label: 'avatar 阿宁' }).in('pop', '55:2', { gain: -9, note: 2 });
    const man = DM.sticker(sh, { src: 'cast-man-front', w: 128, x: 1600, y: 1012, ay: 1, z: 6, r: 2, label: 'avatar 小满·示例' }).in('pop', '55:2.5', { gain: -9, note: 4 });
    you.bob('56:3', '57:1', 14, beat / 2); man.bob('56:3', '57:1', 14, beat / 2);
    you.out('pop', '57:1'); man.out('pop', '57:1');
    DM.deco(sh, { kind: 'heart', color: 'pink', size: 132, x: 1425, y: 860, z: 9, r: -6, lw: 1.1 }).in('spring', '56:3', { sfx: 'boop', gain: -2, label: 'big heart' }).out('pop', '57:1');
    DM.pops(sh, [['heart', 'yellow', 1330, 760, 54, 10], ['sparkle', 'mint', 1520, 760, 50]], '56:3.5', beat / 2, { z: 9, gain: -10 }).forEach(n => n.out('pop', '57:1'));
    // S2: the real bubbles pop out of the phone onto the paper (die-cuts of CUT-07, a still of this take): yours on the send (58:1),
    // the example character's reply on the jump cut (58:3); they fly from where the product draws them (P-13 source px)
    const mine = dieCrop(sh, { src: 'CUT-07', crop: [219, 598, 818, 176], w: 700, x: 1440, y: 566, r: -2, z: 14, label: 'die-cut 返场那首我在人海里，手都举酸了！' });
    popOut(mine, ph, '58:1', 635, 1005, { r0: -8 });
    mine.wiggle('58:4', '59:1', 2, 3);
    const reply = dieCrop(sh, { src: 'CUT-07', crop: [31, 844, 552, 180], w: 480, x: 1110, y: 786, r: 2, z: 15, label: 'die-cut 今晚的返场太好听了。' });
    popOut(reply, ph, '58:3', 312, 1252, { r0: 6 });
    DM.ev('58:4', 'pop', 'bubbles wiggle', { sfx: 'none' });
    // type (right column); T094 waits at the foot of the column and ends up captioning the reply
    say(ty, 'T090', { x: COLR, y: 200 });
    say(ty, 'T091', { x: COLR, y: 470 });
    say(ty, 'T092', { x: COLR, y: 218 });
    say(ty, 'T093', { x: COLR, y: 405 });
    say(ty, 'T094', { x: 1172, y: 950, r: -3, z: 25 });
  }

