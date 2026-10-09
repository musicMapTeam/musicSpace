#!/bin/zsh
# One frame per beat (each beat + OFFSET beats) from a rendered act preview, labelled bar:beat, 8 per row -> PNG sheets (2 bars a row).
#   beatsheet.sh <video.mp4> <outprefix> [map] [offset=0.4]
set -e
PROD=/tmp/space-video-doodle/prod
PY=/tmp/space-video-doodle/music-cc0/tools/venv-ana/bin/python
VID=$1; OUTP=$2; MAP=${3:-flipping-in-b}; OFF=${4:-0.4}
cd $PROD
F0=$(python3 -c "import json;print(json.load(open('${VID%.mp4}.render.json'))['frames'][0])")
POS=$(node tools/render.mjs --scene act-A6-A7 --map $MAP --at 89:1 --eval "JSON.stringify((() => { const o = []; for (let b = 73; b <= 90; b++) for (let k = 1; k <= 4; k++) { const p = b + ':' + (k + $OFF); const t = DM.T(p); if (t !== null && t < DM.end() - 0.02) o.push([p, Math.round(t * 60)]); } const e = DM.end(); o.push(['end-0.1s', Math.round((e - 0.1) * 60)]); return o; })())" 2>/dev/null | tail -1)
echo "$POS" | python3 -c "
import json,sys,subprocess,os
s=sys.stdin.read().strip()
s=json.loads(json.loads(s)) if s.startswith('\"') else json.loads(s)
f0=$F0; vid='$VID'; outp='$OUTP'
os.makedirs(outp+'-frames', exist_ok=True)
items=[]
for lab,f in s:
    n=f-f0
    png=f'{outp}-frames/{lab.replace(\":\",\"_\")}.png'
    subprocess.run(['ffmpeg','-v','error','-y','-ss',f'{n/60:.4f}','-i',vid,'-frames:v','1',png],check=True)
    items.append(f'{lab}={png}')
open(outp+'-items.txt','w').write('\n'.join(items))
print(len(items),'frames')
"
N=$(wc -l < $OUTP-items.txt); N=$((N+1))
ITEMS=("${(@f)$(cat $OUTP-items.txt)}")
i=0; part=1
while (( i < ${#ITEMS[@]} )); do
  $PY -I $PROD/review/act-A6-A7-v3/tools/sheet.py $OUTP-p$part.png 4 640 "${ITEMS[@]:$i:16}"
  i=$((i+16)); part=$((part+1))
done
