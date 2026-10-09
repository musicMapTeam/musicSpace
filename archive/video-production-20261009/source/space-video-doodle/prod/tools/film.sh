#!/bin/zsh
# The full cut: every scenes/act-*.js (name order) in one page, the whole tempo-map duration, size-targeted encode, full QC.
#   tools/film.sh [map] [out-name]          e.g. tools/film.sh flipping-in   ->  out/film/music-space.<map>.mp4
#   env: WORKERS (default 5), PRESET (default slow), TARGET (default 150-300 MB)
# Takes ~20-30 min of CPU on this machine (10 500 frames): run it in the background and poll the log.
set -e
PROD=/tmp/space-video-doodle/prod
PY=/tmp/space-video-doodle/music-cc0/tools/venv-ana/bin/python
MAP=${1:-flipping-in}
NAME=${2:-music-space.$MAP}
cd $PROD
SCENES=$(ls scenes/act-*.js | sed 's#scenes/##; s#\.js$##' | sort | paste -sd, -)
[[ -z "$SCENES" ]] && { echo "no scenes/act-*.js"; exit 1; }
OUT=out/film/$NAME
mkdir -p out/film
echo "== film  map $MAP  scenes $SCENES  -> $OUT.mp4"
$PY tools/tempo.py compile $MAP > /dev/null
node tools/render.mjs --scene $SCENES --map $MAP \
  --info $OUT.info.json --geom $OUT.geom.json --stride ${STRIDE:-4} --glyphs $OUT.glyphs.json \
  --video $OUT.mp4 --mix --workers ${WORKERS:-5} --preset ${PRESET:-slow} --crf ${CRF:-18} --target-mb ${TARGET:-150-300} 2>&1 | grep --line-buffered -v '^\[console\]'
$PY tools/qc.py $OUT.mp4 --full
$PY tools/contact.py $OUT.mp4 $OUT.contact.png --per-bar 2.6 --cols 6
echo "== done: $OUT.mp4  (QC: $OUT.qc.txt)"
