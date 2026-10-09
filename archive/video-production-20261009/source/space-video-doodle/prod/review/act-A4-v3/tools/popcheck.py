# measure the 交换已接受 sticker fade-in and the pending status per frame (0-based n) of a clip
import sys, subprocess, numpy as np
clip, n0, n1 = sys.argv[1], int(sys.argv[2]), int(sys.argv[3])
W, H = 1080, 2340
cmd = ['/opt/homebrew/bin/ffmpeg', '-v', 'error', '-i', clip, '-vf', f"select='between(n\\,{n0}\\,{n1})',scale=in_color_matrix=bt709:in_range=tv:out_range=pc,format=rgb24", '-fps_mode', 'passthrough', '-f', 'rawvideo', '-']
raw = subprocess.run(cmd, capture_output=True).stdout
fr = np.frombuffer(raw, np.uint8).reshape(-1, H, W, 3).astype(np.float32)
prev = None
for i, f in enumerate(fr):
    n = n0 + i
    stk = f[360:510, 330:760]                     # sticker box
    mint = ((stk[..., 1] - stk[..., 0]) > 60).mean()  # mint pixels (G >> R)
    pend = f[310:400, 60:450]
    yel = ((pend[..., 0] > 200) & (pend[..., 2] < 170)).mean()
    pol = f[700:1300, 60:1020].std()
    d = 0 if prev is None else np.abs(f - prev).mean()
    print(f'n={n:4d} sticker_mint={mint:.3f} pending_yellow={yel:.3f} pair_std={pol:6.1f} diff_prev={d:6.2f}')
    prev = f
