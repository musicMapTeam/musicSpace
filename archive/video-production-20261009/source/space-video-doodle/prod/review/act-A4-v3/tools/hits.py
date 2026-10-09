# downbeat hit size (dB): max 50 ms RMS 0-250 ms after the beat minus the mean 50 ms RMS 50-600 ms before (rhythm review method)
import sys, json, numpy as np, subprocess
def load(p):
    raw = subprocess.run(['/opt/homebrew/bin/ffmpeg', '-v', 'error', '-i', p, '-ac', '1', '-ar', '48000', '-f', 'f32le', '-'], capture_output=True).stdout
    return np.frombuffer(raw, np.float32)
C = json.load(open('/tmp/space-video-doodle/prod/tools/tempo-maps/compiled/flipping-in-b.json'))
bars = {b['sb']: b for b in C['bars']}
def T(pos):
    b, bt = pos.split(':'); B = bars[b]; return B['t0'] + (float(bt) - 1) * B['len'] / 4
def rms(x): return 10 * np.log10(np.mean(x ** 2) + 1e-12)
def hit(a, t, t_off):
    sr = 48000; t = t - t_off
    w = int(0.05 * sr); after = [rms(a[int((t + k * 0.01) * sr):int((t + k * 0.01) * sr) + w]) for k in range(0, 21)]
    before = [rms(a[int((t - k * 0.01) * sr) - w:int((t - k * 0.01) * sr)]) for k in range(5, 56)]
    return max(after) - np.mean(before), max(after)
for spec in sys.argv[1:]:
    p, off = spec.split('@'); a = load(p); off = float(off)
    print(p.split('/')[-1], ' '.join(f"{pos}:{hit(a, T(pos), off)[0]:+.1f}dB" for pos in ['41:1', '43:1', '45:1', '47:3', '48:1', '49:1', '51:1', '52:1', '53:1', '54:1']))
    seg = a[int((T('41:1') - off) * 48000):int((T('55:1') - off) * 48000)]
    print('   act RMS %.1f dBFS, peak %.1f dBFS' % (rms(seg), 20 * np.log10(np.abs(seg).max())))
