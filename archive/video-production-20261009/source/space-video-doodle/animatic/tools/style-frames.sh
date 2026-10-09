#!/bin/zsh
# Renders the six 1920x1080 style frames from the two scenes (same motion system, settled beats), checks the QR, makes a contact sheet.
cd /tmp/space-video-doodle/animatic
O=out/style-frames
node tools/render.mjs --scene animatic --port 47931 --stills $(python3 tools/bt.py 6:4.4 9:2.9 13:4.4) --dir $O --names 01-title-card,02-pain-beat,03-room-in-phone
node tools/render.mjs --scene frames --port 47931 --stills $(python3 tools/bt.py 2:4.4 4:4.4 6:4.4) --dir $O --names 04-ai-chip,05-payoff-exchange-accepted,06-end-card-qr
echo -n "QR decodes to: "; node /tmp/space-video-prep/assembly/decode-qr.mjs $O/06-end-card-qr.png
/tmp/space-video-doodle/music-cc0/tools/venv-ana/bin/python tools/sheet.py $O/CONTACT-style-frames.png 3 640 "glob:=$O/0*.png"
