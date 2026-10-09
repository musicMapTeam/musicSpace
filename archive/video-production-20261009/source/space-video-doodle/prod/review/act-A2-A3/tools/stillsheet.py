"""Tile the stills of a render.mjs --stills run (files sorted by frame) with their labels: stillsheet.py <dir> <out.png> <cols> <width> <label,label,...>"""
import sys, glob, subprocess
d, out, cols, W, labels = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4], sys.argv[5].split(',')
files = sorted(glob.glob(d + '/*.png'))
assert len(files) == len(labels), (len(files), len(labels))
subprocess.run(['/tmp/space-video-doodle/music-cc0/tools/venv-ana/bin/python', '/tmp/space-video-doodle/prod/review/act-A2-A3/sheet.py', out, cols, W] + [f'{l}={f}' for l, f in zip(labels, files)], check=True)
