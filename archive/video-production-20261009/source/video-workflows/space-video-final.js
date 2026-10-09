export const meta = {
  name: 'space-video-final',
  description: 'Video v3 (final): re-capture every shot on the rc.2 build (new copy + Doodle Music Map), update all acts, add the Music Map beat, apply every review note, assemble, 4-lens review with full notes, polish, final render + cover',
  phases: [
    { title: 'Re-capture', detail: 'phone P1, phone P2/P3 + cut-outs, desktop, host + Music Map' },
    { title: 'Acts', detail: 'five act owners switch to new footage, fix quoted UI strings, apply review notes; A5 gains the Music Map beat' },
    { title: 'Assemble', detail: 'film v3, mix, render, QC, cover' },
    { title: 'Review', detail: 'art, rhythm, readability, accuracy — full notes saved to files' },
    { title: 'Polish', detail: 'apply every confirmed note, final render, final QC, release notes' },
  ],
}

const V = '/tmp/space-video-doodle'
const P = '/tmp/space-video-doodle/prod'
const REPO = '/Users/alakazan/workplace/tme/musicSpace'
const BUILD = '/tmp/space-final/dist-pages'
const M = 'opus'

const CTX = `We are finishing the competition video for Music Space (TME university AI hackathon; submission due 2026-10-09 23:59; rules: at most 3:00 — keep the film at or under 175 s —, at most 500 MB, carries narration or subtitles, no watermark or noise; judged on user value, feasibility, innovation). The film v2 exists: ${P}/out/music-space-video-v2.mp4 (2:54.67, Doodle style, kinetic-typography narration = the subtitle track, Wax Lyricist 《Flipping In》 CC0 on the flipping-in-b map), built with the production library ${P}/dm, tools ${P}/tools (render, mix, QC, tempo maps), scenes ${P}/scenes/act-*.js + film.js, captures ${P}/capture/*, script ${V}/script/SCRIPT.md (source of truth), storyboard ${V}/script/STORYBOARD.md, release notes ${P}/out/RELEASE-NOTES.md (its §5 lists every shot whose footage shows old product text).

WHAT CHANGED IN THE PRODUCT SINCE THE FOOTAGE (the owner's decisions of 2026-10-07): (1) all explanatory/demo/disclaimer copy is gone from the UI — cast names have no 「·示例」 (阿遥, 小满, 北屿, 林间), 「进入现场」, onboarding 「第一次来 n/4」, ready-made photos 「人海那张」/「舞台那张」, footer 「关于 Music Space」, live status 「现场进行中」, one disclosure line only in About; (2) the host side and the long-term community are for Livehouse venues (「我是 Livehouse / 主办方，开个房」, 「月台 Livehouse 乐迷社群」, 「下一场预告」); (3) the embedded Music Map (「音乐探索」) is now Doodle too: a paper courtyard and record table where you start from a singer and follow real duets to the next singer and song, each duet with a 「来源」 button. Glossary and every new string: /tmp/space-copy/COPY-PLAN.md. The new build (0.22.0-rc.2 content) to film: ${BUILD} — serve it with: cd ${REPO} && node scripts/pages/serve-prefix.mjs ${BUILD} /musicSpace/ <free port>. Never modify ${REPO} or ${BUILD}.

FILM RULES (unchanged): kinetic typography on beats, no still over 2.5 s, real product footage looks gorgeous, the film itself carries no explanatory overlays (exactly one small credits line on the end card: 「演示角色与照片为虚构，照片由 AI 生成 · 配乐：Wax Lyricist《Flipping In》（CC0）」), no TME logos, privacy wording from the product (「AI 在本机判断，照片不上传」, 「双方同意，才交换」, 「随时可以撤销」), music stays Flipping In unless told otherwise, claims about real singers only as the product shows them (names on the map; no invented facts). Nobody can listen on this machine: judge audio by measurement. Keep every shell command under 5 minutes (background + poll); stop servers/browsers you start; write only in your own folders/files as named.`

