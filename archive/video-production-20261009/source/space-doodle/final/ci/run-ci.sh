#!/bin/zsh
# CI-equivalent run (same order as .github/workflows), one log per step, stops at nothing: every step runs and records its exit code.
cd /Users/alakazan/workplace/tme/musicSpace
LOG=/tmp/space-doodle/final/ci
: > $LOG/status.txt
step() {
  local name=$1; shift
  local start=$(date +%s)
  echo "START $name $(date +%H:%M:%S)" >> $LOG/status.txt
  "$@" > $LOG/$name.log 2>&1
  local code=$?
  echo "END $name exit=$code $(( $(date +%s) - start ))s $(date +%H:%M:%S)" >> $LOG/status.txt
}
step 1-build-all npm run build:all
step 2-ai-check npm run ai:check
step 3-node-check zsh -c 'node --check server/index.js && node --check server/db.js'
step 4-npm-test npm test
step 5-test-release npm run test:release
step 6-test-character npm run test:character
step 7-build-pages npm run build:pages
step 8-test-static npm run test:static
echo "ALL DONE $(date +%H:%M:%S)" >> $LOG/status.txt
