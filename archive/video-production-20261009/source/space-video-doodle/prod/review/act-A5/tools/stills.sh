#!/bin/bash
# stills.sh <outdir> <map> <positions,comma,separated>  -> renders stills via render.mjs, renames them <bar>_<beat>.png, makes sheets
OUT=$1; MAP=$2; POS=$3; COLS=${COLS:-3}; W=${W:-640}
cd /tmp/space-video-doodle/prod
mkdir -p "$OUT"
node tools/render.mjs --scene act-A5 --map $MAP --stills "$POS" --dir "$OUT" 2>&1 | grep -v "^\[console\]" | grep -E " still |warn|error|Error" | while read a b c path pos rest; do
  if [ -f "$path" ]; then mv "$path" "$OUT/${pos//:/_}.png"; else echo "$a $b $c $path $pos $rest"; fi
done
/tmp/space-video-doodle/music-cc0/tools/venv-ana/bin/python /tmp/space-video-doodle/prod/review/act-A5/tools/sheet.py "$OUT" "$OUT/sheet" $COLS $W 12
