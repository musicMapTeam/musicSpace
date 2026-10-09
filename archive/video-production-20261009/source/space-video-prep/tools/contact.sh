#!/bin/sh
# usage: contact.sh clip.mp4 out.png "t1 t2 t3 ..." [cols=3] [w=640]   -> labelled contact sheet of frames at the given seconds
clip=$1; out=$2; times=$3; cols=${4:-3}; w=${5:-640}
tmp=$(mktemp -d); i=0
for t in $times; do
  ffmpeg -y -v error -ss "$t" -i "$clip" -frames:v 1 -vf "scale=$w:-2,drawbox=x=0:y=0:w=iw:h=0:t=0" "$tmp/$(printf %03d $i).png" 2>/dev/null; i=$((i+1))
done
n=$i; rows=$(( (n + cols - 1) / cols ))
ffmpeg -y -v error -pattern_type glob -i "$tmp/*.png" -filter_complex "tile=${cols}x${rows}:padding=4:color=black" -frames:v 1 "$out"
rm -rf "$tmp"
