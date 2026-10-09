"""Frame tiles for reviewing source clips: tile.py <clip.mp4> <out.png> <frame,frame,...> [width]"""
import subprocess, sys, io
from PIL import Image, ImageDraw, ImageFont

clip, out, frames = sys.argv[1], sys.argv[2], [int(x) for x in sys.argv[3].split(',')]
W = int(sys.argv[4]) if len(sys.argv) > 4 else 270
cols = int(sys.argv[5]) if len(sys.argv) > 5 else 8
tiles = []
for f in frames:
    sel = f"select=eq(n\\,{f})"
    png = subprocess.run(['ffmpeg', '-v', 'error', '-i', clip, '-vf', sel + f',scale={W}:-1', '-frames:v', '1', '-f', 'image2pipe', '-vcodec', 'png', '-'],
                         capture_output=True).stdout
    im = Image.open(io.BytesIO(png)).convert('RGB')
    d = ImageDraw.Draw(im)
    try:
        font = ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial.ttf', 22)
    except Exception:
        font = ImageFont.load_default()
    d.rectangle([0, 0, 80, 28], fill='white')
    d.text((4, 2), f'f{f}', fill='red', font=font)
    tiles.append(im)
w, h = tiles[0].size
rows = (len(tiles) + cols - 1) // cols
sheet = Image.new('RGB', (w * min(cols, len(tiles)), h * rows), 'white')
for i, im in enumerate(tiles):
    sheet.paste(im, ((i % cols) * w, (i // cols) * h))
sheet.save(out)
print(out, sheet.size)
