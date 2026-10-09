export const meta = {
  name: 'space-video-production',
  description: 'Full Doodle video production: capture all product shots, production motion library + retime maps, 4 act builders, assembly + mix + QC, 4-lens review, fixes, final render + cover',
  phases: [
    { title: 'Capture+Library', detail: 'phone P1, phone P2/P3 + cut-outs, desktop 4K takes; production motion library, tempo maps for every music option, audio + render + QC tools' },
    { title: 'Acts', detail: 'A0-A1, A2-A3, A4, A5, A6-A7 built and self-reviewed' },
    { title: 'Assemble', detail: 'full timeline, music edit + SFX mix, full render, QC, cover' },
    { title: 'Review', detail: 'art/impact, rhythm/sync, readability, accuracy/compliance' },
    { title: 'Polish', detail: 'fix confirmed notes, final render, final QC' },
  ],
}

const V = '/tmp/space-video-doodle'
const P = '/tmp/space-video-doodle/prod'
const REPO = '/Users/alakazan/workplace/tme/musicSpace'
const BUILD = '/tmp/space-publish/dist-pages'
const M = 'opus'

const CTX = `We are producing the competition video for Music Space (TME university AI hackathon; submission due 2026-10-09; rules: at most 3:00 — we target 2:52-2:56 —, at most 500 MB, must carry narration or subtitles, no watermark, no noise; judged on user value, feasibility, innovation). Music Space: people from the same concert meet in a 3D livehouse room with illustrated avatars, put photos on a wall and swap 「同一刻的另一面」 (on-device AI suggests a photo's viewpoint, EXIF time + rules pair photos within 3 minutes, both sides must agree), plus chat, friends, community, games, World Cup, creation corner; it runs fully in the browser as a labelled example world. The product and the video share a hand-drawn Doodle style (cream dot-grid paper, ink outlines, hard offset shadows, pink/mint/yellow markers, stickers, tape, polaroids, layered lettering with colour, layers and big size contrast).

THE OWNER'S BRIEF: about three minutes; kinetic-typography narration integrated into the picture (it is also the subtitle track); strong rhythm (cuts, type hits and sticker pops on beats); rich and impactful; show the real product's beauty, not abstract. A previous rehearsal was rejected for no rhythm and no strong art style. Only CC0/public-domain or original music (licence proofs exist); no third-party or real-person images; AI concert images must stay labelled 「照片为 AI 生成的示例图」; no TME logos (QQ音乐/酷狗 only as plain type under a 「设想」 sticker); privacy wording must be the product's own: 「AI 在本机判断，照片不上传」, 「双方同意，才交换」, 「随时可以撤销」 (never "nothing leaves your device").

PRE-PRODUCTION (approved direction; read before working): ${V}/script/SCRIPT.md (87 narration lines, bar:beat timing at 124 BPM, act tables, honesty notes), ${V}/script/STORYBOARD.md (39 shots over 90 bars in acts A0-A7, visual kit, rhythm grammar, elastic retime §5, honesty checklist §6), ${V}/script/SHOTS.md (capture list with exact steps, selectors, measured waits, gotchas), ${V}/script/FORM-DRAFT.md. The approved animatic (28.6 s, cold open → title → pain → drop) and its motion system: ${V}/animatic/ (dm/doodle-motion.js + .css, scenes/animatic.js + frames.js, tools/render.mjs audio.py qc.py contact.py glyphcheck.py rhythm_map.py, assets/, audio/; read its report notes in the scene files and ${V}/animatic/out/animatic.manifest.json). Capture rig proven in ${V}/capture-test/ (rec2.mjs, flow.mjs, clip-*.mjs: controlled clock, 60 fps, phone 390x845 @2.77 = 1080x2340, desktop 1440x810 @1.33 or @2.67 for 4K; Chrome headless with --use-angle=metal --enable-gpu gives the real M4 GPU). Fonts: /tmp/music-space-font-cache/{display,marker,hand,note,logo,digits}.ttf (raw Display draws 入/个 badly and has no ·: use the product's patched slices in ${REPO}/web/event-room/public/fonts/doodle/ or avoid those characters, as the script does).

WORKING MUSIC: Wax Lyricist 《Flipping In》 (CC0 1.0, 123 BPM, bar 1.951 s) in ${V}/music-cc0/02-flipping-in__Wax-Lyricist/ (beats.json, LICENCE-PROOF.md). The owner has not chosen yet, so everything must stay retimable: the storyboard is in bars; a tempo map turns storyboard bars into track bars and seconds. Animatic proposal for Flipping In: storyboard bars 1-6 = track 55-60, 7-8 = 61-62 (title on the stop), 9-20 = 63-74 (pain, bass only), drop at 21 = 75, 21-48 = 75-102, 49-50 = 61-62 again (stop), payoff at 51 = 103, 51-66 = 103-118, 67-72 = 107-112, 73-74 = 119-120 (stop-time break), 75-82 = 103-110, 83-90 = 111-118 then fade; 90 bars = 175.6 s, so drop one bar to stay at or under 175 s. Other options to keep switchable: ${V}/music-cc0/01-grab-a-partner__Loyalty-Freak-Music (130), 03-post-adventure-tea-party__Zane-Little (110), 04-consternation-at-the-disco__Wax-Lyricist (130), 05-reserve-love-love-love__HoliznaCC0 (115), and the original score ${V}/music-original (124, beats.json; STORYBOARD §3.1 gives its re-render config).

THE BUILD TO FILM: ${BUILD} (main 8fa52f0, byte-identical to the live preview). Serve it with: cd ${REPO} && node scripts/pages/serve-prefix.mjs ${BUILD} /musicSpace/ <free port>. Never modify ${REPO} or ${BUILD}; never touch the dev server on 5190. Production folder: ${P}/ (capture/, dm/, scenes/, audio/, tools/, out/, review/). Write only inside your own subfolder or files named in your task. Keep every shell command under 5 minutes (background + poll for long captures/renders); stop servers and browsers you started. Nobody can listen to audio on this machine: judge audio by measurement (loudness, true peak, onsets vs grid, spectra).`

