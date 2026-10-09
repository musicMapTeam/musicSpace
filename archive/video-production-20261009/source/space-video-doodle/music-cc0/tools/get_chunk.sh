#!/bin/bash
# usage: get_chunk.sh ID URL  -> chunks/ID.mp3 (1.2 MB starting at 40% of the file); URL may be a redirecting stream URL
ID="$1"; URL="$2"; OUT=/tmp/space-video-doodle/music-cc0/_screen/chunks/$ID.mp3
[ -s "$OUT" ] && exit 0
HDR=$(curl -sSIL -A "Mozilla/5.0" --max-time 30 -w 'EFFECTIVE=%{url_effective}\n' "$URL")
LEN=$(echo "$HDR" | grep -i '^content-length' | tail -1 | tr -dc '0-9')
EFF=$(echo "$HDR" | grep '^EFFECTIVE=' | tail -1 | sed 's/^EFFECTIVE=//')
[ -z "$LEN" ] && { echo "nolen $ID"; exit 0; }
START=$(( LEN * 40 / 100 )); END=$(( START + 1200000 )); [ $END -ge $LEN ] && END=$(( LEN - 1 ))
curl -sS -A "Mozilla/5.0" --max-time 90 -r $START-$END -o "$OUT.part" "$EFF" && mv "$OUT.part" "$OUT"
echo "$LEN $EFF" > "${OUT%.mp3}.len"
