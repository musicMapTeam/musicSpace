# crop.py in.png x y w h out.png [scale]  (x,y,w,h in image pixels)
import sys
from PIL import Image
a=sys.argv
im=Image.open(a[1]); x,y,w,h=map(int,a[2:6]); s=float(a[7]) if len(a)>7 else 1
c=im.crop((x,y,x+w,y+h))
if s!=1: c=c.resize((int(w*s),int(h*s)),Image.LANCZOS)
c.save(a[6]); print(a[6],c.size)
