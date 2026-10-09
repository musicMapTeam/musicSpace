#!/bin/zsh
# tools/act.sh (the library's one-command act preview: render + music bed + SFX mix + QC + contact sheet), with every output kept in
# review/act-A4-v3/render/ instead of the shared out/acts/.   usage: act-preview.sh <map> [from to] [tag]
set -e
PROD=/tmp/space-video-doodle/prod
PY=/tmp/space-video-doodle/music-cc0/tools/venv-ana/bin/python
MAP=${1:-flipping-in-b}; FROM=${2:-41:1}; TO=${3:-55:1}; TAG=${4:-act-A4.$MAP}
OUT=review/act-A4-v3/render/$TAG
cd $PROD
mkdir -p review/act-A4-v3/render
echo "== act act-A4  map $MAP  bars $FROM -> $TO  -> $OUT.mp4"
node tools/render.mjs --scene act-A4 --map $MAP --from $FROM --to $TO \
  --info $OUT.info.json --geom $OUT.geom.json --stride ${STRIDE:-3} --glyphs $OUT.glyphs.json \
  --video $OUT.mp4 --mix --workers ${WORKERS:-4} --crf ${CRF:-18} --preset ${PRESET:-medium} 2>&1 | grep --line-buffered -v '^\[console\]'
$PY tools/qc.py $OUT.mp4
$PY tools/contact.py $OUT.mp4 $OUT.contact.png
echo "== done: $OUT.mp4  (QC: $OUT.qc.txt, contact sheet: $OUT.contact.png)"
