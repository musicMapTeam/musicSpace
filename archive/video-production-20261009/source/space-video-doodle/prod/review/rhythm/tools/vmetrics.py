import numpy as np, sys
sys.path.insert(0, '/tmp/space-video-doodle/prod/review/rhythm/tools')
D = '/tmp/space-video-doodle/prod/review/rhythm/data/'
g = np.load(D + 'gray160.npy').astype(np.int16)
h = np.load(D + 'hist.npy')
N = len(g)
d = np.zeros(N); big = np.zeros(N); hd = np.zeros(N)
for i in range(1, N):
    df = np.abs(g[i] - g[i - 1])
    d[i] = df.mean(); big[i] = (df > 30).mean()
    a, b = h[i], h[i - 1]
    hd[i] = 0.5 * np.sum((a - b) ** 2 / (a + b + 1e-9))
# cell activity: 16x9 cells of 10x10 px
cells = np.zeros((N, 9, 16))
for i in range(1, N):
    df = np.abs(g[i] - g[i - 1]).reshape(9, 10, 16, 10).mean(axis=(1, 3))
    cells[i] = df
np.savez_compressed(D + 'vmetrics.npz', d=d, big=big, hd=hd, cells=cells.astype(np.float32))
print('ok', N, d.mean(), big.mean(), hd.mean())
