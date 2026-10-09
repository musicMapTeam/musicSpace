#!/bin/bash
# usage: run.sh file.js  OR  echo 'js' | run.sh
if [ -n "$1" ]; then curl -s --max-time 250 -X POST --data-binary @"$1" http://127.0.0.1:5291/run; else curl -s --max-time 250 -X POST --data-binary @- http://127.0.0.1:5291/run; fi
echo
