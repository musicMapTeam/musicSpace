#!/usr/bin/env python3
"""Pixel-level old-copy check of the ENCODED film (v3): sampled frames of the mp4 are read by macOS Vision (out/tools/ocr/ocr,
zh-Hans + en-US, low minimum text height so the small UI inside the phone / desktop frames is read) and searched for the copy the
owner removed on 2026-10-07 (/tmp/space-copy/COPY-PLAN.md: the "never in UI copy" list and the old words of the glossary).

  PY out/tools/ocr-film.py <video.mp4> <out.json> [--step 15] [--map flipping-in-b] [--jobs 3] [--min-h 0.006]

Exception: the end card's ONE credits line (「演示角色与照片为虚构，照片由 AI 生成 · 配乐：…」, T146 from 86:1) is the film's single
disclosure and is allowed there (OCR lines of the credits strip are dropped from 86:1 on, and only those).
Film text vs product copy: a hit whose OCR box overlaps one of the FILM'S OWN text boxes carrying the same words (the geometry pass
<video>.geom.json, text boxes every 3rd frame) is the film's narration / labels (e.g. T066 「规则判断，不是 AI。」, kept as narration in
SCRIPT.md), reported under `film_text_hits` and not counted as old product copy.  `--reclassify 1` redoes only this step on an
existing <out.json> (no OCR).
Positive control: rc.2 strings the film must show (交换已接受, 等待对方回应, 撤销这次交换, 同一刻的另一面, 关于 Music Space, 乐迷社群 …)
are counted, so an OCR that reads nothing cannot pass silently.
"""
import json, os, re, shutil, subprocess, sys
from concurrent.futures import ThreadPoolExecutor
sys.path.insert(0, '/tmp/space-video-doodle/prod/tools')
import tempo

FF, FP = '/opt/homebrew/bin/ffmpeg', '/opt/homebrew/bin/ffprobe'
OCR = '/tmp/space-video-doodle/prod/out/tools/ocr/ocr'
# the owner's removed / renamed copy (COPY-PLAN.md glossary "old:" words + the style section's never-list + RELEASE-NOTES v2 §5)
BANNED = [
    '示例', '虚构', '模拟', '演示', '不是真人', '自动回复', '在本页运行', '没有服务器', '只存在这个浏览器', '本地体验版', '不代表',
    '不是到场认证', '不会自动', '原件仍归各自', '无法收回', '无法远程收回', '不订阅营销', '不扩大照片权限', '规则判断', '不是AI', '未核实',
    '核对', '原操作', '原请求', '分身', '长期空间', '长期社群', '长期音乐社群', '我的社群', '活动预告', '空间与活动', '等待本人回应',
    '在线访问', '限尺寸预览', '定向交换', '互相同意成为朋友', '双向朋友', '不是在线人数', '位社群成员', '双方已明确同意', '要不要交换',
    '仍由你和对方决定', '开一个现场', '自己开个房', '自己开一场', '虚构场地', '重置示例',
]
CONTROL = ['换已接受', '等待对方回应', '撤销这次交换', '同一刻的另一面', '关于 Music Space', '乐迷社群', '下一场预告', '音乐探索',
           '来源', '进入现场', '第一次来', '人海那张', 'AI 判断：人海', '不确定，请选择', '阿遥', '小满', '北屿', '林间', '为这一场开房']
CREDITS = re.compile(r'演示角色|为虚构|照片由\s*AI|AI\s*生成|配乐|Wax|Lyricist|Flipping|CC0')


def flat(s):
    return re.sub(r'\s+', '', s)


def classify(hits, geom_path):
    """split hits into product copy and the film's own text (OCR box inside a film text box with the same words)"""
    if not geom_path or not os.path.exists(geom_path):
        return hits, []
    G = json.load(open(geom_path)); by = {g['f']: g for g in G['frames']}; st = int(G.get('stride', 3))
    def area(b): return max(0, b[2] - b[0]) * max(0, b[3] - b[1])
    def inter(a, b): return area([max(a[0], b[0]), max(a[1], b[1]), min(a[2], b[2]), min(a[3], b[3])])
    product, film = [], []
    for h in hits:
        g = next((by[f] for d in range(st + 1) for f in (h['frame'] - d, h['frame'] + d) if f in by), None)
        own = []
        for ln in h['lines']:
            ob = ln['box']; words = [w for w in h['words'] if flat(w) in flat(ln['t'])]
            m = [tx for tx in (g or {}).get('texts', []) if inter(ob, tx['box']) > 0.5 * max(1, area(ob)) and all(flat(w) in flat(tx['text']) for w in words)]
            own.append(bool(m))
            if m: ln['film_text'] = m[0]['text']
        (film if own and all(own) else product).append(h)
    return product, film