phase('Capture+Library')
const CAPS = [
  { label: 'capture:phone-P1', task: `CAPTURE TAKE-P1 (SHOTS.md §3): the continuous phone judge route in one world, 1080x2340 at 60 fps, every storyboard shot it feeds (E1-E3, A1-A2, A4-A5, M2-M7, S1-S2, S4-S10, CUT-04…08, 11-13). Folder ${P}/capture/P1/. Split into named sub-clips per storyboard shot with generous handles (≥1 s before/after the action) and record exact action timestamps (tap, chip appears, 「交换已接受」 appears, reply arrives) so editors can land them on beats. Use the visitor setup from SHOTS.md (nickname 「阿宁」, the 「失真」 look). Produce manifest.json (shot id → file, in/out, action times, notes) and a contact sheet.` },
  { label: 'capture:phone-P2P3-cutouts', task: `CAPTURE TAKE-P2 (the honest case: 「舞台 · 示例照片」 → 「不确定，请选择」 with two dashed suggestions, nothing selected; fresh world, never saved), TAKE-P3 (spare: 成员音乐话题, only for elastic bars) and SHOTS.md §5 cut-outs and exports (die-cut UI pieces, avatar stickers of the cast and the visitor, polaroid PNGs, the memory-card PNG and creation-corner invitation PNG exported by the product itself, at full resolution with alpha where the storyboard needs stickers). Folder ${P}/capture/P2P3/. Produce manifest.json (asset id → file, size, alpha, notes) and a contact sheet.` },
  { label: 'capture:desktop', task: `CAPTURE the desktop takes (SHOTS.md §4: CSS 1440x810, DPR 8/3 → 3840x2160 master, 60 fps): the 3D room overview with the cast and slow camera moves, the photo wall camera view, the exchange compose → 「交换已接受」 on desktop, chat with a reply, the about sheet if the storyboard uses it — whatever STORYBOARD.md assigns to desktop footage. Folder ${P}/capture/desktop/. Also deliver 1920x1080 downscales (Lanczos) for editing. Produce manifest.json with action timestamps and a contact sheet.` },
]
const capturesP = parallel(CAPS.map(c => () => agent(`${CTX}\n\n${c.task}\nUse the proven capture rig (controlled clock, lossless frames → ffmpeg H.264 CRF 14-16 yuv420p BT.709, 60 fps). Check every clip by frame sampling (no duplicated or frozen frames during motion, no half-loaded UI, no debug overlays, no cursor unless intended as the doodle tap ring). Return a short report: files, durations, action timestamps, problems.`, { label: c.label, phase: 'Capture+Library', model: M }).then(r => ({ label: c.label, report: r }))))

