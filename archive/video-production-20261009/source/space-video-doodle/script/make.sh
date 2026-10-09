#!/bin/sh
# Rebuild everything from src/edit_data.py (+ src/form_text.py):  sh make.sh
set -e
cd "$(dirname "$0")"
python3 src/build.py > /dev/null            # timeline.json + fragments (first pass)
node src/measure_widths.cjs                  # real line widths in Chrome (raw TTFs)
node src/glyph_check.cjs > /dev/null         # every character exists in its font
python3 src/build.py | grep -v '^PASS  shot' # second pass uses the measured widths; prints the checks
python3 retime.py --bpm 124 --out out/retimed-124.json --csv out/retimed-124.csv --srt out/narration-124.srt
python3 src/compose.py                       # SCRIPT.md, STORYBOARD.md, FORM-DRAFT.md
