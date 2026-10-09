#!/bin/zsh
cd /tmp/space-video-doodle/prod/capture/desktop-rc2/tools
for t in D01 D02 D03 D03B D05 D06; do DRY=1 node takes.mjs $t > ../logs/dry-$t.log 2>&1; echo "$t exit $?" >> ../logs/dry-status.txt; done
echo done >> ../logs/dry-status.txt
