from PIL import Image, ImageDraw, ImageFont
f = ImageFont.truetype('/tmp/music-space-font-cache/display.ttf', 160)
m = ImageFont.truetype('/tmp/music-space-font-cache/marker.ttf', 160)
img = Image.new('RGB',(1500,420),'white'); d = ImageDraw.Draw(img)
d.text((10,10),'个介全会今人入几',font=f,fill='black')
d.text((10,220),'个介全会今人入几',font=m,fill='black')
img.save('/tmp/space-doodle/final/fonts-work/glyphs2.png')
