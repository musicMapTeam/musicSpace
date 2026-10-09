#!/bin/bash
# usage: run.sh file.js  OR  echo 'js' | run.sh
PORT=${PORT:-5493}
if [ -n "$1" ]; then curl -s --max-time 280 -X POST --data-binary @"$1" http://127.0.0.1:$PORT/run; else curl -s --max-time 280 -X POST --data-binary @- http://127.0.0.1:$PORT/run; fi
echo
