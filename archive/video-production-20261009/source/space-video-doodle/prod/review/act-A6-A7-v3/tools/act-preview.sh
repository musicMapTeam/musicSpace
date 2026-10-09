#!/bin/zsh
# The library's one-command act preview (tools/act.sh: render with music + SFX, QC, contact sheet), same commands, with the output in
# this review folder and the range running to the film's last frame (act.sh stops at 91:1 = the grid end; the end card lasts to DM.end()).
#   act-preview.sh <tag> [map] [from] [to]
set -e
PROD=/tmp/space-video-doodle/prod
PY=/tmp/space-video-doodle/music-cc0/tools/venv-ana/bin/python
TAG=${1:?tag}; MAP=${2:-flipping-in-b}; FROM=${3:-73:1}; TO=${4:-end}
cd $PROD
if [[ $TO == end ]]; then
  TO=f$(node tools/render.mjs --scene act-A6-A7 --map $MAP --at 89:1 --eval "Math.round(DM.end() * DM.cfg.fps)" 2>/dev/null | tail -1 | tr -d '"')
fi
OUT=review/act-A6-A7-v3/render/act-A6-A7.$MAP.$TAG
echo "== act-A6-A7 map $MAP $FROM -> $TO -> $OUT.mp4"
node tools/render.mjs --scene act-A6-A7 --map $MAP --from $FROM --to $TO \
  --info $OUT.info.json --geom $OUT.geom.json --stride ${STRIDE:-3} --glyphs $OUT.glyphs.json \
  --video $OUT.mp4 --mix --workers ${WORKERS:-4} --crf ${CRF:-18} --preset ${PRESET:-medium} ${RESUME:+--resume} 2>&1 | grep --line-buffered -v '^\[console\]'
$PY tools/qc.py $OUT.mp4
$PY tools/contact.py $OUT.mp4 $OUT.contact.png
echo "== done: $OUT.mp4"
