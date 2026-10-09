# Pixel-level old-copy check of the rendered act: every STEP-th frame of the act mp4 (plus the last) is read by macOS Vision
# (capture/desktop-rc2/tools/ocr/ocr, zh-Hans + en-US) and grepped for rc.1 / explanatory copy.  Positive control: the rc.2 strings the
# act must show (等待对方回应, 交换已接受, 撤销这次交换 ...) have to be found.
# usage: ocr_check.py <act.mp4> <out.json> [step]
import json, os, re, shutil, subprocess, sys
FF = '/opt/homebrew/bin/ffmpeg'
OCR = '/tmp/space-video-doodle/prod/capture/desktop-rc2/tools/ocr/ocr'
video, outp = sys.argv[1], sys.argv[2]; STEP = int(sys.argv[3]) if len(sys.argv) > 3 else 10
BANNED = re.compile(r'示例|虚构|本页|演示|自动回复|不是真人|没有服务器|只存在这个浏览器|模拟|本地体验版|在线访问|等待本人回应|示例站|关于这个示例'
                    r'|双方已明确同意|规则判断|要不要交换|仍由你和对方决定|原件仍归各自|发送后|限尺寸预览|核对')
CONTROL = ['等待对方回应', '交换已接受', '撤销这次交换', '交换一个视角', '同一刻的另一面', '我同意先给小图', '和 TA 交换这个视角', '散场后也能在']
n = int(subprocess.run(['/opt/homebrew/bin/ffprobe', '-v', 'error', '-count_frames', '-select_streams', 'v:0', '-show_entries', 'stream=nb_read_frames', '-of', 'csv=p=0', video], capture_output=True, text=True).stdout.strip())
picks = sorted(set(list(range(0, n, STEP)) + [n - 1]))
tmp = os.path.join(os.path.dirname(outp), 'ocr-tmp'); shutil.rmtree(tmp, ignore_errors=True); os.makedirs(tmp)
sel = f'not(mod(n\\,{STEP}))+eq(n\\,{n - 1})'
subprocess.run([FF, '-v', 'error', '-i', video, '-vf', f'select={sel}', '-fps_mode', 'passthrough', '-q:v', '2', f'{tmp}/f%05d.png'], check=True)
files = sorted(os.listdir(tmp)); assert len(files) == len(picks), (len(files), len(picks))
out = subprocess.run([OCR] + [f'{tmp}/{f}' for f in files], capture_output=True, text=True).stdout.splitlines()
rows, hits, seen = [], [], {c: 0 for c in CONTROL}
for k, line in zip(picks, out):
    parts = line.split('\t', 2); text = parts[2] if len(parts) > 2 else ''
    flat = text.replace(' ', '')
    rows.append(dict(frame=k, t=round(k / 60, 3), text=text))
    m = BANNED.findall(text) + BANNED.findall(flat)
    if m: hits.append(dict(frame=k, t=round(k / 60, 3), words=sorted(set(m)), text=text[:400]))
    for c in CONTROL:
        if c.replace(' ', '') in flat: seen[c] += 1
shutil.rmtree(tmp, ignore_errors=True)
json.dump(dict(video=video, step=STEP, frames_read=len(rows), banned=BANNED.pattern, hits=hits, control_frames=seen, frames=rows), open(outp, 'w'), indent=1, ensure_ascii=False)
print(f'OCR {len(rows)} frames: ' + ('HITS ' + json.dumps(hits, ensure_ascii=False)[:1500] if hits else 'no old / explanatory copy'))
print('positive control (frames where found):', json.dumps(seen, ensure_ascii=False))
