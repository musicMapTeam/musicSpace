#!/usr/bin/env python3
"""Mix: music bed (tools/music.py) + SFX bus (tools/sfx.py) for a time range of the film.

  PY tools/mix.py <map> <info.json> <out.wav> [--from S --to S] [--sfx-lu -9] [--full]

- The SFX bus is scaled so its integrated loudness sits `--sfx-lu` LU (default -9; the brief: about 8-10 dB) under the music over the same
  range (clamped to +-6 dB of the nominal synthesis levels so a near-silent range cannot blow the effects up).
- --full (the whole film): the mix is normalised to -16.0 LUFS integrated and true-peak limited (4x oversampled look-ahead, ceiling -1.5 dBTP so the AAC encode stays under -1.0 dBTP).
  A partial range (an act preview) keeps the bed's absolute level (it is already normalised over the whole film) and is only
  true-peak limited, so an act sounds exactly as it will in the film.
Writes <out.wav> (48 kHz / 24-bit) and <out.wav>.json (loudness of music / SFX / mix, SFX-vs-music LU, gains, sound counts).
"""
import json, os, subprocess, sys
import numpy as np
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
import tempo, music, sfx
from audiolib import SR, decode, write_wav, ebur128, normalize, true_peak_limit


def mix(mid, info, out, t0=None, t1=None, sfx_lu=-9.0, full=False, bed=None):
    C = tempo.load_compiled(mid)
    bed_path = bed or music.ensure_bed(mid)
    t0 = 0.0 if t0 is None else t0; t1 = C['end_s'] if t1 is None else t1
    y = decode(bed_path)
    a, b = int(round(t0 * SR)), int(round(t1 * SR))
    mus = np.zeros((b - a, 2)); src = y[max(0, a):min(len(y), b)]; mus[max(0, -a):max(0, -a) + len(src)] = src
    pl = sfx.place(info['events'], t0, t1, C.get('music_has', []))
    bus = sfx.render_bus(pl, t0, t1)
    m_mus = ebur128(mus); m_sfx = ebur128(bus) if np.abs(bus).max() > 0 else dict(I=-70.0, TP=-120.0, LRA=0.0)
    g = 0.0
    if m_sfx['I'] > -69:
        g = float(np.clip((m_mus['I'] + sfx_lu) - m_sfx['I'], -6, 6))
    bus = bus * 10 ** (g / 20)
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
    rep = dict(map=mid, bed=os.path.abspath(bed_path), range=[round(t0, 4), round(t1, 4)], full=full, music=m_mus, sfx_before_gain=m_sfx, sfx_gain_db=round(g, 2),
               sfx=m_sfx2, sfx_vs_music_LU=round(m_sfx2['I'] - m_mus['I'], 1), mix=mm, normalisation=norm, sfx_counts=counts, sfx_placed=len(pl),
               note='all SFX synthesized in tools/sfx.py from noise/oscillators; no samples')
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
          f"mix I {r['mix']['I']} LUFS TP {r['mix']['TP']} dBTP; {r['sfx_placed']} sounds {r['sfx_counts']}")
