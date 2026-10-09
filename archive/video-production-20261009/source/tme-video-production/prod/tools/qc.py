#!/usr/bin/env python3
"""QC for doodle-motion renders (an act preview or the full cut).

  PY tools/qc.py <video.mp4> [--info I.json] [--geom G.json] [--glyphs GL.json] [--mix M.wav.json] [--full] [--final] [--out report.json]
  (tools/act.sh runs it with all inputs; next to the video it looks for <video>.render.json / .info.json / .geom.json / .glyphs.json / .mix.wav.json)

Checks (PASS / WARN / FAIL):
  container    H.264 High 1920x1080 60 fps yuv420p BT.709 tv-range + AAC-LC 48 kHz stereo ~256 kb/s
  duration     full cut <= 175.0 s (target 172-176 s); an act = its bar range to the frame
  size         full cut 150-300 MB, never over 500 MB
  loudness     integrated -16 LUFS (+-1 LU; a full cut outside -14..-18 fails), true peak <= -1.0 dBTP, LRA reported
  silence      no digital silence over 0.8 s (warn; the score's planned gaps are shorter)
  black/frozen no black over 0.4 s, no frozen picture over 2.5 s (ffmpeg freezedetect -60 dB), no low-motion stretch over 2.5 s
  events       no gap over 2.5 s between visual events of the scene log
  reading      every title / note readable >= max(0.8 s, 0.25 s per unit) (units: one per CJK character, one per Latin/number run);
               labels and fine print are reported, not failed (SCRIPT.md: reading time is checked for titles and notes)
  glyphs       every rendered character is drawn by a custom font of its role (no system fallback); 入/个/· in Display only from
               the product's patched slices
  beats        every visual event on the 16th-note grid of the tempo map (<= 1 frame); off-grid events listed
  qr           when the end card is in range: the QR decodes to https://musicmapteam.github.io/musicSpace/
  safe area    text (not product footage) inside the 5 % title-safe area (96 px / 54 px) while readable
  placeholders capture placeholders still in the cut (warn; --final fails)
  sfx level    SFX bus 8-10 LU under the music over the range
  script       every SCRIPT.md line whose bars are in range (and not cut by the tempo map) is on screen (DM.say)
"""
import json, os, re, subprocess, sys, tempfile
import numpy as np
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
FF, FP = '/opt/homebrew/bin/ffmpeg', '/opt/homebrew/bin/ffprobe'
QR_URL = 'https://musicmapteam.github.io/musicSpace/'
SAFE = (96, 54, 1824, 1026)
results = []


def put(name, status, msg, **data):
    results.append(dict(check=name, status=status, msg=msg, **data))


def units(text):
    t = re.sub(r'[\s，。、！？…·：；,.!?「」『』（）()《》“”"\'\-—~～↗⇄]', ' ', text)
    n = 0
    for tok in t.split():
        cjk = re.findall(r'[\u3400-\u9fff\uf900-\ufaff]', tok); n += len(cjk)
        rest = re.sub(r'[\u3400-\u9fff\uf900-\ufaff]', ' ', tok).split(); n += len(rest)
    return n


def probe(video):
    j = json.loads(subprocess.run([FP, '-v', 'error', '-show_streams', '-show_format', '-of', 'json', video], capture_output=True, text=True).stdout)
    v = [s for s in j['streams'] if s['codec_type'] == 'video'][0]; a = [s for s in j['streams'] if s['codec_type'] == 'audio']
    return j, v, (a[0] if a else None)


