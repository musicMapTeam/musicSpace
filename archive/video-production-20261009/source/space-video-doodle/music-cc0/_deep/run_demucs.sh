#!/bin/bash
cd /tmp/space-video-doodle/music-cc0/_deep
for f in full/*; do
  b=$(basename "${f%.*}")
  [ -s "sep/htdemucs/$b/vocals.mp3" ] && continue
  /tmp/space-video-doodle/music-cc0/tools/venv-sep/bin/python -m demucs -n htdemucs -d mps --mp3 --mp3-bitrate 192 -o sep "$f" > /dev/null 2>&1
  echo "done $b" 
done
echo ALLDONE
