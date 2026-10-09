#!/bin/zsh
# filmstrip of a video range:  tools/strip.sh video.mp4 first last step out.png [cols] [cellW]
V=$1; A=$2; Z=$3; S=$4; OUT=$5; C=${6:-4}; W=${7:-480}
D=$(mktemp -d /tmp/space-video-doodle/animatic/work/strip.XXXX)
/opt/homebrew/bin/ffmpeg -v error -y -i $V -vf "select='between(n,$A,$Z)*not(mod(n-$A,$S))',scale=$W:-2" -fps_mode vfr $D/f%03d.png
python3 - $D $A $S <<'PY'
import os,sys
d,a,s=sys.argv[1],int(sys.argv[2]),int(sys.argv[3])
for i,f in enumerate(sorted(os.listdir(d))): os.rename(f'{d}/{f}', f'{d}/{i:03d}_f{a+i*s:05d}.png')
PY
/tmp/space-video-doodle/music-cc0/tools/venv-ana/bin/python /tmp/space-video-doodle/animatic/tools/sheet.py $OUT $C $W "glob:=$D/*.png" && rm -rf $D
