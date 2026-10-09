#!/bin/zsh
# usage: tools-strip.sh clip.mp4 out.png f1 f2 f3 ...   (clip-relative frame numbers; each frame scaled to 300 px wide, labelled)
clip=$1; out=$2; shift 2
sel=""; for f in "$@"; do sel="${sel}eq(n\\,$f)+"; done; sel=${sel%+}
n=$#
/opt/homebrew/bin/ffmpeg -v error -y -i "$clip" -vf "select='$sel',scale=300:-1:flags=area,tile=${n}x1:padding=4:color=white" -fps_mode passthrough -frames:v 1 "$out"
