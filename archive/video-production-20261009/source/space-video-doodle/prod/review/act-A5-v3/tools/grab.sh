#!/bin/zsh
# grab.sh <video> <outdir> <tag> f1 f2 ...   -> <outdir>/<tag>-f<n>.png (exact frame n, decoded BT.709 tv -> RGB)
V=$1; OUT=$2; TAG=$3; shift 3
mkdir -p $OUT
for n in "$@"; do
  /opt/homebrew/bin/ffmpeg -v error -y -i "$V" -vf "select=eq(n\,$n),scale=in_color_matrix=bt709:in_range=tv:out_range=pc:flags=accurate_rnd+full_chroma_int,format=rgb24" -frames:v 1 "$OUT/$TAG-f$n.png"
done
