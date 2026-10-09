#!/bin/zsh
# P-22 with 阿宁 listed first (the product orders the two sides per world): retry a fresh world up to 5 times
cd /tmp/space-video-doodle/prod/capture/P2P3-rc2
for i in 1 2 3 4 5; do
  WANT_FIRST=阿宁 node tools/take-corner.mjs P-22 > logs/take-corner.log 2>&1; c=$?
  echo "attempt $i exit $c" >> logs/take-corner.attempts.log
  [ $c -eq 3 ] || break
done
