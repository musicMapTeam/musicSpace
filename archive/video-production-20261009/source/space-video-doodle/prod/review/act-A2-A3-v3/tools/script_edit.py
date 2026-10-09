"""Edit SCRIPT.md for act A2-A3 lines only (T041-T067), 2026-10-08.  One read-modify-write; every anchor must match exactly once."""
import sys
P = '/tmp/space-video-doodle/script/SCRIPT.md'
s = open(P, encoding='utf-8').read()
R = []
# ---- header note (after the A0-A1 block)
R.append(("""   The eight hook stamps have been 70 px opaque labels since v2 (review read #6); their rows now say so.
""", """   The eight hook stamps have been 70 px opaque labels since v2 (review read #6); their rows now say so.
> **Changed 2026-10-08 (film v3, act A2–A3 only: T041–T067):** the footage is the 0.22.0-rc.2 re-capture (P1-rc2, P2P3-rc2,
>    desktop-rc2) and every product string behind these lines was re-read on rc.2 (§4.1 rows marked **2026-10-08**). Text: T050
>    「放一张 / 今晚的照片。」 (the onboarding card now says 「放一张今晚的照片」), T059 「AI 就说不确定。」 (review art #7: the Display
>    face draws 它 like 已/巳), T065 「3 分钟内拍下，」 (the wall's group note). Timing: T050 stays to 30:1.5 (8 units need 2.0 s), so
>    T051 / T052 enter on 30:1.5 and T051 leaves / T054 enters on 31:1.5. T056/T057 keep the brief's privacy words 「AI 在本机判断，
>    照片不上传」: in rc.2 that sentence is the AI chip's own tooltip (the visible hint now reads 「配对时用它找另一面，你说了算。」), so the
>    film loops the chip instead of highlighting the hint. T066 is no longer a UI quote (rc.2 removed the rule line); it stays as a true
>    narration claim (§4.1). T061 enters under T060 and stays put (review read #9).
"""))
# ---- §2 A2 intro
R.append(("*the product: back into the same livehouse, your illustrated avatar, choose how to take part, see who was there (labelled 示例)*",
          "*the product: back into the same livehouse, your illustrated avatar, choose how to take part, see who was there (2026-10-08: rc.2 tags 「阿遥 · 可招呼」 … 「林间 · 安静」, no 「·示例」)*"))
# ---- §2 A3 rows
R.append(("| T050 | 29:1 → 30:1 | 0:54.19–0:56.13 | 放一张你的照片。 | D 128px · ink-yellow | left column | SLAM | 7 · 0.28 |",
          "| T050 | 29:1 → 30:1.5 | 0:54.19–0:56.37 | 放一张 / 今晚的照片。 — **changed 2026-10-08** (rc.2 onboarding card 「第一次来 1/4 · 放一张今晚的照片」; v2 「放一张你的照片。」; 8 units need 2.0 s, so it stays an 8th past 30:1) | D 128px · ink-yellow | left column, two lines | SLAM | 8 · 0.27 |"))
R.append(("| T051 | 30:1 → 31:1 | 0:56.13–0:58.06 | **【21:48】** | G 240px · digits | left column | POP | 1 · 1.94 |",
          "| T051 | 30:1.5 → 31:1.5 | 0:56.37–0:58.31 | **【21:48】** — **changed 2026-10-08** (an 8th later, after T050) | G 240px · digits | left column | POP | 1 · 1.94 |"))
R.append(("| T052 | 30:1 → 31:3 | 0:56.13–0:59.03 | 拍摄时间， / 照片**【自己记得】**。 | D 128px · ink-yellow | left column, under the time | SLAM | 10 · 0.29 |",
          "| T052 | 30:1.5 → 31:3 | 0:56.37–0:59.03 | 拍摄时间， / 照片**【自己记得】**。 — **changed 2026-10-08** (in on 30:1.5; steps up on 31:1.5) | D 128px · ink-yellow | left column, under the time | SLAM | 10 · 0.27 |"))
R.append(("| T054 | 31:1 → 32:1 | 0:58.06–1:00.00 | 拍的是哪一面？ | D 128px · ink-pink | left column | SLAM | 6 · 0.32 |",
          "| T054 | 31:1.5 → 32:1 | 0:58.31–1:00.00 | 拍的是哪一面？ — **changed 2026-10-08** (in on 31:1.5, under T052) | D 128px · ink-pink | left column | SLAM | 6 · 0.28 |"))
R.append(("| T059 | 34:1 → 35:1 | 1:03.87–1:05.81 | 它就说**【不确定】**。 | D 128px · ink-dashed | left column (key word in a dashed outline) | SLAM | 6 · 0.32 |",
          "| T059 | 34:1 → 35:1 | 1:03.87–1:05.81 | AI 就说**【不确定】**。 — **changed 2026-10-08** (v2 「它就说不确定。」: the Display face draws 它 like 已/巳, review art #7) | D 128px · ink-dashed | left column (key word in a dashed outline); 34:2 the product's own chip 「✦ 不确定，请选择」 lifts off the phone under it | SLAM | 6 · 0.32 |"))
