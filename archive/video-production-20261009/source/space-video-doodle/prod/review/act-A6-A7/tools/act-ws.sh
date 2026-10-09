#!/bin/zsh
# One command: render an act (or any bar range) with its music + synthesized SFX, then QC it and make a contact sheet.
#
#   tools/act.sh act-A2                      # scene file scenes/act-A2.js, bars from its name (A2 = 21:1 -> 29:1), map flipping-in
#   tools/act.sh act-A0-A1 tea-party         # another music option (any tools/tempo-maps/<id>.json)
#   tools/act.sh act-A3 flipping-in 33:1 37:1    # just a bar range (end exclusive)
#   WORKERS=6 CRF=18 tools/act.sh act-A5     # env: WORKERS (default 4), CRF (default 18), PRESET (default medium), STRIDE (geometry, default 3)
#
# Outputs in prod/out/acts/<scene>.<map>[.<from>-<to>].* :
#   .mp4 (H.264 1080p60 + AAC) · .mix.wav(.json) audio + loudness report · .info.json scene log · .geom.json / .glyphs.json QC inputs
#   .qc.txt / .qc.json QC report · .contact.png one frame per bar · .render.json
# Long renders: run it in the background (it prints progress); an act of 8-14 bars takes a few minutes on this machine.
set -e
PROD=/tmp/space-video-doodle/prod
PY=/tmp/space-video-doodle/music-cc0/tools/venv-ana/bin/python
SCENE=${1:?usage: tools/act.sh <scene> [map] [from] [to]}
MAP=${2:-flipping-in}
FROM=$3; TO=$4
cd $PROD
if [[ -z "$FROM" ]]; then
  RANGE=$($PY - "$SCENE" <<'PY'
import re, sys
sys.path.insert(0, 'tools'); import tempo
acts = {a[0]: (a[2], a[3]) for a in tempo.ACTS}
ids = re.findall(r'A\d', sys.argv[1])
if not ids: sys.exit('cannot read the act range from the scene name; pass from/to bars')
b0 = min(acts[i][0] for i in ids); b1 = max(acts[i][1] for i in ids)
print(f'{b0}:1 {b1 + 1}:1')
PY
)
  FROM=${RANGE% *}; TO=${RANGE#* }
  TAG="$SCENE.$MAP"
else
  TAG="$SCENE.$MAP.${FROM//:/_}-${TO//:/_}"
fi
OUT=out/acts/$TAG
mkdir -p out/acts
echo "== act $SCENE  map $MAP  bars $FROM -> $TO  -> $OUT.mp4"
$PY tools/tempo.py compile $MAP > /dev/null
node /tmp/space-video-doodle/prod/review/act-A6-A7/tools/render-ws.mjs --scene $SCENE --map $MAP --from $FROM --to $TO \
  --info $OUT.info.json --geom $OUT.geom.json --stride ${STRIDE:-3} --glyphs $OUT.glyphs.json \
  --video $OUT.mp4 --mix --workers ${WORKERS:-4} --crf ${CRF:-18} --preset ${PRESET:-medium} 2>&1 | grep --line-buffered -v '^\[console\]'
$PY tools/qc.py $OUT.mp4
$PY tools/contact.py $OUT.mp4 $OUT.contact.png
echo "== done: $OUT.mp4  (QC: $OUT.qc.txt, contact sheet: $OUT.contact.png)"
