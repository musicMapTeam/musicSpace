#!/bin/bash
# run2.sh file.js -> prepends enter.inc.js
cat /tmp/space-doodle/fix/3d/tools/enter.inc.js "$1" | curl -s --max-time 290 -X POST --data-binary @- http://127.0.0.1:${PORT:-5493}/run; echo
