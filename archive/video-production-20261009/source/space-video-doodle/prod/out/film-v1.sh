#!/bin/zsh
# Music Space · Doodle video — the full cut v1: every act through scenes/film.js on one page, the whole tempo-map duration,
# music bed + synthesized SFX mixed to -16 LUFS / TP <= -1 dBTP, size-targeted H.264 encode, full QC, band check, contact sheets.
#
#   out/film-v1.sh [map] [name]        e.g. out/film-v1.sh flipping-in   ->  out/music-space-video-v1.mp4 (+ companions, qc-v1.json)
#   env: WORKERS (default 6), PRESET (default slow), CRF (default 18), TARGET (default 150-300 MB), STRIDE (geometry, default 3),
#        RESUME=1 reuses the kept chunks in out/work/chunks (delete the chunks whose bars changed first)
# ~10 500 frames: run it in the background and poll the log (out/logs/film-v1.log).
set -e
PROD=/tmp/space-video-doodle/prod
PY=/tmp/space-video-doodle/music-cc0/tools/venv-ana/bin/python
MAP=${1:-flipping-in}
NAME=${2:-music-space-video-v1}
cd $PROD
OUT=out/$NAME
mkdir -p out/logs out/contact
echo "== film v1  map $MAP  scene film (scenes/film.js -> act-A0-A1, act-A2-A3, act-A4, act-A5, act-A6-A7)  -> $OUT.mp4"
$PY tools/tempo.py compile $MAP > /dev/null
node out/tools/render-film.mjs --scene film --map $MAP \
  --info $OUT.info.json --geom $OUT.geom.json --stride ${STRIDE:-3} --glyphs $OUT.glyphs.json \
  --video $OUT.mp4 --mix --workers ${WORKERS:-6} --preset ${PRESET:-slow} --crf ${CRF:-18} --target-mb ${TARGET:-150-300} --keep ${RESUME:+--resume} 2>&1 | grep --line-buffered -v '^\[console\]'
QCJ=out/qc-v1.json; [[ "$NAME" != music-space-video-v1 ]] && QCJ=$OUT.qc.json
$PY tools/qc.py $OUT.mp4 --full --final --out $QCJ
$PY out/tools/bandcheck.py $OUT.mp4 30 | tee $OUT.bandcheck.txt
$PY out/tools/sheets.py $OUT.mp4 --map $MAP
echo "== done: $OUT.mp4  (QC: $QCJ, $OUT.qc.txt)"