phase('Re-capture')
const TAKES = [
  { id: 'P1', task: `Re-run TAKE-P1 (the continuous phone judge route and every sub-clip it feeds; see ${P}/capture/P1/manifest.json and its scripts) on the new build. Update selectors and waits for the new copy (e.g. 「进入现场」, 「人海那张」, 「第一次来」, names without 「·示例」). Write to ${P}/capture/P1-rc2/ with the same shot ids and a manifest in the same format.` },
  { id: 'P2P3', task: `Re-run TAKE-P2 (the honest 「舞台那张」 → 「不确定，请选择」 case), TAKE-P3 and every §5 cut-out/export (avatar stickers, die-cut UI, polaroids, memory-card PNG, creation-corner PNG — note the cast now joins 双人纪念, so a finished keepsake can be exported) on the new build. Write to ${P}/capture/P2P3-rc2/ with the same asset ids plus any new ones, and a manifest.` },
  { id: 'desktop', task: `Re-run the desktop takes (3840x2160 masters + 1920x1080 copies; see ${P}/capture/desktop/manifest.json) on the new build. Write to ${P}/capture/desktop-rc2/ with the same shot ids and a manifest.` },
  { id: 'host-map', task: `Re-run the host/venue takes (${P}/capture/H1-host/: create-room form with 场地 「月台 Livehouse」, the venue's 乐迷社群, publishing a 下一场预告) on the new build into ${P}/capture/H1-host-rc2/, AND capture NEW Music Map footage (phone 1080x2340 and desktop 3840x2160 + 1080 copy, 60 fps, real GPU): from the room tap 「音乐探索」 → the record table round, pick or follow a duet, open its 「来源」 briefly, step to the next singer, a found song; plus a slow push over the paper courtyard. Write to ${P}/capture/map-rc2/ with action timestamps and a manifest.` },
]
const caps = await parallel(TAKES.map(t => () => agent(`${CTX}

YOUR JOB: capture ${t.id}. ${t.task}
Use the proven rig (controlled clock, lossless frames → ffmpeg H.264 CRF 14-16, yuv420p, BT.709, 60 fps, Chrome --use-angle=metal --enable-gpu). Verify every clip by frame sampling (no frozen frames during motion, no half-loaded UI, no old copy: grep the DOM text you film for 示例/虚构/本页 before recording each shot). Return a short report: files, ids, durations, action timestamps, problems.`, { label: `capture:${t.id}`, phase: 'Re-capture', model: M }).then(r => ({ id: t.id, report: r }))))
const capText = caps.map(c => `- ${c.id}: ${(c.report || 'FAILED').slice(0, 3000)}`).join('\n')

phase('Acts')
const ACTS = [
  { id: 'A0-A1', file: 'act-A0-A1.js', extra: '' },
  { id: 'A2-A3', file: 'act-A2-A3.js', extra: '' },
  { id: 'A4', file: 'act-A4.js', extra: '' },
  { id: 'A5', file: 'act-A5.js', extra: ` ADD THE MUSIC MAP BEAT: one beat of about two bars in the after-the-swap montage, using the new map footage (${P}/capture/map-rc2/): e.g. 「从一首合唱，」 / 「走到【下一位】歌手。」 with the record table and a duet paper (keep any narration true to what the map does; the product names it 「音乐探索」). Make room by tightening or replacing the weakest existing A5 beat so the film stays at or under 175 s; the act's total length must not grow. Also fix the thin music under bars 65-72 if the rhythm notes call for it (tempo-map change in ${P}/tools/tempo-maps/ is allowed for you only, coordinate by stating it in your report).` },
  { id: 'A6-A7', file: 'act-A6-A7.js', extra: ' Regenerate any end-card or credits element that embeds product screenshots from the new footage.' },
]
const acts = await parallel(ACTS.map(a => () => agent(`${CTX}

YOUR JOB: update act ${a.id} in ${P}/scenes/${a.file} (you own only this file, ${P}/review/act-${a.id}-v3/ and new local assets you create under ${P}/assets/v3/${a.id}/).
1. Switch every shot to the re-captured footage (manifests below; same shot ids). Keep crops and punch-ins clean; nothing of the old copy may remain visible.
2. Update narration and labels that quote the product (SCRIPT.md lines in your bars) so every quoted UI string matches the new build exactly (e.g. 「人海那张」, 「进入现场」, names without 「·示例」); update SCRIPT.md for your lines only, marked 2026-10-08.
3. Apply every review note that concerns your act and is not yet fixed: read ${P}/review/NOTES-v1-art.md, NOTES-v1-rhythm.md, NOTES-v1-read.md, NOTES-v1-truth.md in full, and ${P}/out/RELEASE-NOTES.md for what v2 already fixed.${a.extra}
4. Render your act with music via the library's one-command preview, extract a frame per beat, LOOK at the sheet, fix, iterate at least twice; run the library QC on your range.
Re-capture reports:
${capText}
Return: what changed, act duration, QC result, contact sheet path, open issues.`, { label: `act:${a.id}`, phase: 'Acts', model: M }).then(r => ({ id: a.id, report: r }))))

