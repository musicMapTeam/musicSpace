import json, sys
sys.path.insert(0,'/tmp/space-video-doodle/animatic/music-pick')
from rhythm_compare import metrics
C=[('02-flipping-in groove bars 53-60','02-flipping-in__Wax-Lyricist/Wax_Lyricist_-_Flipping_In.mp3','02-flipping-in__Wax-Lyricist/beats.json',53,61),
   ('02-flipping-in groove+bass bars 75-84','02-flipping-in__Wax-Lyricist/Wax_Lyricist_-_Flipping_In.mp3','02-flipping-in__Wax-Lyricist/beats.json',75,85),
   ('02-flipping-in pain (no drums) bars 67-74','02-flipping-in__Wax-Lyricist/Wax_Lyricist_-_Flipping_In.mp3','02-flipping-in__Wax-Lyricist/beats.json',67,75),
   ('04-consternation groove bars 17-24','04-consternation-at-the-disco__Wax-Lyricist/Wax_Lyricist_-_Consternation_At_The_Disco.mp3','04-consternation-at-the-disco__Wax-Lyricist/beats.json',17,25),
   ('04-consternation breakdown bars 25-28','04-consternation-at-the-disco__Wax-Lyricist/Wax_Lyricist_-_Consternation_At_The_Disco.mp3','04-consternation-at-the-disco__Wax-Lyricist/beats.json',25,29),
   ('01-grab-a-partner groove bars 47-54','01-grab-a-partner__Loyalty-Freak-Music/Loyalty_Freak_Music_-_05_-_Grab_A_Partner.mp3','01-grab-a-partner__Loyalty-Freak-Music/beats.json',47,55),
   ('03-tea-party groove bars 81-88','03-post-adventure-tea-party__Zane-Little/Zane_Little_-_Post-Adventure_Tea_Party.mp3','03-post-adventure-tea-party__Zane-Little/beats.json',81,89),
   ('05-love-love-love groove bars 17-24','05-reserve-love-love-love__HoliznaCC0/HoliznaCC0_-_Love_Love_Love.mp3','05-reserve-love-love-love__HoliznaCC0/beats.json',17,25)]
out={}
for name,f,b,b0,b1 in C:
    bars=json.load(open(b))['bar_starts_s']; beats=json.load(open(b))['beat_times_s']
    m=metrics(f,beats,bars[b0-1],bars[b1-1]); out[name]=m; print(f'{name:45s}',m,flush=True)
json.dump(out,open('/tmp/space-video-doodle/animatic/music-pick/groove_metrics.json','w'),indent=1)
