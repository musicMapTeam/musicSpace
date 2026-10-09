#!/bin/zsh
cd /tmp/space-video-doodle/prod/capture/desktop-rc2/tools
for t in D01 D02 D03 D03B D05 D06; do
  echo "$t start $(date +%H:%M:%S)" >> ../logs/takes-status.txt
  node takes.mjs $t > ../logs/take-$t.log 2>&1
  echo "$t exit $? $(date +%H:%M:%S)" >> ../logs/takes-status.txt
done
echo done >> ../logs/takes-status.txt
