#!/usr/bin/env python3
"""Targeted SCRIPT.md edits for act A0-A1 (T001-T033 only), marked 2026-10-08.  Re-runnable: skips edits already applied."""
import re, sys
P = '/tmp/space-video-doodle/script/SCRIPT.md'
s = open(P, encoding='utf-8').read()
E = []   # (old, new, marker-to-detect-done)
E.append(("> (`prod/out/qc-v2.json`), not by `make.sh`.\n",
 "> (`prod/out/qc-v2.json`), not by `make.sh`.\n"
 "> **Changed 2026-10-08 (film v3, act A0–A1 only: T001–T033):** no narration text changed. The hook collage and the H3 match cut now\n"
 ">    show the 0.22.0-rc.2 build (the owner's 2026-10-07 copy revision: cast 阿遥 / 小满 / 北屿 / 林间 without 「·示例」, 「进入现场」,\n"
 ">    「现场进行中」, 「关于 Music Space」); every product string behind T001–T013 and T021/T022 was re-read on rc.2 (§4.1 rows marked\n"
 ">    **2026-10-08**). Timing: T008 lands with its card on 4:3 (review read #10), T031 leaves on 19:2.75 so T033 slams onto an empty line.\n"
 ">    The eight hook stamps have been 70 px opaque labels since v2 (review read #6); their rows now say so.\n",
 "Changed 2026-10-08 (film v3, act A0–A1 only"))
for i, (tid, word, col, beg, t124) in enumerate([
        ('T001', '进场', 'yellow', '1:1', '0:00.00'), ('T002', '换装', 'pink', '1:3', '0:00.97'), ('T003', '上墙', 'mint', '2:1', '0:01.94'),
        ('T004', '视角', 'yellow', '2:3', '0:02.90'), ('T005', '同一刻', 'pink', '3:1', '0:03.87'), ('T006', '交换', 'mint', '3:3', '0:04.84'),
        ('T007', '招手', 'yellow', '4:1', '0:05.81')]):
    E.append((f"| {tid} | {beg} → 4:4.5 | {t124}–0:07.50 | {word} *(label)* | M 56px · stamp-{col} |",
              f"| {tid} | {beg} → 4:4.5 | {t124}–0:07.50 | {word} *(label)* | M 70px · stamp-{col} (opaque label) |", None))
E.append(("| T008 | 4:3.5 → 4:4.5 | 0:07.02–0:07.50 | 留念 *(label)* | M 56px · stamp-pink | on CUT-08 | STAMP | 2 · 0.24 |",
          "| T008 | 4:3 → 4:4.5 | 0:06.77–0:07.50 | 留念 *(label)* — **changed 2026-10-08** (v2 4:3.5: now lands with its card on 4:3, review read #10) | M 70px · stamp-pink (opaque label) | on CUT-08 | STAMP | 2 · 0.36 |", None))
E.append(("| T031 | 18:1 → 19:3 | 0:32.90–0:35.81 | 还没认识，就**【走散】**了。 | D 128px · ink-pink | top, second line | SLAM | 8 · 0.36 |",
          "| T031 | 18:1 → 19:2.75 | 0:32.90–0:35.69 | 还没认识，就**【走散】**了。 — **changed 2026-10-08** (out a 16th before 19:3: 「要是……」 moves up in that 16th, T033 lands on an empty line) | D 128px · ink-pink | top, second line | SLAM | 8 · 0.35 |", None))
E.append(("  0:07.02    [label] 留念\n", "  0:06.77    [label] 留念\n", None))
E.append(("| T010 | 同一刻， | product claim; landing title 「同一刻，另一面。」 |",
          "| T001–T008 | 进场 · 换装 · 上墙 · 视角 · 同一刻 · 交换 · 招手 · 留念 | **2026-10-08** labels on the eight rc.2 cut-outs (capture/P2P3-rc2): CUT-01 the 3D room 「回声现场」 (tags 「阿遥 · 可招呼」 「小满 · 可招呼」 「北屿 · 可招呼」 「阿宁 · 我」 「林间 · 安静」), CUT-02 your 小人 on the wardrobe orbit, CUT-03 the 3D photo wall 「同一晚，另一面。」, CUT-04 「AI 判断：人海」 + 「配对时用它找另一面，你说了算。」, CUT-05 「同一刻的另一面」, CUT-06 「交换已接受」 · 「和 阿遥 的两张照片」, CUT-07 the private chat 「嗨，欢迎来到「回声现场」！」, CUT-08 the memory card PNG (回声现场 / 月台 Livehouse) |\n"
          "| T010 | 同一刻， | product claim; landing title 「同一刻，另一面。」 — **2026-10-08** unchanged in rc.2 (desktop landing card, beside 「这一晚的另一个视角，就在你身边。」 and the handwritten 「就是这一刻！」; H3 opens zoomed on it) |", None))
E.append(("| T013 | 和同场的人，交换彼此的视角。 | what the product does |",
          "| T013 | 和同场的人，交换彼此的视角。 | what the product does — **2026-10-08** rc.2 landing card: 「AI 在本机给你一个视角建议，照片墙帮你找到同一刻的另一面，双方同意就交换。」 |", None))
E.append(("| T021 | 你拍了人海， | (changed 2026-10-07) the demo's own pair: your sample photo is 「人海 · 示例照片」 (sample-crowd.jpg), 阿遥·示例's is the stage (yao-stage.jpg); A4's reason 「你拍人海，TA 拍舞台」 |",
          "| T021 | 你拍了人海， | (changed 2026-10-07; **2026-10-08** rc.2 strings) the judge route's own pair: your ready-made photo is 「人海那张」 (sample-crowd.jpg), 阿遥's is the stage (yao-stage.jpg); the wall badge's reason 「同一刻 · 21:47，相差不到 1 分钟；你拍人海，TA 拍舞台」 (CUT-05, A4). The landing card and About use the opposite, generic example 「同一晚，你拍了舞台，TA 拍了人海。」; the film follows the route a judge walks |", None))
done = 0
for old, new, mark in E:
    if (mark and mark in s) or (not mark and new in s):
        continue
    n = s.count(old)
    if n != 1:
        sys.exit(f'edit not unique/absent ({n}): {old[:80]!r}')
    s = s.replace(old, new); done += 1
open(P, 'w', encoding='utf-8').write(s)
print('applied', done, 'edits')
