#!/usr/bin/env python3
import json, glob, os, sys
rows = []
for p in sorted(glob.glob('/tmp/space-video-doodle/music-cc0/_deep/out/*/analysis.json')):
    d = json.load(open(p))
    st = d.get('stems') or {}
    es = st.get('energy_share', {})
    v = st.get('vocals', {})
    g = st.get('drum_grid_16', {})
    def pat(x, thr=0.55):
        if not x: return ''
        return ''.join('X' if v >= thr else ('x' if v >= 0.35 else '.') for v in x)
    secs = d['sections']
    lvl = ' '.join(f"{s['bars'][0]}{s['level'][0].upper()}" for s in secs)
    print(f"{os.path.basename(os.path.dirname(p)):>7} {d['title'][:38]:38s} {d['duration_s']:6.1f}s {d['tempo']['bpm']:7.2f}bpm drift sd{d['tempo']['drift_ms']['resid_sd']:5.1f} max{d['tempo']['drift_ms']['resid_max_abs']:5.1f}ms "
          f"dbm {d['grid']['downbeat_margin']:5.2f} fd {d['grid']['first_downbeat_s']:6.3f} {d['key']['key']:9s}({d['key']['r']:.2f}) I {d['loudness']['I']} LRA {d['loudness']['LRA']} "
          f"| D{es.get('drums',0):.2f} B{es.get('bass',0):.2f} O{es.get('other',0):.2f} V{es.get('vocals',0):.2f} vmed {v.get('median_db')} v>-10 {v.get('frac_seconds_above_m10db')} "
          f"| K {pat(g.get('kick'))} S {pat(g.get('snare'))} H {pat(g.get('hats'))} | oc {st.get('other_centroid_hz')} op {st.get('other_percussive_share')} ofl {st.get('other_flatness')} bo {st.get('bass_onset_rate')} oo {st.get('other_onset_rate')} "
          f"| win {d['strongest_window']['start_s']}-{d['strongest_window']['end_s']} | {lvl}")