const library = await agent(`${CTX}

YOUR JOB: the production motion library and pipeline, so act builders only write scenes. Folder ${P}/dm/, ${P}/tools/, ${P}/audio/ (you own these).
1. Lift the animatic's system into ${P}/dm/ as a stable, documented API (README.md with examples): paper/background, frames (phone, laptop, polaroid, tape), cut-out stickers, layered type recipes (per SCRIPT.md fonts/sizes/styles, type-on, slam, highlighter swipe, marker underline/circle draw-on), pops/starbursts/confetti/stamps/⇄ sticker, transitions (scribble/marker wipe, slap-on, punch-in zoom), footage playback (frame-accurate video in a frame, with crop/zoom/pan keyframes, speed ramps), and the event log used by QC and SFX. Deterministic: every frame a pure function of the frame number.
2. Timeline + tempo map: storyboard bars → track bars → seconds. A config per music option in ${P}/tools/tempo-maps/: flipping-in (the proposal above, cut to ≤175 s), grab-a-partner, tea-party, consternation, love-love-love, original-124 (with the STORYBOARD §3.1 re-render config). For each, map the storyboard's structural moments (title stop, pain sparse section, drop at the product, AI chime, payoff at 「交换已接受」, social groove, lift, end-card resolve) onto that track's real sections from its beats.json/energy analysis; report where a track cannot honour a moment.
3. Music edit tool: renders the edited music bed for a tempo map (bar-accurate splices with short crossfades on downbeats, fade-out under the end card), loudness to -16 LUFS integrated, true peak ≤ -1.0 dBTP.
4. SFX: code-generated (no licences needed) — pencil scribble, paper slap, sticker pop, stamp, marker squeak, whoosh, tick, chime, crowd-ish swell made from noise (no recorded audio); driven from the event log; sit about 8-10 dB under the music.
5. Render tool: chunked parallel rendering (--from/--to bars or seconds, N workers), lossless intermediate or high-quality chunks, concat, final H.264 High 1920x1080 60 fps yuv420p BT.709, CRF chosen so the full cut is 150-300 MB, AAC 48 kHz 256 kb/s.
6. QC tool: duration ≤175 s, loudness, true peak, frozen/black frames (no still over 2.5 s without motion), every text on screen long enough to read (≥ 0.25 s per character for Chinese, min 0.8 s), glyph coverage for every rendered string, beat alignment of every logged event (report off-grid ones), QR decode on the end card, safe-area check (title-safe 5%).
7. Port acts A0 and A1 from the animatic into ${P}/scenes/act-A0-A1.js on the new API (you own that file), matching SCRIPT/STORYBOARD bars 1-20, and render them as a test with the flipping-in map. Write ${P}/scenes/README.md telling act builders exactly how to write and preview an act (one command renders an act with music).
Return a concise report with the API overview, commands and test results.`, { label: 'video:library', phase: 'Capture+Library', model: M })

const captures = await capturesP
const capSummary = captures.map(c => `- ${c.label}: ${(c.report || 'FAILED').slice(0, 1500)}`).join('\n')

