"""Update SCRIPT.md for act A6-A7 only (T120-T146), marked 2026-10-08.  Every replacement must match exactly once; the file is read
and written back in one go (other passes edit their own rows of the same file), and nothing is written if any pattern is missing.
   python3 script_update.py [--dry]"""
import sys

P = '/tmp/space-video-doodle/script/SCRIPT.md'
R = [
    # ---- A6 section: a v3 note under the act's description
    ("*(**changed 2026-10-07**) the venue: a Livehouse opens a room, its fans stay in its local community, the next show's preview goes straight to the community, so the venue has its own fans and promotes Music Space; privacy, consent, fun; 「曲终，人不散。」; one person can try it now*\n",
     "*(**changed 2026-10-07**) the venue: a Livehouse opens a room, its fans stay in its local community, the next show's preview goes straight to the community, so the venue has its own fans and promotes Music Space; privacy, consent, fun; 「曲终，人不散。」; one person can try it now*\n"
     "\n"
     "> **Checked 2026-10-08 (A6–A7 v3, footage re-shot on 0.22.0-rc.2: `prod/capture/H1-host-rc2`, `P2P3-rc2`, `desktop-rc2`):** the words\n"
     "> stay except T127s, now rc.2's own lobby line 「双方同意就交换」; T141 lands on 83:3 under the CC0 maps (review rhythm #7), the link\n"
     "> T143 is 64 px (read #11), the credits line T146 40 px (read #5), the QR 1.2× (art #14). On screen: the host form 「Livehouse / 为这一场\n"
     "> 开房 · 今晚叫什么名字？」, the 乐迷社群's 3D sign 「月台 Livehouse / 乐迷社群」, 「发布下一场预告」 → 「发布给社群成员」 → 「发布预告」 → the\n"
     "> card 「下一场预告 · 周六 · 月台夜」; W3's consent die-cut is rc.2's tick 「我同意先给小图，TA 接受后再给原图」 + 「把这两张交给对方确认 ↗」,\n"
     "> with the product's 「交换已接受」 sticker landing under it on 78:1; W5 opens on the room's own sign 「月台 Livehouse · 回声现场 · 5 位已加入 ·\n"
     "> 正在进行」 and pushes in to the five on stage (tags 「阿遥 · 可招呼」 … 「林间 · 安静」, no 「·示例」), a pink ring on the floor round their feet.\n"),
    # ---- A6 table rows
    ("| top left (phone: 主办方 / 开一个现场, 场地 「月台 Livehouse」) | SLAM | 4 · 0.97 |",
     "| top left (phone: 「Livehouse / 为这一场开房」, 场地 「月台 Livehouse」 — **2026-10-08** rc.2) | SLAM | 4 · 0.97 |"),
    ("| left column, under T120 (the venue community's 3D header) | SLAM | 8 · 0.36 |",
     "| left column, under T120 (the venue's 乐迷社群: its 3D header sign 「月台 Livehouse / 乐迷社群」, **2026-10-08** rc.2) | SLAM | 8 · 0.36 |"),
    ("| top left (phone: 发布新的活动预告) | SLAM | 6 · 0.40 |",
     "| top left (phone: 「发布下一场预告」 → the card 「下一场预告」, **2026-10-08** rc.2) | SLAM | 6 · 0.40 |"),
    ("| AI 在本机判断， / 照片不上传 *(label)* — **changed 2026-10-07** (the product's / brief's privacy words) |",
     "| AI 在本机判断， / 照片不上传 *(label)* — **changed 2026-10-07** (the product's / brief's privacy words; **2026-10-08**: in rc.2 the AI chip's own title, the visible hint under it now reads 「配对时用它找另一面，你说了算。」) |"),
    ("| 双方同意，才交换 *(label)* — **changed 2026-10-07** (the product never says 点头) |",
     "| 双方同意就交换 *(label)* — **changed 2026-10-08** (rc.2's lobby line; v2 「双方同意，才交换」 quoted rc.1's landing, which rc.2 no longer has; A4's T082/T083 keep the brief's 「双方同意，才交换」) |"),
    # ---- A7 table rows
    ("| T141 | 83:2.5 → 91:1 | 2:39.44–2:54.19 | **【另一面。】** | D 240px · hl-mint | left, lower | SLAM+SWIPE | 3 · 4.92 |",
     "| T141 | 83:3 → 91:1 | 2:39.68–2:54.19 | **【另一面。】** — **changed 2026-10-08** (on 83:3 under the CC0 maps, review rhythm #7; the original score keeps 83:2.5, its tag hit) | D 240px · hl-mint | left, lower | SLAM+SWIPE | 3 · 4.84 |"),
    ("| musicmapteam.github.io/musicSpace/ *(label)* | G 84px · link-pill |",
     "| musicmapteam.github.io/musicSpace/ *(label)* | G 64px · link-pill (**2026-10-08**: 64 px, review read #11; v2 56 px) |"),
    ("| H 36px · fine, on a paper strip | bottom centre, one line |",
     "| H 40px · fine, on a paper strip (**2026-10-08**: 40 px, review read #5) | bottom centre, one line |"),
    # ---- read-through
    ("  2:27.58    [label] 双方同意，才交换\n", "  2:27.58    [label] 双方同意就交换\n"),
    ("  2:39.44  另一面。\n", "  2:39.68  另一面。\n"),
    # ---- 4.1 evidence rows
    ("| T120 | Livehouse 开个房， | (changed 2026-10-07) entry button 「我是主办方，开个房」; create sheet 「主办方 / 开一个现场 · 今晚叫什么名字？」 with the fields 场次名称 and **场地** (filmed: 场地 「月台 Livehouse」, TAKE-H H-01) |",
     "| T120 | Livehouse 开个房， | (changed 2026-10-07; **2026-10-08** rc.2 strings) entry 「我是 Livehouse / 主办方，开个房」; create sheet 「Livehouse / 为这一场开房 · 今晚叫什么名字？」 with the fields 场次名称 and **场地**, submit 「开房并进入现场」 (filmed: 场地 「月台 Livehouse」, TAKE-H rc.2 H-01); landing caption 「Livehouse 为每一场演出开一个房间，乐迷带着小人入场；散场后，留在场地的乐迷社群里。」 |"),
    ("| T121 | 乐迷留在 / 本地社群。 | (changed 2026-10-07) the host's long-term community (「本场主办方的长期社群」, host form 「绑定我维护的长期空间」); joining is each member's own choice (「每次加入都由你选择」) |",
     "| T121 | 乐迷留在 / 本地社群。 | (changed 2026-10-07; **2026-10-08** rc.2 strings) the venue's 乐迷社群: list intro 「散场后，乐迷留在场地的社群里；下一场的预告直接发到这里。」, About 「散场后，乐迷留在你的乐迷社群里，下一场的预告也直接发在那里。」; filmed: 「月台 Livehouse 乐迷社群」 with the 3D sign 「月台 Livehouse / 乐迷社群」 (TAKE-H rc.2 H-02); joining is each member's own tap (「我愿意加入这个乐迷社群」 + 「加入，继续聊」) |"),
    ("| T122 | 下一场的预告， | (changed 2026-10-07) SPACE 「让下一次见面有个地方」 · 「发布新的活动预告」 (活动名称 / 场地 / 时间 / 给成员的话) -> 「活动预告 · 尚未开现场」 (TAKE-H H-03); 「活动预告是主办方自填信息」 |",
     "| T122 | 下一场的预告， | (changed 2026-10-07; **2026-10-08** rc.2 strings) 「下一场预告」 (button, panel title); panel 「LIVEHOUSE / 下一场见」 · form 「发布下一场预告」 (演出名称 / 场地 / 时间 / 给乐迷的话) -> the card 「下一场预告 · 周六 · 月台夜」 under 「下一场」 (TAKE-H rc.2 H-03) |"),
    ("| T123 | 直接发给社群。 | (changed 2026-10-07) consent 「确认向本社群成员发布活动资料」 + 「发布活动预告」: published to the community's members, no marketing push (「不订阅营销」), no automatic entry (「每人仍需同意入场」) |",
     "| T123 | 直接发给社群。 | (changed 2026-10-07; **2026-10-08** rc.2 strings) consent 「发布给社群成员」 + 「发布预告」; list intro 「…下一场的预告直接发到这里。」: published to the community's members only; entry stays each person's own consent (「我愿意向本场成员展示我的昵称和小人」); the card's 「为这一场开房」 / 「把这一场的邀请码给社群成员」 are the host's next steps, nothing is pushed or joined automatically |"),
    ("| T126 | 隐私 | 「AI 在本机判断」 |",
     "| T126 | 隐私 | 「AI 在本机判断」 (**2026-10-08** rc.2: the AI chip's title); About 隐私 「照片给谁看由你决定…」 |"),
    ("| T126s | AI 在本机判断， / 照片不上传 | (changed 2026-10-07) form hint 「AI 在本机判断，照片不上传……」 (the brief's wording) |",
     "| T126s | AI 在本机判断， / 照片不上传 | (changed 2026-10-07; **2026-10-08** rc.2) the title of the AI chip 「AI 判断：人海」 in the online build: 「AI 在本机判断，照片不上传」 (the brief's wording; the room build's chip says 「AI 在本机判断，判断时不上传照片」); rc.2's visible hint under the chip reads 「配对时用它找另一面，你说了算。」 (die-cut CUT-04c above the line) |"),
    ("| T127 | 同意 | 「双方同意才交换」 |",
     "| T127 | 同意 | (**2026-10-08** rc.2) lobby 「双方同意就交换」; About 「交换照片、成为朋友，都要双方同意。」 |"),
    ("| T127s | 双方同意，才交换 | (changed 2026-10-07) landing 「双方同意才交换」 (the brief's wording; A4 T082/T083) |",
     "| T127s | 双方同意就交换 | (changed **2026-10-08**) rc.2 lobby 「照片墙帮你找到同一刻的另一面，双方同意就交换。」 (v2 quoted rc.1's landing 「双方同意才交换」, gone in rc.2); above it the die-cut CUT-11 (tick 「我同意先给小图，TA 接受后再给原图」 + 「把这两张交给对方确认 ↗」), under it the product's 「交换已接受」 sticker (CUT-06s, 78:1) |"),
    ("| T128s | 世界杯 · 默契局 · 创作角 | 专辑世界杯 / 默契局 / 创作角 exist in the build |",
     "| T128s | 世界杯 · 默契局 · 创作角 | 专辑世界杯 / 默契局 / 创作角 exist in the build (re-checked **2026-10-08** on rc.2: 「今晚的专辑世界杯」, 「音乐偏好默契局」, 「TWO SIDES / 两个人的创作角」) |"),
    ("| T132 | 一人 / 就能走完全程。 | single-visitor demo; About 「没有服务器，没有账号」 |",
     "| T132 | 一人 / 就能走完全程。 | single-visitor demo (**2026-10-08** rc.2): the online edition runs the whole route for one visitor, the cast answers by itself (About 在线版 「在线版里的场地、观众和照片是演示内容，观众会自动回复。」); rc.2 no longer says 「没有服务器，没有账号」 |"),
    ("the cast and sample photos are fictional (README / About), the photos AI-generated",
     "the cast and sample photos are fictional (README / About; **2026-10-08** rc.2 About: 「在线版里的场地、观众和照片是演示内容，观众会自动回复。」), the photos AI-generated"),
    # ---- 4.2 the venue bullet
    ("- **The venue story claims only what the build does (added 2026-10-07):** a host opens a room with a 场地; the room can be linked to the host's long-term community; the host publishes the next show's preview to the community's members (「确认向本社群成员发布活动资料」, 「活动预告是主办方自填信息」) and can provide invite codes, but every member still decides to join (「每人仍需同意入场」); members join by choice, 「不订阅营销，不扩大照片权限」. The video never says push marketing, ads, automatic entry, or that members get old photos. 「更愿意推广」 is the owner's reason why venues adopt it, not a product feature.",
     "- **The venue story claims only what the build does (added 2026-10-07; strings re-read on rc.2 2026-10-08):** a Livehouse opens a room for a show with a 场地 (「我是 Livehouse / 主办方，开个房」, 「Livehouse / 为这一场开房」); the venue keeps its 乐迷社群 (「Livehouse 乐迷社群」); the host publishes the next show's preview to the community's members (「发布下一场预告」 → 「发布给社群成员」 → 「发布预告」) and can give them the show's invite code (「把这一场的邀请码给社群成员」), but every member still joins with their own consent (「我愿意加入这个乐迷社群」, 「我愿意向本场成员展示我的昵称和小人」). The video never says push marketing, ads, automatic entry, or that members get old photos. 「更愿意推广」 is the owner's reason why venues adopt it, not a product feature."),
]


def main(dry):
    s = open(P, encoding='utf-8').read()
    bad = [old[:90] for old, _ in R if s.count(old) != 1]
    if bad:
        print('NOT APPLIED; patterns not found exactly once:'); [print('  -', b) for b in bad]; sys.exit(1)
    for old, new in R:
        s = s.replace(old, new)
    if dry:
        print('dry run ok:', len(R), 'replacements'); return
    cur = open(P, encoding='utf-8').read()          # re-read: apply on the newest text (another pass may have saved meanwhile)
    for old, new in R:
        if cur.count(old) != 1: print('changed underneath, aborting at', old[:60]); sys.exit(1)
        cur = cur.replace(old, new)
    open(P, 'w', encoding='utf-8').write(cur)
    print('applied', len(R), 'replacements')


main('--dry' in sys.argv)
