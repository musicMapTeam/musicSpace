#!/bin/bash
# grab.sh <video> <t0-of-video-in-film-seconds> <outdir> <map> pos1 pos2 ...   -> outdir/<bar>_<beat>.png (full-res decoded frames)
V=$1; T0=$2; OUT=$3; MAP=$4; shift 4
PY=/tmp/space-video-doodle/music-cc0/tools/venv-ana/bin/python
mkdir -p "$OUT"
cd /tmp/space-video-doodle/prod
$PY tools/tempo.py at $MAP "$@" | while read pos t rest; do
  rel=$(echo "$t - $T0 + 0.001" | bc -l)
  name=${pos//:/_}
  ffmpeg -v error -y -ss $rel -i "$V" -frames:v 1 "$OUT/$name.png"
done
ls "$OUT" | wc -l