def check_container(video, full):
    j, v, a = probe(video)
    ok = (v['codec_name'] == 'h264' and v.get('profile') == 'High' and v['width'] == 1920 and v['height'] == 1080 and v['r_frame_rate'] == '60/1'
          and v.get('pix_fmt') == 'yuv420p' and v.get('color_primaries') == 'bt709' and v.get('color_transfer') == 'bt709' and v.get('color_space') == 'bt709' and v.get('color_range') == 'tv')
    desc = f"{v['codec_name']} {v.get('profile')} {v['width']}x{v['height']} {v['r_frame_rate']} {v.get('pix_fmt')} {v.get('color_primaries')}/{v.get('color_transfer')}/{v.get('color_space')}/{v.get('color_range')}"
    put('container.video', 'PASS' if ok else 'FAIL', desc)
    if a:
        aok = a['codec_name'] == 'aac' and a.get('profile') == 'LC' and a['sample_rate'] == '48000' and a['channels'] == 2 and 200000 <= int(a.get('bit_rate', 0)) <= 300000
        put('container.audio', 'PASS' if aok else 'FAIL', f"{a['codec_name']} {a.get('profile')} {a['sample_rate']} Hz {a['channels']} ch {int(a.get('bit_rate', 0)) // 1000} kb/s")
    else:
        put('container.audio', 'FAIL', 'no audio stream (the rules require narration or subtitles: ours are burned in, but the film needs its music)')
    dur = float(j['format']['duration']); size = int(j['format']['size'])
    return v, a, dur, size


def check_duration_size(dur, size, full, expect=None):
    if full:
        put('duration', 'FAIL' if dur > 175.0 else ('PASS' if 172.0 <= dur <= 176.0 else 'WARN'), f'{dur:.3f} s (limit 175.0; target 172-176)', seconds=dur)
        mb = size / 1e6
        put('size', 'FAIL' if mb > 500 else ('PASS' if 150 <= mb <= 300 else 'WARN'), f'{mb:.1f} MB (target 150-300, limit 500)', mb=round(mb, 1))
    else:
        if expect is not None:
            put('duration', 'PASS' if abs(dur - expect) <= 1.5 / 60 else 'WARN', f'{dur:.3f} s (range {expect:.3f} s)', seconds=dur)
        else:
            put('duration', 'PASS', f'{dur:.3f} s', seconds=dur)
        put('size', 'PASS', f'{size / 1e6:.1f} MB ({size * 8 / dur / 1e6:.1f} Mb/s)', mb=round(size / 1e6, 1))


def check_audio(video, full):
    r = subprocess.run([FF, '-hide_banner', '-nostats', '-i', video, '-af', 'ebur128=peak=true,silencedetect=n=-50dB:d=0.8', '-f', 'null', '-'], capture_output=True, text=True).stderr
    I = float(re.findall(r'I:\s+(-?[\d.]+) LUFS', r)[-1]); TP = float(re.findall(r'Peak:\s+(-?[\d.]+) dBFS', r)[-1]); LRA = float(re.findall(r'LRA:\s+(-?[\d.]+) LU', r)[-1])
    if full:
        st = 'PASS' if -17 <= I <= -15 else ('WARN' if -18 <= I <= -14 else 'FAIL')
    else:
        st = 'PASS'
    put('loudness', st, f'I {I} LUFS (target -16), LRA {LRA} LU' + ('' if full else ' (act excerpt: informational; the full cut is normalised)'), I=I, LRA=LRA)
    put('true_peak', 'PASS' if TP <= -1.0 else 'FAIL', f'{TP} dBTP (limit -1.0)', TP=TP)
    sil = re.findall(r'silence_start: ([\d.]+)[\s\S]*?silence_end: ([\d.]+) \| silence_duration: ([\d.]+)', r)
    put('silence', 'WARN' if sil else 'PASS', f'{len(sil)} silent stretches over 0.8 s' + (': ' + ', '.join(f'{float(a):.2f}s+{float(c):.2f}' for a, b, c in sil) if sil else ''))