phase('Acts')
const ACTS = [
  { id: 'A2-A3', bars: '21-40', file: 'act-A2-A3.js', focus: 'ENTER (the drop into the real product, the room, the cast, your avatar) and PHOTO + AI (upload, 「AI 判断：人海」 as a hero moment with the chime, the honest 「不确定，请选择」 case, 「AI 在本机判断，照片不上传」).' },
  { id: 'A4', bars: '41-54', file: 'act-A4.js', focus: 'SAME MOMENT + EXCHANGE — the emotional payoff: 「同一刻」 pairing within 3 minutes on the wall, 「同一刻的另一面」 badge, request with consent, the wait, then 「交换已接受」 landing on the payoff downbeat with the biggest hit of the film (both polaroids, ⇄ sticker, confetti), 「双方同意，才交换」.' },
  { id: 'A5', bars: '55-72', file: 'act-A5.js', focus: 'AFTER THE SWAP: greet, private chat with a reply, friends, community, games/World Cup, creation corner invitation, the memory card — a fast, joyful montage on the social groove, each feature a beat-synced card with real footage.' },
  { id: 'A6-A7', bars: '73-90', file: 'act-A6-A7.js', focus: 'WHY IT MATTERS (a natural layer after every live show on music platforms, shown only as plain type under a 「设想」 sticker; privacy-first; runs in the browser) and the END CARD (link musicmapteam.github.io/musicSpace/, QR decoding to https://musicmapteam.github.io/musicSpace/, credits: example characters and photos are fictional/AI-generated, music credit line for the chosen track and its licence, 「浏览器直接打开 · 无需安装」).' },
]
const acts = await parallel(ACTS.map(a => () => agent(`${CTX}

YOUR JOB: build act ${a.id} (storyboard bars ${a.bars}) in ${P}/scenes/${a.file} (you own only this file and ${P}/review/act-${a.id}/). ${a.focus}
Use the production library (do not edit ${P}/dm or ${P}/tools; if you need a new primitive, write it locally in your scene file and mention it in your report). Library report:
${library}
Footage and assets (manifests in ${P}/capture/*/manifest.json):
${capSummary}
Follow SCRIPT.md lines and STORYBOARD.md shots for your bars exactly (wording, emphasis, fonts, entrances), land actions and text hits on the beats of the flipping-in tempo map, keep motion alive (no still over 2.5 s), make the real product look gorgeous (crisp punch-ins on details, clean crops, no half-loaded UI). Render your act with music via the library's one-command preview, then LOOK at it: extract frames at every beat for a contact sheet and read it; fix weak frames, clutter, illegible text, off-beat events; iterate at least twice. Run the library QC on your act range. Return: file, act duration, QC result, contact sheet path, known issues.${a.id !== 'A5' ? '\n\nRESUME NOTE: a previous run of this exact task was cut off when the session ended. Your scene file and ' + P + '/review/act-' + a.id + '/ already hold that work: read them first, keep what is good, finish what is missing, then render, review and QC as above. Do not start over.' : ''}`, { label: `act:${a.id}`, phase: 'Acts', model: M }).then(r => ({ id: a.id, report: r }))))

phase('Assemble')
const assembled = await agent(`${CTX}

YOUR JOB: assemble the full film v1. Folder ${P}/out/ (you own it) and ${P}/scenes/film.js (the master timeline that strings ${P}/scenes/act-*.js together).
Act reports:
${acts.map(a => `- ${a.id}: ${(a.report || 'FAILED').slice(0, 1200)}`).join('\n')}
Library: ${library.slice(0, 2500)}
1. String all acts (A0-A1 from ${P}/scenes/act-A0-A1.js, then A2-A3, A4, A5, A6-A7) on the flipping-in tempo map; fix seams (transitions across act boundaries, no doubled titles, continuous rhythm).
2. Audio: music bed from the tempo map + SFX from the event log; -16 LUFS integrated, true peak ≤ -1 dBTP; no silence gaps; music fades under the end card.
3. Render the full cut: ${P}/out/music-space-video-v1.mp4 (1920x1080, 60 fps, H.264 High, 150-300 MB, ≤175 s). Run the full QC and save qc-v1.json; contact sheets: one frame per bar (90-up grid, several PNG pages) and a 16-up overview.
4. Cover (form field 07, 16:9): ${P}/out/cover-1920x1080.png and .jpg (and 1280x720) — the title card look (「同一刻，另一面。」 + the product in a hand-drawn phone + polaroids), crisp, legible as a thumbnail; read FORM-DRAFT.md's cover concept.
5. A credits/licence note ${P}/out/CREDITS.md (music source, licence, proof path; fonts and their licences; AI images provenance; all SFX code-generated).
Return: paths, durations, sizes, QC summary, any act that failed or needed patching.`, { label: 'video:assemble', phase: 'Assemble', model: M })

