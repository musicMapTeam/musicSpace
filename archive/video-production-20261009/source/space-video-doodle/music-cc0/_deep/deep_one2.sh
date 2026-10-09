#!/bin/bash
cd /tmp/space-video-doodle/music-cc0/_deep
f="$1"; b="${f%.*}"; id="${b%%__*}"
/tmp/space-video-doodle/music-cc0/tools/venv-ana/bin/python ../tools/deep.py "full2/$f" "out/$id" --stems "sep/htdemucs/$b" --title "${b#*__}" > "out-$id.log" 2>&1
echo "deep $id $?"
