#!/bin/bash
cd /tmp/space-video-doodle/music-cc0/_deep
ls full2 | while read f; do
  b="${f%.*}"; id="${b%%__*}"
  [ -s "sep/htdemucs/$b/vocals.mp3" ] || continue
  if [ -s "out/$id/analysis.json" ] && grep -q '"energy_share"' "out/$id/analysis.json"; then continue; fi
  echo "$f"
done | tr '\n' '\0' | xargs -0 -P 3 -n 1 ./deep_one2.sh