phase('Review')
const LENSES = [
  { id: 'art', task: 'ART DIRECTION AND IMPACT: does it look like an award-winning, cohesive hand-drawn Doodle film that shows off the real product? Find weak, cluttered, cheap-looking, repetitive or confusing moments; places where product footage is too small or unreadable; inconsistent styling; moments that should hit harder.' },
  { id: 'rhythm', task: 'RHYTHM AND SYNC: measure every cut, text entrance and pop against the music beat grid (event log + frame analysis); find off-beat events, sections where the energy of the picture does not match the music, holds without motion over 2.5 s, transitions that blur the beat, the payoff not landing on the downbeat.' },
  { id: 'read', task: 'READABILITY OF THE NARRATION (it is the subtitle track): every line on screen long enough (≥0.25 s per Chinese character, min 0.8 s), big enough at 1080p and when the video is watched small on a phone (simulate a 390-px-wide playback), contrast against busy backgrounds, reading order clear when several texts appear, nothing cut by the title-safe area, no missing glyphs.' },
  { id: 'truth', task: 'ACCURACY AND COMPLIANCE: every claim true of the product (compare with SCRIPT.md §4 and the build), privacy wording exactly the product\'s, AI images labelled, no third-party images/logos/real people, the 「设想」 framing for TME platforms, end-card link and QR correct, music credit and licence correct, nothing that would embarrass the team in front of TME judges.' },
]
const findings = await parallel(LENSES.map(l => () => agent(`${CTX}

YOU REVIEW the full film v1: ${P}/out/music-space-video-v1.mp4 (assembly report: ${assembled.slice(0, 2000)}).
LENS — ${l.task}
Extract frames, sheets and measurements as needed under ${P}/review/${l.id}/. Report only real problems, each with a timestamp (mm:ss.ff and storyboard bar), the act owner (A0-A1, A2-A3, A4, A5, A6-A7 or assembly/audio), severity (must-fix, should-fix, nice), what is wrong and the concrete fix. At most 20 notes, most important first.`, { label: `review:${l.id}`, phase: 'Review', model: M }).then(r => ({ lens: l.id, notes: r }))))

