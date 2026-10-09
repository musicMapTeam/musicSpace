#!/bin/sh
# Re-render every card (final quality: DPR 2 supersampled, 60 fps, mp4 + stills)
cd /tmp/space-video-prep/cards
rm -f out/*.png out/*.mp4
node render-card.mjs card-a-open.html card-a-open 5 3.4 2
node render-card.mjs card-b-pain.html card-b-pain 5 1.0,2.2,3.5,4.6 2
node render-card.mjs card-b2-groupalbum.html card-b2-groupalbum 5 1.0,2.0,3.2,4.6 2
node render-card.mjs card-b3-noopening.html card-b3-noopening 5 1.0,2.0,3.2,4.6 2
node render-card.mjs card-d-whatif.html card-d-whatif 5 0.8,2.0,3.2,4.6 2
node render-card.mjs card-c-end.html card-c-end 5 4.3 2
echo ALL_CARDS_DONE
