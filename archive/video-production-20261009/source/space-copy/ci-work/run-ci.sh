#!/bin/zsh
# CI-equivalent runner: each step logged separately; summary in summary.txt
cd /Users/alakazan/workplace/tme/musicSpace || exit 1
LOGS=/tmp/space-copy/ci-work/logs
SUM=/tmp/space-copy/ci-work/summary.txt
: > $SUM
step() {
  local name=$1; shift
  local t0=$(date +%s)
  echo "=== $name START $(date +%T)" >> $SUM
  ( eval "$@" ) > $LOGS/$name.log 2>&1
  local rc=$?
  local t1=$(date +%s)
  echo "=== $name END rc=$rc $((t1-t0))s $(date +%T)" >> $SUM
}
step 01-build-all 'npm run build:all'
step 02-ai-check 'npm run ai:check'
step 03-node-check 'node --check server/index.js && node --check server/db.js'
step 04-npm-test 'npm test'
step 05-test-release 'npm run test:release'
step 06-test-character 'npm run test:character'
step 07-build-pages 'rm -rf /tmp/space-copy/ci/dist-pages && mkdir -p /tmp/space-copy/ci && STATIC_OUT=/tmp/space-copy/ci/dist-pages npm run build:pages'
step 08-static-suite 'node scripts/test/static-suite.mjs'
step 09-static-build 'node scripts/test/static-build.test.mjs'
echo "=== ALL DONE $(date +%T)" >> $SUM
