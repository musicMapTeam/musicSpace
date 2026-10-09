#!/bin/zsh
# tools/act.sh for act A0-A1, with every output in review/act-A0-A1-v3/render/ (same steps: render + mix, QC, contact sheet).
#   review/act-A0-A1-v3/tools/run-act.sh <name> [map]
set -e
PROD=/tmp/space-video-doodle/prod
PY=/tmp/space-video-doodle/music-cc0/tools/venv-ana/bin/python
NAME=${1:?name}; MAP=${2:-flipping-in-b}
cd $PROD
OUT=review/act-A0-A1-v3/render/$NAME
mkdir -p review/act-A0-A1-v3/render
echo "== act-A0-A1  map $MAP  bars 1:1 -> 21:1  -> $OUT.mp4"
$PY tools/tempo.py compile $MAP > /dev/null
node tools/render.mjs --scene act-A0-A1 --map $MAP --from 1:1 --to 21:1 \
  --info $OUT.info.json --geom $OUT.geom.json --stride ${STRIDE:-3} --glyphs $OUT.glyphs.json \
  --video $OUT.mp4 --mix --workers ${WORKERS:-4} --crf ${CRF:-18} --preset ${PRESET:-medium} ${RESUME:+--resume} 2>&1 | grep --line-buffered -v '^\[console\]'
$PY tools/qc.py $OUT.mp4
$PY tools/contact.py $OUT.mp4 $OUT.contact.png
echo "== done: $OUT.mp4"