def check_picture(video, fps=60):
    vf = subprocess.run([FF, '-hide_banner', '-nostats', '-i', video, '-vf', 'freezedetect=n=-60dB:d=2.5,blackdetect=d=0.4:pix_th=0.05', '-an', '-f', 'null', '-'], capture_output=True, text=True).stderr
    fr = re.findall(r'freeze_start: ([\d.]+)', vf); bl = re.findall(r'black_start:([\d.]+)', vf)
    put('frozen', 'FAIL' if fr else 'PASS', f'{len(fr)} frozen stretches over 2.5 s' + (': ' + ', '.join(fr) if fr else ''))
    put('black', 'FAIL' if bl else 'PASS', f'{len(bl)} black stretches over 0.4 s' + (': ' + ', '.join(bl) if bl else ''))
    raw = subprocess.run([FF, '-v', 'error', '-i', video, '-vf', 'scale=160:90:flags=area,format=gray', '-f', 'rawvideo', '-'], capture_output=True).stdout
    fr_ = np.frombuffer(raw, np.uint8).reshape(-1, 90, 160).astype(np.float32); d = np.abs(np.diff(fr_, axis=0)).mean(axis=(1, 2))
    thr = 0.15; best = cur = 0; at = 0; start = 0
    for i, val in enumerate(d):
        if val < thr:
            cur += 1
            if cur == 1: start = i
            if cur > best: best, at = cur, start
        else:
            cur = 0
    s = best / fps
    put('motion', 'FAIL' if s > 2.5 else ('WARN' if s > 1.5 else 'PASS'), f'longest low-motion stretch {s:.2f} s at {at / fps:.2f} s (mean |dI| < {thr} on 160x90), mean motion {d.mean():.2f}',
        longest_s=round(s, 2), at_s=round(at / fps, 2))


def visual(e):
    return e.get('visual', True) is not False and e['kind'] not in ('sfx', 'mark', 'out')


def check_events(info, t0, t1, C):
    ev = sorted(e['t'] for e in info['events'] if visual(e) and t0 - 1e-6 <= e['t'] < t1)
    if not ev:
        put('events', 'FAIL', 'no visual events in range'); return
    pts = [t0] + ev + [t1]; gaps = np.diff(pts); k = int(np.argmax(gaps))
    put('event_gaps', 'FAIL' if gaps.max() > 2.5 else ('WARN' if gaps.max() > 1.94 else 'PASS'),
        f'{len(ev)} visual events, {len(ev) / max(1e-6, t1 - t0):.2f}/s; longest gap {gaps.max():.2f} s after {pts[k]:.2f} s (limit 2.5)', longest_gap_s=round(float(gaps.max()), 3))
    # beat alignment on the map's own grid
    import tempo
    tl = tempo.Timeline(C)
    off = []
    for e in info['events']:
        if not visual(e) or not (t0 - 1e-6 <= e['t'] < t1):
            continue
        err16 = tl.grid_error_ms(e['t'], 4); err8 = tl.grid_error_ms(e['t'], 2)
        e['_e16'] = err16; e['_e8'] = err8
        if err16 > 1000 / 60 / 2:
            off.append(f"{e['pos']} {e['kind']} {e['label'][:30]} ({err16:.1f} ms off the 16th grid)")
    n = sum(1 for e in info['events'] if visual(e) and t0 - 1e-6 <= e['t'] < t1)
    on8 = sum(1 for e in info['events'] if visual(e) and t0 - 1e-6 <= e['t'] < t1 and e.get('_e8', 99) <= 1000 / 120)
    put('beat_alignment', 'PASS' if not off else 'WARN', f'{n - len(off)}/{n} visual events on the 16th grid (<= half a frame), {on8}/{n} on 8ths; frames quantise by <= 8.3 ms', off_grid=off[:60])


def readable_windows(geom, covered_ok=False):
    """from geometry samples: per text id, list of (t, readable) using box size vs its largest seen size and opacity"""
    fps, stride = geom['fps'], geom['stride']
    seen = {}; maxw = {}
    for fr in geom['frames']:
        for tx in fr['texts']:
            w = tx['box'][2] - tx['box'][0]
            maxw[tx['id']] = max(maxw.get(tx['id'], 0), w)
    for fr in geom['frames']:
        t = fr['f'] / fps; cov = fr.get('covered')
        for tx in fr['texts']:
            w = tx['box'][2] - tx['box'][0]; cx = (tx['box'][0] + tx['box'][2]) / 2; cy = (tx['box'][1] + tx['box'][3]) / 2
            ok = tx['op'] >= 0.6 and w >= 0.6 * maxw[tx['id']] and 0 <= cx <= 1920 and 0 <= cy <= 1080 and not cov
            d = seen.setdefault(tx['id'], dict(text=tx['text'], kind=tx['kind'], role=tx.get('role'), inFootage=tx.get('inFootage'), samples=[]))
            d['samples'].append((t, ok, tx['box'], tx['op']))
    return seen, stride / fps


