#!/bin/zsh
# final AFTER screenshots for the photos owner: the judge route at 390 / 1440 / 320, the own-photo path, and the PNG export
cd /tmp/space-doodle/photos-tools
export SHOTS_OUT=/tmp/space-doodle/shots/photos
node shots.js after phone > final-phone.log 2>&1
node shots.js after desktop > final-desktop.log 2>&1
node shots.js after narrow > final-narrow.log 2>&1
node own-photo.js phone after-own > final-own-phone.log 2>&1
node own-photo.js desktop after-own > final-own-desktop.log 2>&1
node own-photo.js narrow after-own > final-own-narrow.log 2>&1
node png.js after > final-png.log 2>&1
echo done > final-done.flag
