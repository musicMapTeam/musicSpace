#!/bin/sh
# Build the Route B static site from a SNAPSHOT of the repo and serve it like GitHub Pages.  Never touches the repo, its dist-pages or its node_modules.
#
#   sh snapshot-build.sh                  # snapshot of the repo WORKING TREE (uncommitted + untracked files included), build, serve on :47951
#   sh snapshot-build.sh --ref <commit>   # exact commit via `git archive` (use this for the frozen release candidate)
#   sh snapshot-build.sh --port 47960     # other port (QA range is 47100-47999)
#   sh snapshot-build.sh --stop           # kill the server this script started
#
# Prints the app root to use for the capture scripts:  SPACE_BASE=http://127.0.0.1:<port>/musicSpace/
# The server runs detached; its pid is in /tmp/space-video-prep/notes/routeb-serve.pid.  ALWAYS run --stop when the shoot is over.
set -eu
REPO=${SPACE_REPO_SRC:-/Users/alakazan/workplace/tme/musicSpace}
SNAP=${SNAP:-/tmp/space-video-prep/repo-routeb}
PORT=${PORT:-47951}
REF=""; STOP=0
while [ $# -gt 0 ]; do
  case "$1" in
    --ref) REF=$2; shift 2;;
    --port) PORT=$2; shift 2;;
    --stop) STOP=1; shift;;
    *) echo "unknown argument: $1" >&2; exit 2;;
  esac
done
NOTES=/tmp/space-video-prep/notes; mkdir -p "$NOTES"
PIDF=$NOTES/routeb-serve.pid
stop() { if [ -f "$PIDF" ]; then kill "$(cat "$PIDF")" 2>/dev/null || true; rm -f "$PIDF"; fi; }
if [ "$STOP" = 1 ]; then stop; echo "stopped"; exit 0; fi
stop

mkdir -p "$SNAP"
if [ -n "$REF" ]; then
  rm -rf "$SNAP.tmp"; mkdir -p "$SNAP.tmp"
  git -C "$REPO" archive "$REF" | tar -x -C "$SNAP.tmp"
  rsync -a --delete --exclude node_modules --exclude 'dist*' "$SNAP.tmp"/ "$SNAP"/
  rm -rf "$SNAP.tmp"
  COMMIT=$(git -C "$REPO" rev-parse --short "$REF")
else
  rsync -a --delete --exclude .git --exclude node_modules --exclude 'dist*' --exclude references --exclude archive --exclude native --exclude delivery --exclude docs "$REPO"/ "$SNAP"/
  COMMIT=$(git -C "$REPO" rev-parse --short HEAD)-wt
fi
[ -e "$SNAP/node_modules" ] || ln -s "$REPO/node_modules" "$SNAP/node_modules"
echo "snapshot: $SNAP  (commit $COMMIT, ref ${REF:-working tree})"

cd "$SNAP"
STATIC_COMMIT="$COMMIT" STATIC_BUILT_AT="$(date -u +%Y-%m-%dT%H:%M:%S.000Z)" STATIC_OUT="$SNAP/dist-pages" node scripts/pages/build.mjs

nohup node scripts/pages/serve-prefix.mjs "$SNAP/dist-pages" /musicSpace/ "$PORT" > "$NOTES/routeb-serve.log" 2>&1 &
echo $! > "$PIDF"
i=0; while [ $i -lt 40 ]; do
  if curl -sf -o /dev/null "http://127.0.0.1:$PORT/musicSpace/"; then break; fi
  i=$((i+1)); sleep 0.25
done
curl -sf -o /dev/null "http://127.0.0.1:$PORT/musicSpace/" || { echo "server did not come up, see $NOTES/routeb-serve.log" >&2; exit 1; }
echo "SPACE_BASE=http://127.0.0.1:$PORT/musicSpace/"
echo "serving $SNAP/dist-pages (pid $(cat "$PIDF")); stop with: sh $0 --stop"
