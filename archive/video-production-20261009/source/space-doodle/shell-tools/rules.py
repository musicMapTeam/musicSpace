import re,sys
# order of CSS import as in app.js (profile.js demo.css first)
files=['static-runtime/demo.css','event-room/music-map.css','event-room/music-games.css','event-room/space-management.css','event-room/personal-space.css','event-room/corner-panel.css','event-room/community-panel.css','livehouse/style.css','event-room/style.css','event-room/venue-polish.css','event-room/experience.css','event-room/memory-card.css','event-room/editorial.css','event-room/moment-upload.css','event-room/wall-moments.css']
pat=re.compile(sys.argv[1])
for f in files:
  src=open(f).read()
  src=re.sub(r'/\*.*?\*/','',src,flags=re.S)
  # naive parse with media tracking
  i=0;stack=[];buf=''
  tokens=re.finditer(r'([^{}]*)\{|\}',src)
  ctx=[]
  for m in tokens:
    if m.group(0)=='}':
      if ctx: ctx.pop()
      continue
    sel=m.group(1).strip()
    if sel.startswith('@media') or sel.startswith('@supports'):
      ctx.append(sel);continue
    # find body
    start=m.end();end=src.find('}',start)
    body=src[start:end]
    if pat.search(sel):
      media=' '.join(c for c in ctx if c.startswith('@'))
      print(f"{f.split('/')[-1]:18s} {media[:40]:40s} {sel[:90]} {{{body.strip()[:220]}}}")
    ctx.append('rule')