def main():
    a = sys.argv[1:]
    video, outp = a[0], a[1]
    opt = dict(zip(a[2::2], a[3::2]))
    step = int(opt.get('--step', 15)); jobs = int(opt.get('--jobs', 3)); minh = opt.get('--min-h', '0.006')
    base = video[:-4]
    if opt.get('--reclassify'):
        rep = json.load(open(outp)); allhits = rep.get('hits', []) + rep.get('film_text_hits', [])
        rep['hits'], rep['film_text_hits'] = classify(sorted(allhits, key=lambda h: h['frame']), base + '.geom.json')
        rep['control_frames'] = {c: sum(1 for r in rep['frames'] if flat(c) in flat(r['text'])) for c in CONTROL}
        rep['missing_controls'] = [c for c, v in rep['control_frames'].items() if not v]
        json.dump(rep, open(outp, 'w'), indent=1, ensure_ascii=False); summary(rep); return
    rend = json.load(open(base + '.render.json')) if os.path.exists(base + '.render.json') else {}
    mid = opt.get('--map') or rend.get('map') or 'flipping-in-b'
    C = tempo.load_compiled(mid, rebuild=False); tl = tempo.Timeline(C)
    t0 = (rend.get('seconds') or [0.0])[0]
    t_credits = tl.t('86:1')
    n = int(subprocess.run([FP, '-v', 'error', '-count_packets', '-select_streams', 'v:0', '-show_entries', 'stream=nb_read_packets', '-of', 'csv=p=0', video],
                           capture_output=True, text=True).stdout.strip())
    picks = sorted(set(list(range(0, n, step)) + [n - 1]))
    tmp = os.path.join(os.path.dirname(os.path.abspath(outp)), 'work', 'ocr-tmp-' + os.path.basename(base))
    shutil.rmtree(tmp, ignore_errors=True); os.makedirs(tmp)
    sel = f'not(mod(n\\,{step}))+eq(n\\,{n - 1})'
    subprocess.run([FF, '-v', 'error', '-i', video, '-vf', f'select={sel}', '-fps_mode', 'passthrough', '-q:v', '2', f'{tmp}/f%05d.jpg'], check=True)
    files = sorted(os.listdir(tmp)); assert len(files) == len(picks), (len(files), len(picks))
    paths = [os.path.join(tmp, f) for f in files]
    batches = [paths[i:i + 25] for i in range(0, len(paths), 25)]

    def run(batch):
        out = subprocess.run([OCR, minh] + batch, capture_output=True, text=True).stdout
        return [json.loads(l) for l in out.splitlines() if l.startswith('{')]
    recs = {}
    with ThreadPoolExecutor(jobs) as ex:
        for k, res in enumerate(ex.map(run, batches)):
            for r in res: recs[r['file']] = r
            if k % 4 == 3: print(f'ocr {min(len(paths), (k + 1) * 25)}/{len(paths)} frames', flush=True)
    rows, hits, seen = [], [], {c: 0 for c in CONTROL}
    for fr, p in zip(picks, paths):
        r = recs.get(p, {'texts': []}); t = t0 + fr / 60
        sb, beat, _ = tl.pos(t); pos = f'{sb}:{beat:.2f}'
        texts = r.get('texts', [])
        dropped = []
        if t_credits is not None and t >= t_credits - 0.05:
            keep = []
            for x in texts:
                (dropped if CREDITS.search(x['t']) else keep).append(x)
            texts = keep
        joined = ' | '.join(x['t'] for x in texts); fj = flat(joined)
        found = sorted({w for w in BANNED if flat(w) in fj})
        if found:
            hits.append(dict(frame=fr, t=round(t, 3), pos=pos, words=found,
                             lines=[dict(t=x['t'], box=x['box']) for x in texts if any(flat(w) in flat(x['t']) for w in found)]))
        for c in CONTROL:
            if flat(c) in fj: seen[c] += 1
        rows.append(dict(frame=fr, t=round(t, 3), pos=pos, text=joined, credits_dropped=[x['t'] for x in dropped]))
    shutil.rmtree(tmp, ignore_errors=True)
    product, film = classify(hits, base + '.geom.json')
    rep = dict(video=os.path.abspath(video), map=mid, step=step, frames_read=len(rows), min_text_height=float(minh), banned=BANNED,
               credits_exception='from 86:1 (%.3f s) the end-card credits line (T146) is dropped before the search' % (t_credits or -1),
               hits=product, film_text_hits=film, control_frames=seen, missing_controls=[c for c, v in seen.items() if not v], frames=rows)
    json.dump(rep, open(outp, 'w'), indent=1, ensure_ascii=False)
    summary(rep)


def summary(rep):
    hits, film = rep['hits'], rep.get('film_text_hits', [])
    print(f"OCR {rep['frames_read']} frames (every {rep['step']}th): " + (f'{len(hits)} frames with old / explanatory PRODUCT copy: ' + json.dumps(hits, ensure_ascii=False)[:2500] if hits else 'no old / explanatory product copy'))
    if film:
        words = sorted({ln.get('film_text', '') for h in film for ln in h['lines']})
        print(f"  the film's own text matched the list in {len(film)} frames ({film[0]['pos']} - {film[-1]['pos']}): " + ' / '.join(words))
    print('positive control (frames where found):', json.dumps(rep['control_frames'], ensure_ascii=False), '| missing:', rep.get('missing_controls'))


if __name__ == '__main__':
    main()