def check_reading(info, geom, t0, t1):
    rows = []
    if geom:
        seen, dt = readable_windows(geom)
        # merge the same text shown by different nodes back to back (a line carried across a cut / onto a match-cut copy)
        by_text = {}
        for tid, d in seen.items():
            ts = sorted(t for t, ok, b, o in d['samples'] if ok)
            if not ts: continue
            by_text.setdefault((d['text'], d['kind']), []).extend(ts)
        for (text, kind), ts in by_text.items():
            ts = sorted(set(round(t, 4) for t in ts))
            # longest continuous readable window (allow one missing sample)
            best = cur = dt; last = ts[0]
            for t in ts[1:]:
                if t - last <= dt * 2.01: cur += t - last
                else: cur = dt
                best = max(best, cur); last = t
            rows.append((text, kind, best))
        src = 'measured (geometry samples every %.0f ms)' % (dt * 1000)
    else:
        merged = []
        for tx in sorted(info.get('texts', []), key=lambda x: x['t0']):
            if tx['t1'] <= t0 or tx['t0'] >= t1: continue
            m = next((m for m in merged if m['text'] == tx['text'] and abs(tx['t0'] - m['t1']) < 0.1), None)
            if m: m['t1'] = max(m['t1'], tx['t1'])
            else: merged.append(dict(tx))
        rows = [(m['text'], m.get('kind', 'title'), min(m['t1'], t1) - max(m['t0'], t0)) for m in merged]
        src = 'declared windows (no geometry)'
    fails, warns, alls = [], [], []
    for text, kind, have in rows:
        n = units(text); need = max(0.8, 0.25 * n)
        ok = have + 1e-3 >= need
        alls.append(dict(text=text, kind=kind, units=n, on_s=round(have, 2), need_s=round(need, 2), ok=ok))
        if not ok:
            (fails if kind in ('title', 'note') else warns).append(f"「{text[:24]}」 {kind} {have:.2f}s < {need:.2f}s")
    put('reading_time', 'FAIL' if fails else ('WARN' if warns else 'PASS'), f'{len(rows)} lines, {src}; titles/notes failing {len(fails)}, labels/fine short {len(warns)}',
        failing=fails, short_labels=warns, lines=alls)


def check_safe(geom):
    if not geom:
        put('safe_area', 'WARN', 'no geometry (run with --geom)'); return
    dt = geom['stride'] / geom['fps']
    out = {}
    for fr in geom['frames']:
        if fr.get('covered'): continue
        for tx in fr['texts']:
            if tx.get('inFootage') or tx['op'] < 0.6: continue
            x0, y0, x1, y1 = tx['box']
            if x0 < SAFE[0] or y0 < SAFE[1] or x1 > SAFE[2] or y1 > SAFE[3]:
                o = out.setdefault(tx['id'], dict(text=tx['text'], kind=tx['kind'], frames=0, first=fr['f'], box=tx['box']))
                o['frames'] += 1
    bad = [v for v in out.values() if v['frames'] * dt > 0.5]
    brief = [v for v in out.values() if v['frames'] * dt <= 0.5]
    put('safe_area', 'FAIL' if bad else ('WARN' if brief else 'PASS'),
        f'{len(bad)} texts outside the 5% title-safe area for > 0.5 s, {len(brief)} only briefly (entrances, camera moves)',
        sustained=[f"「{v['text'][:20]}」 {v['frames'] * dt:.2f}s from {v['first'] / geom['fps']:.2f}s box {v['box']}" for v in bad],
        brief=[f"「{v['text'][:20]}」 {v['frames'] * dt:.2f}s from {v['first'] / geom['fps']:.2f}s box {v['box']}" for v in brief][:30])


