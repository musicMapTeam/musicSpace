#!/bin/bash
# usage: go.sh <kind> <probe.js> [extra js prefix]
cd /tmp/space-doodle/social-fix
{ echo "globalThis.KIND='$1';$3"; cat "$2"; } > /tmp/space-doodle/social-fix/.run-$1-$$.js
curl -s --max-time 280 -X POST --data-binary @/tmp/space-doodle/social-fix/.run-$1-$$.js http://127.0.0.1:5297/run
rm -f /tmp/space-doodle/social-fix/.run-$1-$$.js
echo
