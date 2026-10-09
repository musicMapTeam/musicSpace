# precise UI measurements on rc2 frames (source px, 1080x2340)
import sys, subprocess, numpy as np
from PIL import Image
FF = '/opt/homebrew/bin/ffmpeg'
def frame(clip, n):
    cmd = [FF, '-v', 'error', '-i', clip, '-vf', f"select=eq(n\\,{n}),scale=in_color_matrix=bt709:in_range=tv:out_range=pc,format=rgb24", '-fps_mode', 'passthrough', '-frames:v', '1', '-f', 'rawvideo', '-']
    return np.frombuffer(subprocess.run(cmd, capture_output=True).stdout, np.uint8).reshape(2340, 1080, 3).astype(np.float32)
C = '/tmp/space-video-doodle/prod/capture/P1-rc2/clips/'
def ink_bbox(f, x0, y0, x1, y1, thr=90):
    reg = f[y0:y1, x0:x1].mean(2); m = reg < thr
    ys, xs = np.nonzero(m)
    if not len(xs): return None
    return (x0 + xs.min(), y0 + ys.min(), x0 + xs.max(), y0 + ys.max())
# --- template match the accepted sticker
acc = frame(C + 'P-11.mp4', 300)
st = np.asarray(Image.open('/tmp/space-video-doodle/prod/capture/P2P3-rc2/cut/CUT-06s_exchange-accepted-sticker.png').convert('RGBA')).astype(np.float32)
a = st[..., 3:] / 255.0; rgb = st[..., :3]
h, w = st.shape[:2]; best = None
for y in range(230, 330, 2):
    for x in range(250, 330, 2):
        reg = acc[y:y + h, x:x + w]
        err = (np.abs(reg - rgb).mean(2) * a[..., 0]).sum() / a.sum()
        if best is None or err < best[0]: best = (err, x, y)
err, bx, by = best
for y in range(by - 2, by + 3):
    for x in range(bx - 2, bx + 3):
        reg = acc[y:y + h, x:x + w]; e = (np.abs(reg - rgb).mean(2) * a[..., 0]).sum() / a.sum()
        if e < best[0]: best = (e, x, y)
err, bx, by = best
print(f'sticker CUT-06s top-left ({bx},{by}) err {err:.2f}; image centre ({bx + w / 2:.1f},{by + h / 2:.1f}) size {w}x{h}')
# --- accepted lines
print('accepted line 散场后也能…', ink_bbox(acc, 30, 1360, 1060, 1440))
print('accepted revoke text', ink_bbox(acc, 200, 1540, 900, 1610))
print('accepted button outline', ink_bbox(acc, 30, 1490, 1070, 1680, thr=60))
print('accepted 和 阿遥 的两张照片', ink_bbox(acc, 250, 560, 830, 640))
print('accepted 刷新', ink_bbox(acc, 400, 1720, 700, 1800))
# --- pending
pen = frame(C + 'P-10.mp4', 150)
print('pending status pill', ink_bbox(pen, 30, 290, 500, 420, thr=60))
print('pending 等 TA 接受后…', ink_bbox(pen, 30, 1340, 1060, 1400))
print('pending 有效至', ink_bbox(pen, 30, 1240, 1060, 1300))
print('pending pair', ink_bbox(pen, 30, 540, 1060, 1200, thr=40))
print('pending 撤回这个申请 button', ink_bbox(pen, 30, 1470, 1070, 1640, thr=60))
# --- compose
com = frame(C + 'P-09.mp4', 100)
print('compose consent label', ink_bbox(com, 140, 1840, 1060, 1920))
print('compose checkbox', ink_bbox(com, 40, 1830, 140, 1930, thr=60))
print('compose send', ink_bbox(com, 30, 1960, 1060, 2160, thr=120))
print('compose line 用我拍下的', ink_bbox(com, 30, 300, 1060, 390))
print('compose pair', ink_bbox(com, 30, 400, 1060, 1060, thr=40))
print('compose swap circle (yellow)', (lambda m: (m[1].min(), m[0].min(), m[1].max(), m[0].max()))(np.nonzero((np.abs(com[550:820, 450:650, 0] - 255) < 30) & (np.abs(com[550:820, 450:650, 1] - 210) < 40) & (com[550:820, 450:650, 2] < 120))))
print('compose reason text', ink_bbox(com, 80, 1520, 1020, 1670))
print('compose select', ink_bbox(com, 30, 1170, 1060, 1400, thr=60))
tick = frame(C + 'P-09.mp4', 340)
print('compose ticked checkbox', ink_bbox(tick, 40, 1830, 140, 1930, thr=60))
print('compose send (enabled)', ink_bbox(tick, 30, 1960, 1060, 2170, thr=60))
# --- badge view
bad = frame(C + 'P-09.mp4', 30)
print('badge pill', ink_bbox(bad, 90, 880, 600, 1050, thr=60))
print('badge reason 1', ink_bbox(bad, 110, 1070, 900, 1135))
print('badge reason 2', ink_bbox(bad, 110, 1150, 900, 1215))
print('badge offer btn', ink_bbox(bad, 100, 1240, 960, 1440, thr=40))
print('badge header chips', ink_bbox(bad, 0, 0, 1080, 200, thr=60))
print('badge panel top', ink_bbox(bad, 0, 150, 1080, 240, thr=60))
print('badge nav', ink_bbox(bad, 0, 2000, 1080, 2240, thr=60))
print('badge footer', ink_bbox(bad, 0, 2240, 1080, 2340, thr=90))
