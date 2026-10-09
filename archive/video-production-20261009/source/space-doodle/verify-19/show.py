import sys,json
for line in sys.stdin:
  line=line.strip()
  if not line.startswith('{'): print(line); continue
  d=json.loads(line); print(d.get('label'),d.get('step'),'stage',d.get('stage'),'innerW',d.get('innerW'))
  for t in d['tags']:
    print('   {text!r:28} hidden={hidden!s:5} hs={hotspotW}x{hotspotH} client={clientW} content={contentW} scroll={scrollW} textW={textW} trunc={truncated!s:5} ws={ws} to={to} ov={ov} fs={fs} ff={ff} pad={pad} box={box}'.format(**t))
