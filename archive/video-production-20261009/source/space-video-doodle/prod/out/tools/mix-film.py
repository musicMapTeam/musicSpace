#!/usr/bin/env python3
"""Film mix (v2) = prod/tools/mix.py + the film's BED AUTOMATION.

  PY out/tools/mix-film.py <map> <info.json> <out.wav> [--from S --to S] [--sfx-lu -9] [--full]

Identical to tools/mix.py (music bed of the tempo map + the synthesized SFX bus placed from the scene's event log, SFX bus 9 LU under
the music, the full cut normalised to -16 LUFS integrated with a 4x look-ahead true-peak limiter at -1.5 dBTP), plus one step:
before the SFX are added, the bed follows the gain automation the film declares in scenes/film.js (DM.film.bed, written into the
info by out/tools/render-film.mjs).  Each item is four times in output seconds, computed from storyboard positions under the map in
use, so the automation follows any music option:

    {label, db, a, b, c, d}   0 dB before a -> `db` at b (linear in dB) -> held to c -> back to 0 dB at d

v2 uses it for the stops the picture asks for and the CC0 track does not play (review notes art #5 / rhythm):
    4:4.5 -> 5:1    the bed drops out under the scribble wipe; the title SLAM 「同一刻，」 lands with the bed's return on 5:1
    40:4.5 -> 41:1  the same under the wipe into the collision of the two photos (the film's key frame)
    79:1 -> 79:3    the bed ducks ~20 dB under 「曲终，」 and swells back into 「人不散。」
(none for the original score, which plays its own stops there: scenes/film.js leaves DM.film.bed empty for it)
Writes <out.wav> (48 kHz / 24-bit) and <out.wav>.json (as tools/mix.py, plus `bed_automation`).
"""
import json, os, sys
import numpy as np
TOOLS = '/tmp/space-video-doodle/prod/tools'
sys.path.insert(0, TOOLS)
import tempo, music, sfx                                            # noqa: E402
from audiolib import SR, decode, write_wav, ebur128, normalize, true_peak_limit   # noqa: E402


def bed_gain_db(n, t0, items):
    """per-sample gain (dB) for the output range starting at t0 seconds"""
    t = t0 + np.arange(n) / SR
    g = np.zeros(n)
    for it in items:
        a, b, c, d, db = it['a'], it['b'], it['c'], it['d'], float(it['db'])
        x = np.zeros(n)
        down = (t >= a) & (t < b); x[down] = db * (t[down] - a) / max(1e-6, b - a)
        x[(t >= b) & (t < c)] = db
        up = (t >= c) & (t < d); x[up] = db * (1 - (t[up] - c) / max(1e-6, d - c))
        g = np.minimum(g, x)
    return g


def mix(mid, info, out, t0=None, t1=None, sfx_lu=-9.0, full=False):
    C = tempo.load_compiled(mid)
    bed_path = music.ensure_bed(mid)
    t0 = 0.0 if t0 is None else t0; t1 = C['end_s'] if t1 is None else t1
    y = decode(bed_path)
    a, b = int(round(t0 * SR)), int(round(t1 * SR))
    mus = np.zeros((b - a, 2)); src = y[max(0, a):min(len(y), b)]; mus[max(0, -a):max(0, -a) + len(src)] = src
    auto = ((info.get('film') or {}).get('bed')) or []
    applied = []
    if auto:
        g = bed_gain_db(len(mus), t0, auto)
        mus = mus * (10 ** (g / 20))[:, None]
        for it in auto:
            if it['d'] > t0 and it['a'] < t1:
                applied.append(dict(it))
    m_mus = ebur128(mus)
    pl = sfx.place(info['events'], t0, t1, C.get('music_has', []))
    bus = sfx.render_bus(pl, t0, t1)
    m_sfx = ebur128(bus) if np.abs(bus).max() > 0 else dict(I=-70.0, TP=-120.0, LRA=0.0)
    gsfx = 0.0
    if m_sfx['I'] > -69:
        gsfx = float(np.clip((m_mus['I'] + sfx_lu) - m_sfx['I'], -6, 6))
    bus = bus * 10 ** (gsfx / 20)
    m_sfx2 = ebur128(bus) if np.abs(bus).max() > 0 else m_sfx
    mixed = mus + bus
    if full:
        mixed, norm = normalize(mixed, -16.0)
    else:
        mixed, red = true_peak_limit(mixed, -1.5); norm = dict(gain_db=0.0, limiter_max_reduction_db=round(red, 2))
    mm = ebur128(mixed)
    write_wav(out, mixed, 24)
    counts = {}
    for c in pl: counts[c['sound']] = counts.get(c['sound'], 0) + 1
    rep = dict(map=mid, bed=os.path.abspath(bed_path), range=[round(t0, 4), round(t1, 4)], full=full, music=m_mus, sfx_before_gain=m_sfx,
               sfx_gain_db=round(gsfx, 2), sfx=m_sfx2, sfx_vs_music_LU=round(m_sfx2['I'] - m_mus['I'], 1), mix=mm, normalisation=norm,
               sfx_counts=counts, sfx_placed=len(pl), bed_automation=applied,
               note='all SFX synthesized in tools/sfx.py from noise/oscillators; no samples; bed automation from scenes/film.js (DM.film.bed)')
    json.dump(rep, open(out + '.json', 'w'), ensure_ascii=False, indent=1)
    return rep


if __name__ == '__main__':
    a = sys.argv[1:]
    if len(a) < 3:
        print(__doc__); sys.exit(1)
    mid, infop, out = a[0], a[1], a[2]
    opt = {}; i = 3
    while i < len(a):
        if a[i] == '--full': opt['full'] = True; i += 1
        else: opt[a[i]] = a[i + 1]; i += 2
    info = json.load(open(infop))
    r = mix(mid, info, out, float(opt['--from']) if '--from' in opt else None, float(opt['--to']) if '--to' in opt else None,
            float(opt.get('--sfx-lu', -9)), opt.get('full', False))
    print(f"mix {out}: music I {r['music']['I']} LUFS, SFX I {r['sfx']['I']} ({r['sfx_vs_music_LU']:+} LU vs music, gain {r['sfx_gain_db']:+} dB), "
          f"mix I {r['mix']['I']} LUFS TP {r['mix']['TP']} dBTP; bed automation {len(r['bed_automation'])}; {r['sfx_placed']} sounds {r['sfx_counts']}")