phase('Assemble')
const assembled = await agent(`${CTX}

YOUR JOB: assemble film v3 in ${P}/out/ (you own ${P}/scenes/film.js and ${P}/out/). Act reports:
${acts.map(a => `- ${a.id}: ${(a.report || 'FAILED').slice(0, 2500)}`).join('\n')}
String the acts on the working map (or the map A5 changed), fix seams, mix (music bed + SFX from the event log; -16 LUFS, true peak ≤ -1 dBTP), render ${P}/out/music-space-video-v3.mp4 (1920x1080, 60 fps, H.264 High, 150-300 MB, ≤175 s), full QC (qc-v3.json), contact sheets (one frame per bar + a 16-up overview), and regenerate the cover (${P}/out/cover-1920x1080.png/.jpg, 1280x720, 3840x2160) from the new footage so no old copy appears in it. Return paths, duration, size, QC summary.`, { label: 'video:assemble-v3', phase: 'Assemble', model: M })

phase('Review')
const LENSES = [
  { id: 'art', task: 'ART DIRECTION AND IMPACT: award-level, cohesive Doodle film that shows off the real product; weak, cluttered, cheap, repetitive or confusing moments; product footage too small; inconsistent styling; moments that should hit harder; the new Music Map beat and the Livehouse beats.' },
  { id: 'rhythm', task: 'RHYTHM AND SYNC: every cut, text entrance and pop against the beat grid; energy match between picture and music; holds without motion over 2.5 s; the payoff on the downbeat; the music under bars 65-72.' },
  { id: 'read', task: 'READABILITY: every narration line long enough on screen (≥0.25 s per Chinese character, min 0.8 s), big enough at 1080p and when watched 390 px wide, contrast on busy backgrounds, reading order, title-safe, glyphs.' },
  { id: 'truth', task: 'ACCURACY AND COMPLIANCE: every claim and every quoted UI string true of the rc.2 build (compare with the build and COPY-PLAN), no old product copy visible anywhere (示例, 虚构, 自动回复 …), privacy wording, no TME logos, credits line correct, link and QR correct (https://musicmapteam.github.io/musicSpace/), real singers only as the map shows them.' },
]
const reviews = await parallel(LENSES.map(l => () => agent(`${CTX}

YOU REVIEW film v3: ${P}/out/music-space-video-v3.mp4 (assembly report: ${assembled.slice(0, 3000)}).
LENS — ${l.task}
Work under ${P}/review/v3-${l.id}/. Write your COMPLETE notes to ${P}/review/NOTES-v3-${l.id}.md (every note: timestamp mm:ss.ff and bar, act owner, severity must/should/nice, problem, concrete fix). Return a one-paragraph summary with the note counts and the file path.`, { label: `review:${l.id}`, phase: 'Review', model: M }).then(r => ({ id: l.id, summary: r }))))

phase('Polish')
const final = await agent(`${CTX}

YOU POLISH film v3 into the FINAL film. You may edit ${P}/scenes/**, ${P}/out/**, ${P}/tools/tempo-maps/** and SCRIPT.md (and ${P}/dm or ${P}/tools only for real library bugs).
Read ALL review notes in full: ${P}/review/NOTES-v3-art.md, NOTES-v3-rhythm.md, NOTES-v3-read.md, NOTES-v3-truth.md (summaries: ${reviews.map(r => `${r.id}: ${(r.summary || '').slice(0, 400)}`).join(' | ')}).
1. Fix every must and should you can confirm against the film (reject false ones with a reason in the release notes); cheap nice-to-haves too.
2. Render ${P}/out/music-space-video-final.mp4 (same spec, ≤175 s, 150-300 MB), run the full QC (qc-final.json), regenerate contact sheets and the cover if affected (cover-final-1920x1080.png/.jpg plus 1280x720).
3. Write ${P}/out/RELEASE-NOTES-final.md: v2 → final changes, every review note's outcome, QC summary, what the owner should check by ear.
Return a short report with final paths, duration, size, QC result, remaining issues.`, { label: 'video:polish-final', phase: 'Polish', model: M })

return { captures: caps.map(c => `${c.id}: ${(c.report || 'FAILED').slice(0, 300)}`), acts: acts.map(a => `${a.id}: ${(a.report || 'FAILED').slice(0, 400)}`), assembled: assembled.slice(0, 1500), reviews, final }
