#!/bin/zsh
# Music Space · Doodle video — the full cut v2 (final unless the owner changes something): every act through scenes/film.js on one
# page, the whole tempo-map duration, music bed + synthesized SFX + the film's bed automation (out/tools/mix-film.py) mixed to
# -16 LUFS / TP <= -1 dBTP, size-targeted H.264 encode, full QC, band check, contact sheets.
#
#   out/film-v2.sh [map] [name]        default: flipping-in-b  ->  out/music-space-video-v2.mp4 (+ companions, out/qc-v2.json)
#   e.g. out/film-v2.sh original-124 music-space-video-v2-original     (another music option: see out/RELEASE-NOTES.md)
#   env: WORKERS (default 8), PRESET (default slow), CRF (default 18), TARGET (default 150-300 MB), STRIDE (geometry, default 3),
#        RESUME=1 reuses the kept chunks in out/work/chunks/<scene>__<map>__<range> (delete the chunks whose bars changed first)
# ~10 500 frames (~15-20 min render + ~5 min mix/encode + ~8 min QC/sheets): run it in the background and poll the log.
set -e
PROD=/tmp/space-video-doodle/prod
PY=/tmp/space-video-doodle/music-cc0/tools/venv-ana/bin/python
MAP=${1:-flipping-in-b}
NAME=${2:-music-space-video-v2}
cd $PROD
OUT=out/$NAME
mkdir -p out/logs out/contact
echo "== film v2  map $MAP  scene film (scenes/film.js -> act-A0-A1, act-A2-A3, act-A4, act-A5, act-A6-A7)  -> $OUT.mp4"
$PY tools/tempo.py compile $MAP > /dev/null
node out/tools/render-film.mjs --scene film --map $MAP \
  --info $OUT.info.json --geom $OUT.geom.json --stride ${STRIDE:-3} --glyphs $OUT.glyphs.json \
  --video $OUT.mp4 --mix --workers ${WORKERS:-8} --preset ${PRESET:-slow} --crf ${CRF:-18} --target-mb ${TARGET:-150-300} --keep ${RESUME:+--resume} 2>&1 | grep --line-buffered -v '^\[console\]'
QCJ=out/qc-v2.json; [[ "$NAME" != music-space-video-v2 ]] && QCJ=$OUT.qc.json
$PY tools/qc.py $OUT.mp4 --full --final --out $QCJ
$PY out/tools/bandcheck.py $OUT.mp4 30 | tee $OUT.bandcheck.txt
$PY out/tools/sheets.py $OUT.mp4 --map $MAP
echo "== done: $OUT.mp4  (QC: $QCJ, $OUT.qc.txt)"
