#!/bin/zsh
# Capture the three test clips + contact sheets against the production Doodle build (dist-pages served under /musicSpace/).
# Takes ~4-8 min depending on machine load: run it in the background and poll.  Never rebuilds or edits the repo.
set -e
cd /tmp/space-video-doodle/capture-test
PORT=${PORT:-47811}
if ! curl -sf -o /dev/null http://127.0.0.1:$PORT/musicSpace/; then
  (cd /Users/alakazan/workplace/tme/musicSpace && node scripts/pages/serve-prefix.mjs dist-pages /musicSpace/ $PORT > /tmp/space-video-doodle/capture-test/server.log 2>&1 &)
  STARTED=1; sleep 1.5
fi
export SPACE_BASE=http://127.0.0.1:$PORT/musicSpace/
node clip-a-phone-venue.mjs     > logs-clip-a.txt 2>&1
node clip-b-phone-upload.mjs    > logs-clip-b.txt 2>&1
node clip-c-desktop-exchange.mjs > logs-clip-c.txt 2>&1
node sheet.mjs clips/A-phone-venue.mp4 "A · 首屏 → 进场 → 三维机位" 40:"首屏：同一刻，另一面" 330:"推近 小满·示例（产品机位 1×）" 455:"拉远亮出全场（0.5× 慢放）" 690:"转到照片墙"
node sheet.mjs clips/B-phone-upload-ai-wall.mp4 "B · 人海示例照片 → AI 判断 → 照片墙" 30:"示例路线：人海 · 示例照片" 150:"AI 判断：人海（推近）" 256:"滚到「保存这张照片」" 430:"同一刻的另一面（推近）"
node sheet.mjs clips/C-desktop-exchange.mp4 "C · 发起交换 → 交换已接受" 40:"照片墙：和 TA 交换这个视角" 165:"两张拍立得 · 推荐那一张" 352:"勾选同意 → 交给对方确认" 760:"交换已接受"
for c in A-phone-venue B-phone-upload-ai-wall C-desktop-exchange; do /tmp/space-video-prep/tools/venv/bin/python analyze.py clips/$c.mp4 > clips/$c.qc.json; done
[ -n "$STARTED" ] && pkill -f "serve-prefix.mjs dist-pages /musicSpace/ $PORT" || true
echo done
