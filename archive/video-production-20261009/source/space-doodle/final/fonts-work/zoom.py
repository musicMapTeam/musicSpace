from PIL import Image, ImageDraw, ImageFont
img = Image.new('RGB', (1500, 560), 'white'); d = ImageDraw.Draw(img)
f0 = ImageFont.truetype('/tmp/space-doodle/final/fonts-work/disp-0.ttf', 230)
m = ImageFont.truetype('/tmp/music-space-font-cache/marker.ttf', 230)
d.text((10, 10), '人入个几', font=f0, fill='black')
d.text((10, 280), '人入个几', font=m, fill='black')
img.save('/tmp/space-doodle/final/fonts-work/zoom.png')