phase('Polish')
const polished = await agent(`${CTX}

YOU POLISH the film to v2 (final unless the owner changes something). You may edit any file under ${P}/scenes, ${P}/out, ${P}/capture (new host-side captures only) and ${V}/script/SCRIPT.md (and ${P}/dm or ${P}/tools only for real library bugs). If ${P}/out already holds partial v2 work from an interrupted earlier run of this task, reuse what is good.
Review notes from four independent reviewers:
${findings.map(f => `=== ${f.lens}\n${(f.notes || 'no notes').slice(0, 6000)}`).join('\n\n')}
0. OWNER POSITIONING CHANGE (2026-10-07, highest priority, do this first): the owner says the music community (音乐社群) is meant for LIVEHOUSE VENUES — a venue uses Music Space to maintain its own local music community, which gives venues a reason to promote it to their audiences. The film currently frames the community as an audience feature and its WHY-IT-MATTERS beat as a vision for QQ音乐/酷狗. Change it, keeping every claim true of the product (product facts: a host opens a room with 「我是主办方，开个房」 and a 场地 field; each show room can be linked to the host's 「长期音乐社群」 (「本场主办方的长期社群」, 「绑定我维护的长期空间」); the host can publish the next show to members (「确认向本社群成员发布活动资料」, 「活动预告是主办方自填信息」) and give members invite codes (「每人仍需同意入场」); members join by choice, 「不订阅营销，不扩大照片权限」 — so never say push marketing, ads, automatic entry or that members get old photos).
   (a) A5 community beat (SCRIPT T104-T106, bars 65-67): make it read as the venue's community, e.g. T104 「Livehouse 的【长期社群】，」, T105 「也给你留一个【位置】。」, T106 「再见，在【下一场】。」 (same timing and recipes).
   (b) A6 bars 73-77 (T120-T125, now 「每一场演出，都可以多一层。」 + 设想 QQ音乐、酷狗 + 「听完现场，顺手换一面。」): replace with the venue story, about four bars, e.g. 73:1 「Livehouse 开个房，」 · 74:1 「乐迷留在【本地社群】。」 · 75:1 「下一场的【预告】，」 · 75:3 「直接发给社群。」 · 76:1 「场地有了自己的乐迷，」 · 76:3 「更愿意【推广】。」 over real footage of the host side (the 「我是主办方，开个房」 sheet, the long-term community panel, the event/预告 card or 发布活动资料 form; capture these from ${BUILD} with the proven rig in ${P}/capture/ if the existing captures lack them). If it fits without clutter, keep one small honest label for the platform vision, e.g. a 「设想」 sticker with 「也可以接进 QQ音乐、酷狗 的演出页」 in M 56px; otherwise drop it. Keep the pillars T126-T128 (隐私 / 同意 / 好玩) and 「曲终，人不散。」 unchanged.
   (c) Keep line lengths, reading time (>=0.25 s per character), beat alignment and the two-layered-titles limit; run glyph checks on every new string (avoid 入/个/· in raw Display; use the product's patched slices or other fonts). Update ${V}/script/SCRIPT.md (the changed lines, marked as changed 2026-10-07) so the script stays the source of truth.
0b. OWNER (2026-10-07): 「去掉那些说明性文字，这个产品必须是完整的」 — the film must present a complete product, not a demo that keeps explaining itself. Remove explanatory/disclaimer overlays and labels from the picture: the 「照片为 AI 生成的示例图」 corner labels, 「示例角色 · 自动回复」 and similar tags, 「示例照片 · 拍摄时间为虚构」-style notes, caveat stickers whose only job is to explain, and any small print that explains instead of showing. Keep exactly one small credits line on the end card (e.g. 「演示角色与照片为虚构，照片由 AI 生成 · 配乐：…（CC0）」) unless the owner later says otherwise. The product copy itself is being revised (its explanatory UI text will be removed and the affected shots re-captured later), so for now prefer crops and punch-ins that keep long explanatory UI paragraphs out of frame, and list in RELEASE-NOTES.md every shot whose footage shows explanatory product text, so it can be re-captured.
1. Fix every must-fix and should-fix that you can confirm (check each against the film first; skip false ones with a reason). Nice-to-haves only if cheap.
2. Re-render ${P}/out/music-space-video-v2.mp4 (same spec), re-run the full QC (qc-v2.json), regenerate contact sheets and the cover if affected.
3. Write ${P}/out/RELEASE-NOTES.md: what changed v1→v2, QC summary, how to switch the music to another option (exact commands with the tempo maps), and what the owner must check by ear (music choice, SFX levels).
Return a short report with final paths, duration, size, QC result, and remaining issues.`, { label: 'video:polish', phase: 'Polish', model: M })

return { captures: captures.map(c => c.label + ': ' + (c.report || 'FAILED').slice(0, 400)), library: library.slice(0, 1500), acts: acts.map(a => a.id + ': ' + (a.report || 'FAILED').slice(0, 600)), assembled: assembled.slice(0, 2000), reviews: findings.map(f => f.lens + ': ' + (f.notes || '').slice(0, 800)), polished }
