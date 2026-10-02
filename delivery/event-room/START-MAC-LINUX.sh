#!/bin/sh
set -eu
cd "$(dirname "$0")"
command -v node >/dev/null 2>&1 || { echo 'Node.js 24 or newer is required. This package does not install software.'; exit 1; }
node -e "if(Number(process.versions.node.split('.')[0])<24)process.exit(1)" || { echo 'Please use Node.js 24 or newer.'; exit 1; }
export HOST=127.0.0.1
export DATA_DIR="$PWD/data"
echo 'The exact local address will appear after startup.'
echo 'Keep this terminal open. Ctrl+C stops the service.'
exec node server/launch-local.js
