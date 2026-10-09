"""Full-res frames from an act mp4 at storyboard positions: frames.py <video.mp4> <map> <outdir> <pos> [pos ...]   (pos = bar:beat)"""
import json, subprocess, sys, os
video, mp, outd = sys.argv[1], sys.argv[2], sys.argv[3]
os.makedirs(outd, exist_ok=True)
C = json.load(open(f'/tmp/space-video-doodle/prod/tools/tempo-maps/compiled/{mp}.json'))
bars = {str(b['sb']): b for b in C['bars']}
r = json.load(open(video.replace('.mp4', '.render.json')))
t_start = r['frames'][0] / 60
for p in sys.argv[4:]:
    b, bt = p.split(':'); B = bars[b]
    t = B['t0'] + (float(bt) - 1) * B['len'] / 4
    n = int(round((t - t_start) * 60))
    out = f'{outd}/{p.replace(":", "_")}.png'
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', video, '-vf', f"select=eq(n\\,{n})", '-frames:v', '1', out], check=True)
    print(out, n)
