#!/bin/zsh
# usage: tools/run.sh file.js   -> POSTs the JS body to the exploration driver
curl -s -X POST --data-binary @"$1" http://127.0.0.1:${DRIVER_PORT:-48751}/run
