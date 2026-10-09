# bar:beat -> frame numbers at 123 BPM / 60 fps.  usage: python3 tools/bt.py 1:1 4:4 5:4.5 ...
import sys
bpm=float(__import__('os').environ.get('BPM','123')); fps=60
out=[]
for a in sys.argv[1:]:
    b,bt=(a.split(':')+['1'])[:2]; t=(int(b)-1)*4*60/bpm+(float(bt)-1)*60/bpm; out.append(str(round(t*fps)))
print(','.join(out))