R.append(("| T060 | 34:3 → 35:3 | 1:04.84–1:06.77 | **【你】**来选。 | D 128px · st-yellow | left column, sticker | POP | 3 · 0.65 |",
          "| T060 | 34:3 → 35:3 | 1:04.84–1:06.77 | **【你】**来选。 | D 128px · st-yellow | left column, sticker (2026-10-08: under the lifted 不确定 chip) | POP | 3 · 0.65 |"))
R.append(("| T061 | 35:1 → 36:1 | 1:05.81–1:07.74 | 保存，**【上墙】**。 | D 128px · ink-pink | left column | SLAM | 4 · 0.48 |",
          "| T061 | 35:1 → 36:1 | 1:05.81–1:07.74 | 保存，**【上墙】**。 | D 128px · ink-pink | left column, bottom (2026-10-08: enters under T060 and stays put, review read #9) | SLAM | 4 · 0.48 |"))
R.append(("| T065 | 38:1 → 39:1 | 1:11.61–1:13.55 | **【3 分钟】**以内， | G 128px · digits | left column, second line | POP | 5 · 0.39 |",
          "| T065 | 38:1 → 39:1 | 1:11.61–1:13.55 | **【3 分钟】**内拍下， — **changed 2026-10-08** (the rc.2 wall's group note 「3 分钟内拍下」, highlighted on the lifted card on 38:3; v2 「3 分钟以内，」) | G 128px · digits | left column, second line | POP | 6 · 0.32 |"))
# ---- §3 read-through
R.append(("""  0:54.19  放一张你的照片。
  0:56.13  21:48
  0:56.13  拍摄时间，｜照片自己记得。
  0:58.06  拍的是哪一面？""", """  0:54.19  放一张｜今晚的照片。
  0:56.37  21:48
  0:56.37  拍摄时间，｜照片自己记得。
  0:58.31  拍的是哪一面？"""))
R.append(("  1:03.87  它就说不确定。\n", "  1:03.87  AI 就说不确定。\n"))
R.append(("  1:11.61  3 分钟以内，\n", "  1:11.61  3 分钟内拍下，\n"))
# ---- §4.1 evidence rows
R.append(("| T042 | 再进同一间 / Livehouse。 | the 3D room 「回声现场 · 示例场」 at 「月台 Livehouse（虚构场地）」 |",
          "| T042 | 再进同一间 / Livehouse。 | (2026-10-08) the 3D room 「回声现场」 at 「月台 Livehouse」 (rc.2 entry panel eyebrow 「月台 Livehouse · 回声现场」; rc.1 「回声现场 · 示例场」 / 「（虚构场地）」) |"))
R.append(("| T043 | 带上你的小人， | entry panel 「带上小人，进入示例现场」 |",
          "| T043 | 带上你的小人， | (2026-10-08) entry panel 「带上小人，进入现场」 (rc.1 「…进入示例现场」) |"))
R.append(("| T044 | 今晚，我这样。 | wardrobe title 「今晚，我这样。」 |",
          "| T044 | 今晚，我这样。 | wardrobe title 「MY LOOK / 今晚，我这样。」 (re-checked 2026-10-08) |"))
R.append(("| T045 | 愿意打招呼， | entry option 「愿意打招呼」 |",
          "| T045 | 愿意打招呼， | entry option 「愿意打招呼 · 别人可以向我招手」 (re-checked 2026-10-08) |"))
R.append(("| T046 | 还是 / 安静参与？ | entry option 「安静参与」 |",
          "| T046 | 还是 / 安静参与？ | entry option 「安静参与 · 照片照常分享，不接新招呼」 (re-checked 2026-10-08) |"))
R.append(("| T050 | 放一张你的照片。 | route card 「放一张你的照片」 |",
          "| T050 | 放一张今晚的照片。 | (changed 2026-10-08) onboarding card 「第一次来 1/4 · 放一张今晚的照片」 with 「人海那张」 / 「舞台那张」 / 「用我自己的照片」 (rc.1 route card 「示例路线 1/4 · 放一张你的照片」) |"))
R.append(("| T051 | 21:48 | 「拍摄于 21:48 · 来自照片自带的信息」 |",
          "| T051 | 21:48 | 「拍摄于 21:48 · 来自照片自带的信息」 (re-checked 2026-10-08: the time is the file's EXIF; rc.2 has no sample note under it) |"))
R.append(("| T054 | 拍的是哪一面？ | form section 「我拍的这一面」 |",
          "| T054 | 拍的是哪一面？ | form section 「我拍的这一面」 (re-checked 2026-10-08) |"))
R.append(("| T055 | 人海。 | chip 「AI 判断：人海」 |",
          "| T055 | 人海。 | chip 「AI 判断：人海」 (re-checked 2026-10-08) |"))
