import json, numpy as np
MAP = '/tmp/space-video-doodle/prod/tools/tempo-maps/compiled/flipping-in.json'
C = json.load(open(MAP))
BARS = [(b['sb'], b['t0'], b['len'], b['trk']) for b in C['bars']]
FPS = 60
def T(pos):
    a, b = pos.split(':') if ':' in pos else (pos, '1')
    beat = float(b); n = int(a)
    while beat >= 5: beat -= 4; n += 1
    for sb, t0, ln, trk in BARS:
        if int(sb) == n: return t0 + (beat - 1) / 4 * ln
    if n == 90 or n == 91:  # cut bar 90 -> grid end
        last = BARS[-1]; return last[1] + last[2] + (beat - 1) / 4 * last[2]
    raise KeyError(pos)
def pos(t):
    for sb, t0, ln, trk in BARS:
        if t0 - 1e-9 <= t < t0 + ln - 1e-9:
            return int(sb), 1 + (t - t0) / ln * 4, trk
    sb, t0, ln, trk = BARS[-1]
    return int(sb), 1 + (t - t0) / ln * 4, None
def fmt_pos(t):
    b, beat, trk = pos(t)
    return f'{b}:{beat:.2f}'
def mmss(t):
    m = int(t // 60); s = t - 60 * m
    return f'{m:02d}:{s:05.2f}'
def grid_lines(div):
    """times of grid lines; div = subdivisions per bar (1 bar, 2 half, 4 beat, 8, 16)"""
    out = []
    for sb, t0, ln, trk in BARS:
        for k in range(div):
            out.append((t0 + k * ln / div, int(sb), 1 + 4 * k / div))
    last = BARS[-1]
    out.append((last[1] + last[2], 91, 1.0))
    return out
_g = {d: np.array([x[0] for x in grid_lines(d)]) for d in (1, 2, 4, 8, 16)}
def off(t, div):
    g = _g[div]; i = np.searchsorted(g, t)
    c = [g[j] for j in (i - 1, i) if 0 <= j < len(g)]
    best = min(c, key=lambda x: abs(x - t))
    return t - best
def level(t, tol=0.5 / 60):
    """coarsest grid the time sits on within tol"""
    for d, name in ((1, 'bar'), (2, 'half'), (4, 'beat'), (8, '8th'), (16, '16th')):
        if abs(off(t, d)) <= tol: return name
    return 'off'
