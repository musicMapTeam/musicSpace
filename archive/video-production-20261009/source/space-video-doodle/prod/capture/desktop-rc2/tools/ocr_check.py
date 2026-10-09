#!/usr/bin/env python3
"""Pixel-level copy check of the takes: every STEP frames of each 4K master (plus its last frame) is decoded, read by macOS Vision
(tools/ocr/ocr, zh-Hans + en-US) and grepped for old copy.  This sees what the DOM audit cannot: the 3D canvas (stage sign, prints)
and anything drawn as an image.  Positive control: the same reader finds 「示例」 three times in rc1's probe still d06-chat-reply.png.
usage: ocr_check.py <id> [<id> ...]  -> qc/<id>.ocr.json (+ prints one line per clip); temp frames are deleted afterwards."""
import json, os, re, shutil, subprocess, sys

ROOT = '/tmp/space-video-doodle/prod/capture/desktop-rc2'
FF = '/opt/homebrew/bin/ffmpeg'
OCR = f'{ROOT}/tools/ocr/ocr'
STEP = 30
BANNED = re.compile(r'示例|虚构|本页|演示|自动回复|不是真人|没有服务器|只存在这个浏览器|模拟|本地体验版|在线访问|等待本人回应|示例站|关于这个示例|仅文字|已保存 =')


def check(cid):
    master = f'{ROOT}/master/{cid}.mp4'
    rec = json.load(open(f'{ROOT}/master/{cid}.rec.json'))
    n = rec['frames']
    picks = sorted(set(list(range(0, n, STEP)) + [n - 1]))
    tmp = f'{ROOT}/review/ocr-tmp/{cid}'
    shutil.rmtree(tmp, ignore_errors=True); os.makedirs(tmp)
    sel = '+'.join(f'eq(n\\,{k})' for k in picks)
    subprocess.run([FF, '-v', 'error', '-i', master, '-vf', f'select={sel}', '-fps_mode', 'passthrough', '-q:v', '2', f'{tmp}/f%05d.jpg'], check=True)
    files = sorted(os.listdir(tmp))
    assert len(files) == len(picks), (cid, len(files), len(picks))
    out = subprocess.run([OCR] + [f'{tmp}/{f}' for f in files], capture_output=True, text=True).stdout.splitlines()
    rows, hits = [], []
    for k, line in zip(picks, out):
        parts = line.split('\t', 2)
        text = parts[2] if len(parts) > 2 else ''
        rows.append(dict(frame=k, t=round(k / 60, 3), text=text))
        m = BANNED.findall(text)
        if m: hits.append(dict(frame=k, t=round(k / 60, 3), words=sorted(set(m)), text=text[:400]))
    shutil.rmtree(tmp, ignore_errors=True)
    rep = dict(id=cid, step_frames=STEP, frames_read=len(rows), pattern=BANNED.pattern, hits=hits, frames=rows)
    json.dump(rep, open(f'{ROOT}/qc/{cid}.ocr.json', 'w'), indent=1, ensure_ascii=False)
    print(f"{cid}: OCR {len(rows)} frames, {'HITS ' + json.dumps(hits, ensure_ascii=False)[:600] if hits else 'no old copy'}")
    return rep


if __name__ == '__main__':
    for c in sys.argv[1:]:
        check(c)