def check_glyphs(gl):
    if not gl:
        put('glyphs', 'WARN', 'no glyph report (run with --glyphs)'); return
    bad = [c for c in gl['chars'] if any(not f['isCustomFont'] for f in c['fonts'])]
    fams = {}
    for c in gl['chars']:
        for f in c['fonts']: fams.setdefault(c['role'], set()).add(f['familyName'])
    # 入 个 · in Display text: must come from the product's patched slices (their unicode-range covers them)
    ranges = []
    try:
        css = open('/tmp/space-publish/dist-pages/fonts/doodle/fonts.css').read()
        for m in re.finditer(r'font-family:"Doodle Display";[^}]*unicode-range:([^;}]+)', css):
            for part in m.group(1).split(','):
                part = part.strip()[2:]; a, b = (part.split('-') + [part])[:2]; ranges.append((int(a, 16), int(b, 16)))
    except Exception:
        pass
    trap = []
    for c in gl['chars']:
        if c['role'] == 'display' and c['ch'] in '入个·' and not any(a <= ord(c['ch']) <= b for a, b in ranges):
            trap.append(c['ch'])
    st = 'FAIL' if bad or trap else 'PASS'
    put('glyphs', st, f"{len(gl['chars'])} font/character pairs; {len(bad)} drawn by a system font" + (': ' + ''.join(sorted(set(c['ch'] for c in bad))) if bad else '')
        + (f"; Display traps from the raw font: {''.join(trap)}" if trap else ''), fonts={k: sorted(v) for k, v in fams.items()},
        fallback=[f"{c['ch']} ({c['role']}) in 「{c['sample']}」 -> {[f['familyName'] for f in c['fonts']]}" for c in bad][:40])


def check_qr(video, info, t0, t1, expect):
    mark = (info.get('marks') or {}).get('qr')
    if not expect and mark is None:
        put('qr', 'PASS', 'no end card in range (not applicable)'); return
    times = []
    if mark is not None and t0 <= mark < t1:
        times = [mark - t0 + k * 0.5 for k in range(0, 8)]
    else:
        dur = t1 - t0; times = [max(0, dur - 12 + k * 0.75) for k in range(16)]
    found = []
    with tempfile.TemporaryDirectory() as d:
        files = []
        for i, t in enumerate(times):
            f = os.path.join(d, f'q{i}.png'); subprocess.run([FF, '-v', 'error', '-ss', f'{t:.3f}', '-i', video, '-frames:v', '1', f], check=False)
            if os.path.exists(f): files.append((t, f))
        if files:
            r = subprocess.run(['node', os.path.join(HERE, 'qr.mjs')] + [f for t, f in files], capture_output=True, text=True).stdout
            for (t, f), line in zip(files, r.strip().split('\n')):
                txt = line.split('\t', 1)[1] if '\t' in line else ''
                if txt: found.append((round(t0 + t, 2), txt))
    ok = any(txt == QR_URL for t, txt in found)
    put('qr', 'PASS' if ok else 'FAIL', f"decoded at {len(found)}/{len(times)} sampled frames" + (f": {found[0][1]} (first at {found[0][0]} s)" if found else '') + ('' if ok else f' -- expected {QR_URL}'))


def check_assets(info, final):
    ph = [f"{k} -> {v.get('path')}" for k, v in (info.get('assets') or {}).items() if v.get('placeholder')]
    ph += [f"clip {k} -> {v.get('path')}" for k, v in (info.get('clips') or {}).items() if v.get('placeholder')]
    missing = [k for k, v in (info.get('assets') or {}).items() if not v.get('path')] + [k for k, v in (info.get('clips') or {}).items() if not v.get('frames')]
    if missing:
        put('assets', 'FAIL', f'{len(missing)} assets not found: {missing}')
    put('placeholders', ('FAIL' if final else 'WARN') if ph else 'PASS', f'{len(ph)} placeholder assets (capture pass pending)' if ph else 'no placeholders', placeholders=ph)
    w = [x for x in info.get('warnings', []) if 'placeholder' not in x]
    put('scene_warnings', 'WARN' if w else 'PASS', f'{len(w)} warnings' + (': ' + ' | '.join(w[:8]) if w else ''))


