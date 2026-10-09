#!/bin/zsh
# usage: q.sh file.js   or   echo 'js' | q.sh
if [ -n "$1" ]; then curl -s -X POST --data-binary @"$1" http://127.0.0.1:47841/run; else curl -s -X POST --data-binary @- http://127.0.0.1:47841/run; fi
