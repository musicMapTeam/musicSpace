#!/bin/bash
# Runs every audit walk against the served final build, 4 at a time. Logs in logs-final/, corpus in corpus-final/, shots in shots-final/.
cd /tmp/space-copy/final-work/audit
export SPACE_URL=http://127.0.0.1:5481/musicSpace/
export CORPUS=/tmp/space-copy/final-work/audit/corpus-final
export OUT=/tmp/space-copy/final-work/audit/shots-final
mkdir -p logs-final "$CORPUS" "$OUT"
RUNS=(
"w1-lobby.cjs phone" "w1-lobby.cjs desktop" "w1-lobby.cjs narrow" "w2-photos.cjs phone"
"w2-photos.cjs desktop" "w2-photos.cjs narrow" "w3-social.cjs phone" "w3-social.cjs desktop"
"w4-community.cjs phone" "w4-community.cjs desktop" "w4-community.cjs narrow" "w5-play.cjs phone cup"
"w5-play.cjs phone corner" "w5-play.cjs desktop corner" "w6-host.cjs phone" "w6-host.cjs desktop"
"w7-edges.cjs phone readonly" "w7-edges.cjs phone memory" "w7-edges.cjs phone aioff" "w7-edges.cjs phone rescue"
"w7-edges.cjs phone noscript" "w7-edges.cjs phone map" "w9-map.cjs phone" "w10-extra.cjs phone"
"w11-community-edges.cjs phone" "w12-more.cjs phone" "w13-share.cjs phone" "w14-pending.cjs phone"
"w15-reset.cjs phone" "fixcheck.cjs phone" "fixcheck.cjs desktop" "fixcheck.cjs narrow"
)
i=0
for run in "${RUNS[@]}"; do
  set -- $run
  name="$(basename $1 .cjs)-$2${3:+-$3}"
  ( node $run > "logs-final/$name.log" 2>&1; echo "rc=$?" >> "logs-final/$name.log" ) &
  i=$((i+1))
  if (( i % 4 == 0 )); then wait; fi
done
wait
echo ALL-DONE
