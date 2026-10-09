#!/bin/zsh
# tools/act.sh for act-A5, with every output in review/act-A5-v3/<tag>/ instead of out/acts (same steps, same tools, same flags):
#   render with music + SFX (render.mjs --mix, geometry + glyphs for QC), QC (tools/qc.py), contact sheet (tools/contact.py)
#   review/act-A5-v3/tools/act-a5.sh <tag> [map] [from] [to]
set -e
PROD=/tmp/space-video-doodle/prod
PY=/tmp/space-video-doodle/music-cc0/tools/venv-ana/bin/python
TAG=${1:?tag}; MAP=${2:-flipping-in-b}; FROM=${3:-55:1}; TO=${4:-73:1}
cd $PROD
OUTD=review/act-A5-v3/$TAG; mkdir -p $OUTD
OUT=$OUTD/act-A5.$MAP
echo "== act act-A5  map $MAP  bars $FROM -> $TO  -> $OUT.mp4"
$PY tools/tempo.py compile $MAP > /dev/null
node tools/render.mjs --scene act-A5 --map $MAP --from $FROM --to $TO \
  --info $OUT.info.json --geom $OUT.geom.json --stride ${STRIDE:-3} --glyphs $OUT.glyphs.json \
  --video $OUT.mp4 --mix --workers ${WORKERS:-4} --crf ${CRF:-18} --preset ${PRESET:-medium} 2>&1 | grep --line-buffered -v '^\[console\]'
$PY tools/qc.py $OUT.mp4
$PY tools/contact.py $OUT.mp4 $OUT.contact.png
echo "== done: $OUT.mp4  (QC: $OUT.qc.txt, contact sheet: $OUT.contact.png)"