R.append(("| T056 | AI 在本机判断， | form hint 「AI 在本机判断，照片不上传……」 |",
          "| T056 | AI 在本机判断， | (changed 2026-10-08) the AI chip's own tooltip: rc.2 「AI 判断：人海」 carries 「AI 在本机判断，照片不上传」 (the visible hint under it now reads 「配对时用它找另一面，你说了算。」; the film loops the chip, 33:1.5); About 「放照片时，AI 在你的设备上建议它拍的是舞台、人海、身边还是细节…」 |"))
R.append(("| T057 | 照片不上传。 | form hint (static demo: nothing is uploaded at all) |",
          "| T057 | 照片不上传。 | (changed 2026-10-08) the same chip tooltip 「AI 在本机判断，照片不上传」 (the online edition uploads nothing at all) |"))
R.append(("| T059 | 它就说不确定。 | chip 「不确定，请选择」 |",
          "| T059 | AI 就说不确定。 | (changed 2026-10-08) chip 「不确定，请选择」 (+ 「AI 认为更可能是舞台或人海」 for screen readers); About 「没把握就说「不确定」，由你来选。」 |"))
R.append(("| T060 | 你来选。 | 「选择永远由你做」 (About) |",
          "| T060 | 你来选。 | (changed 2026-10-08) rc.2 About 「…没把握就说「不确定」，由你来选。」; the form 「配对时用它找另一面，你说了算。」 (rc.1 About 「选择永远由你做」) |"))
R.append(("| T063 | 按拍摄时间， | rule line 「按拍摄时间分组」 |",
          "| T063 | 按拍摄时间， | (changed 2026-10-08) rc.2 dropped the rule line 「按拍摄时间分组…」; the wall still groups by shooting time: each card's 「拍摄于 21:48」, the group header 「21:47 · 同一刻」, the note 「3 分钟内拍下」 |"))
R.append(("| T064 | 就是同一刻。 | group header 「21:47 · 同一刻 · 3 个视角」 |",
          "| T064 | 就是同一刻。 | group header 「21:47 · 同一刻 · 3 个视角：舞台 · 人海 · 细节」 (re-checked 2026-10-08) |"))
R.append(("| T065 | 3 分钟以内， | 「相差不超过 3 分钟」 (SAME_MOMENT_MS) |",
          "| T065 | 3 分钟内拍下， | (changed 2026-10-08) the wall's group note 「3 分钟内拍下」 (SAME_MOMENT_MS = 3 min; rc.1 「相差不超过 3 分钟」) |"))
R.append(("| T066 | 规则判断，不是 AI。 | rule line 「规则判断，不是 AI」 |",
          "| T066 | 规则判断，不是 AI。 | (changed 2026-10-08) no longer a UI quote: rc.2 removed the sentence from the wall (owner: no explanatory copy in the product). Still true as narration: the group is the 3-minute shooting-time rule (the note 「3 分钟内拍下」), the AI only suggests the viewpoint (About 「AI 在你的设备上建议它拍的是舞台、人海、身边还是细节；没把握就说「不确定」」) |"))
# ---- §4.2 / §4.3 / §5 parentheticals about my lines
R.append(("(T066 stamp 「规则判断，不是 AI。」 sits on screen while the rule line is zoomed).",
          "(T066 stamp 「规则判断，不是 AI。」 sits on screen while the wall's group header and note 「3 分钟内拍下」 are lifted off the phone — 2026-10-08; rc.2 no longer prints a rule line)."))
R.append(("| sample capture time is fictional | (changed 2026-10-07) no overlay; the form's own note 「示例照片 · 虚构的拍摄时间 21:48，写在文件里」 still shows in the A3 footage (30–31; to be re-captured) |",
          "| sample capture time is fictional | (changed 2026-10-07) no overlay; (2026-10-08) A3 re-captured on rc.2: the form shows only 「拍摄于 21:48 · 来自照片自带的信息」; the end card's credits line T146 carries it |"))
R.append(("| pairing is a rule, ≤ 3 minutes | T063–T066 (37–39), the product rule line zoomed (38) |",
          "| pairing is a rule, ≤ 3 minutes | T063–T066 (37–39), the wall's group note 「3 分钟内拍下」 lifted and highlighted (38) — 2026-10-08 |"))
R.append(("raw 得意黑 has no 「≤」 (T065 says 「3 分钟以内」).",
          "raw 得意黑 has no 「≤」 (T065 says 「3 分钟内拍下」 since 2026-10-08)."))
miss = [a[:60] for a, b in R if s.count(a) != 1]
if miss:
    print('ANCHORS NOT UNIQUE/MISSING:', miss); sys.exit(1)
for a, b in R:
    s = s.replace(a, b)
open(P, 'w', encoding='utf-8').write(s)
print('applied', len(R), 'edits')