def check_sfx(mixrep):
    if not mixrep:
        put('sfx_level', 'WARN', 'no mix report'); return
    lu = mixrep['sfx_vs_music_LU']
    put('sfx_level', 'PASS' if -10.5 <= lu <= -7.5 else 'WARN', f"SFX {lu:+} LU vs music (target -8..-10), {mixrep['sfx_placed']} sounds {mixrep['sfx_counts']}")


def check_script(info, C, t0, t1):
    import tempo
    tl = tempo.Timeline(C)
    tl_json = json.load(open('/tmp/space-video-doodle/script/out/timeline.json'))
    used = set(info.get('script', []))
    expect, miss = [], []
    for L in tl_json['text']:
        a = tl.t(L['start'])
        if a is None or not (t0 - 1e-6 <= a < t1 - 1.0 / 60):
            continue
        expect.append(L['id'])
        if L['id'] not in used:
            miss.append(f"{L['id']} {L['start']} 「{L['text'][:20]}」")
    put('script_lines', 'PASS' if not miss else 'WARN', f'{len(expect) - len(miss)}/{len(expect)} SCRIPT lines in range are on screen', missing=miss)


def main():
    a = sys.argv[1:]
    if not a:
        print(__doc__); sys.exit(1)
    video = a[0]; opt = {}; i = 1
    while i < len(a):
        if a[i] in ('--full', '--final'): opt[a[i][2:]] = True; i += 1
        else: opt[a[i][2:]] = a[i + 1]; i += 2
    base = video[:-4] if video.endswith('.mp4') else video
    def load(k, suffix):
        p = opt.get(k) or (base + suffix if os.path.exists(base + suffix) else None)
        return (json.load(open(p)), p) if p else (None, None)
    info, info_p = load('info', '.info.json'); geom, _ = load('geom', '.geom.json'); gl, _ = load('glyphs', '.glyphs.json')
    mixrep, _ = load('mix', '.mix.wav.json'); rend, _ = load('render', '.render.json')
    full = bool(opt.get('full')); final = bool(opt.get('final'))
    v, aud, dur, size = check_container(video, full)
    t0, t1 = (rend['seconds'] if rend else [0.0, dur])
    C = None
    if info and info.get('map'):
        import tempo
        C = tempo.load_compiled(info['map']['id'])
        full = full or (abs(t0) < 1e-6 and abs(t1 - C['end_s']) < 0.05)
    check_duration_size(dur, size, full, None if full else (t1 - t0))
    check_audio(video, full) if aud else None
    check_picture(video)
    if info:
        check_events(info, t0, t1, C)
        check_reading(info, geom, t0, t1)
        check_safe(geom)
        check_glyphs(gl)
        end_card = C is not None and (tempo.Timeline(C).tc('85:1') < t1 - 1.0)
        check_qr(video, info, t0, t1, end_card)
        check_assets(info, final)
        check_sfx(mixrep)
        check_script(info, C, t0, t1)
    worst = 'FAIL' if any(r['status'] == 'FAIL' for r in results) else ('WARN' if any(r['status'] == 'WARN' for r in results) else 'PASS')
    rep = dict(video=os.path.abspath(video), range_s=[t0, t1], full=full, overall=worst, checks=results)
    out = opt.get('out') or base + '.qc.json'
    json.dump(rep, open(out, 'w'), ensure_ascii=False, indent=1)
    lines = [f"QC {os.path.basename(video)}  range {t0:.2f}-{t1:.2f} s  {'FULL CUT' if full else 'act preview'}  ->  {worst}"]
    for r in results:
        lines.append(f"  {r['status']:4s}  {r['check']:15s} {r['msg']}")
        for k in ('failing', 'sustained', 'off_grid', 'fallback', 'placeholders', 'missing', 'short_labels'):
            if r.get(k):
                for x in r[k][:12]: lines.append(f"            - {x}")
                if len(r[k]) > 12: lines.append(f"            ... {len(r[k]) - 12} more")
    txt = '\n'.join(lines); print(txt); open(base + '.qc.txt', 'w').write(txt + '\n')


if __name__ == '__main__':
    main()
