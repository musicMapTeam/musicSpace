#!/bin/zsh
# Music Space · Doodle video — the full cut v3 (2026-10-08): the five acts re-cut on the 0.22.0-rc.2 footage (the owner's 10-07 copy
# revision) through scenes/film.js on one page, the whole tempo-map duration, music bed + synthesized SFX + the film's bed automation
# (out/tools/mix-film.py) mixed to -16 LUFS / TP <= -1 dBTP, size-targeted H.264 encode, full QC, band check, contact sheets, and an
# OCR pass over the encoded film for old / explanatory product copy (out/tools/ocr-film.py).
#
#   out/film-v3.sh [map] [name]        default: flipping-in-b  ->  out/music-space-video-v3.mp4 (+ companions, out/qc-v3.json)
#   STEPS=render|qc|sheets|ocr|all (default all) runs one part (each part is long: run it in the background and poll the log)
#   env: WORKERS (default 8), PRESET (default slow), CRF (default 18), TARGET (default 150-300 MB), STRIDE (geometry, default 3),
#        RESUME=1 reuses the kept chunks in out/work/chunks/film__<map>__0-<frames> (delete the chunks whose bars changed first)
# ~10 500 frames (~10-15 min render + ~6 min mix/encode + ~8 min QC/sheets + ~4 min OCR).
set -e
PROD=/tmp/space-video-doodle/prod
PY=/tmp/space-video-doodle/music-cc0/tools/venv-ana/bin/python
MAP=${1:-flipping-in-b}
NAME=${2:-music-space-video-v3}
STEPS=${STEPS:-all}
cd $PROD
OUT=out/$NAME
mkdir -p out/logs out/contact
QCJ=out/qc-v3.json; [[ "$NAME" != music-space-video-v3 ]] && QCJ=$OUT.qc.json
if [[ $STEPS == all || $STEPS == render ]]; then
  echo "== film v3  map $MAP  scene film (scenes/film.js -> act-A0-A1, act-A2-A3, act-A4, act-A5, act-A6-A7)  -> $OUT.mp4"
  $PY tools/tempo.py compile $MAP > /dev/null
  node out/tools/render-film.mjs --scene film --map $MAP \
    --info $OUT.info.json --geom $OUT.geom.json --stride ${STRIDE:-3} --glyphs $OUT.glyphs.json \
    --video $OUT.mp4 --mix --workers ${WORKERS:-8} --preset ${PRESET:-slow} --crf ${CRF:-18} --target-mb ${TARGET:-150-300} --keep ${RESUME:+--resume} 2>&1 | grep --line-buffered -v '^\[console\]'
fi
if [[ $STEPS == all || $STEPS == qc ]]; then
  $PY tools/qc.py $OUT.mp4 --full --final --out $QCJ
  $PY out/tools/bandcheck.py $OUT.mp4 30 | tee $OUT.bandcheck.txt
fi
if [[ $STEPS == all || $STEPS == sheets ]]; then
  $PY out/tools/sheets.py $OUT.mp4 --map $MAP
fi
if [[ $STEPS == all || $STEPS == ocr ]]; then
  $PY out/tools/ocr-film.py $OUT.mp4 $OUT.ocr.json
fi
echo "== done: $OUT.mp4  (QC: $QCJ, $OUT.qc.txt)"
