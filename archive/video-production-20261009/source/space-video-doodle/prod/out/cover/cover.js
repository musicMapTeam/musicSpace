/* Music Space · cover (form field 07, 16:9) — the title card look of the film, built with the film's own doodle-motion kit.
 * Concept: script/FORM-DRAFT.md §2 (paper + dots, MUSIC SPACE wordmark, 「同一刻，」「另一面。」 with the mint highlighter, the
 * subtitle, three sticker chips, the real 3D room as a taped polaroid, the real wall panel with 「同一刻的另一面」 in a hand-drawn
 * phone, 「就是这一刻！」 pointing at it, a few doodles; v2: no disclosure line, owner 2026-10-07).  Everything on screen is the product's own:
 * v3 (2026-10-08): both product pictures are the 0.22.0-rc.2 re-capture (the owner's 10-07 copy revision: no 「·示例」 tags, no footer
 * 「示例站 · …」, no pipeline ribbon or rule line on the wall); v2's rc.1 pictures are kept in out/work/v3/cover.v2-backup.js's sources.
 *   room polaroid  = capture/P2P3-rc2/stills/CUT-01_room-overview-4k.png cropped to the stage -> out/cover/room-crop-rc2.png
 *                    (provenance.json there): the five with their rc.2 tags 阿遥 / 小满 / 北屿 · 可招呼, 阿宁 · 我, 林间 · 安静, 照片墙
 *   phone screen   = capture/P1-rc2/stills/CUT-05-wall-top-full.png (by path: capture/P1 holds the rc.1 still under the same id) — the
 *                    wall panel: 21:47 同一刻 · 3 个视角 · 「3 分钟内拍下」, the badge 「同一刻的另一面」, 和 TA 交换这个视角, 关于 Music Space
 *   chip wording   = the product's / the film's own lines (AI 在本机判断 · 规则配同一刻 (FORM-DRAFT; the film's T063-T066) · 双方同意，才交换);
 *                    no TME logo, no real person.
 * Static: every element is on from t = 0 (render any frame after 0.5 s).  Load: stage.html?map=flipping-in&scene=../out/cover/cover
 *   node out/tools/cover-render.mjs ../out/cover/cover out/cover-3840x2160.png 1.0   (then the 1920 / 1280 sizes with PIL, Lanczos)
 */
(() => {
  const sh = DM.shot('COVER', 0, 30, { drift: null });
  const at = 0;

  // ---- right: the real 3D livehouse (taped polaroid) + the real wall panel in a hand-drawn phone
  const room = DM.polaroid(sh, { src: '/out/cover/room-crop-rc2.png', w: 830, hgt: 482, cap: '回声现场', capSize: 36, x: 1418, y: 292, r: 2.2, z: 4,
    tape: 'y', tapeX: 0.3, tapeW: 210, label: 'room' }).show(at);
  DM.tape(sh, { parent: room, color: 'p', x: 760, y: 10, r: 9, w: 160 }).show(at);
  const ph = DM.phone(sh, { media: 'capture/P1-rc2/stills/CUT-05-wall-top-full.png', x: 1716, y: 722, w: 300, r: -4, shadow: 'pink', z: 8, label: 'phone wall' }).show(at);

  // ---- left: wordmark, title, subtitle, chips
  DM.logo(sh, { x: 112, y: 112, ax: 0, size: 104, r: -3, z: 20 }).show(at);
  DM.title(sh, { text: '同一刻，', recipe: 'ink-pink', size: 236, x: 104, y: 320, at, fx: 'NONE', z: 20 });
  DM.title(sh, { text: '【另一面。】', recipe: 'hl-mint', size: 236, x: 104, y: 586, at, fx: 'NONE', hlDur: 0.001, z: 20 });
  DM.text(sh, { text: '和同场的人，【交换】彼此的视角。', size: 58, x: 112, y: 776, at, fx: 'NONE', z: 20 });
  const chips = [['AI 在本机判断', 'mint', 112], ['规则配同一刻', 'yellow', 432], ['双方同意，才交换', 'pink-soft', 742]];
  chips.forEach(([t, c, x], i) => DM.chip(sh, { text: t, color: c === 'pink-soft' ? '' : c, size: 40, x, y: 880, ax: 0, r: [-1.5, 1, -1][i], z: 22,
    style: c === 'pink-soft' ? { background: 'var(--pink-soft)' } : {} }).show(at));

  // ---- the handwritten note pointing at the badge on the phone screen
  DM.note(sh, { text: '就是这一刻！', size: 66, x: 1062, y: 700, at, fx: 'NONE', r: -6, z: 24 });
  // the badge pill 「同一刻的另一面」 sits at source px (117-527, 941-1061) of the 1080 x 2340 rc.2 capture (v2 / rc.1: 117-533, 1243-1339;
  // rc.2 dropped the pipeline ribbon and the rule line above it)
  const badge = () => { const [x, y] = ph.toWorld(1, 100, 1001); return [x - 14, y + 6]; };
  DM.arrow(sh, { from: [1452, 676], to: badge, bend: 0.3, head: 30, at, dur: 0.001, color: 'pink', width: 9, z: 25, label: 'arrow to the badge' });

  // ---- doodles (max 2-3 per area)
  DM.deco(sh, { kind: 'star', color: 'yellow', size: 92, x: 930, y: 112, r: -10, z: 26 }).show(at);
  DM.deco(sh, { kind: 'heart', color: 'pink', size: 66, x: 1866, y: 128, r: 10, z: 26 }).show(at);
  DM.deco(sh, { kind: 'sparkle', color: 'pink', size: 58, x: 880, y: 600, z: 26 }).show(at);
  DM.deco(sh, { kind: 'plus', color: 'mint', size: 50, x: 1290, y: 860, z: 26 }).show(at);

  // (v2, owner 2026-10-07 「去掉那些说明性文字，这个产品必须是完整的」: v1's disclosure line 「照片为 AI 生成的示例图 · 示例角色为虚构 ·
  // 界面为产品实际截图」 and the caption's 「· 示例场（虚构）」 are gone; the film's end card carries the one credits line)
})();
