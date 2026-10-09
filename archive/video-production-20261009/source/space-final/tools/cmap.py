import struct, sys
def cmap(path):
    d = open(path, 'rb').read()
    n = struct.unpack('>H', d[4:6])[0]
    tables = {d[12+16*i:16+16*i].decode('latin1'): struct.unpack('>II', d[20+16*i:28+16*i]) for i in range(n)}
    off = tables['cmap'][0]
    nsub = struct.unpack('>H', d[off+2:off+4])[0]
    cps = set()
    for i in range(nsub):
        pid, eid, so = struct.unpack('>HHI', d[off+4+8*i:off+12+8*i])
        s = off + so; fmt = struct.unpack('>H', d[s:s+2])[0]
        if fmt == 4:
            segx2 = struct.unpack('>H', d[s+6:s+8])[0]; seg = segx2 // 2
            ends = struct.unpack(f'>{seg}H', d[s+14:s+14+segx2])
            starts = struct.unpack(f'>{seg}H', d[s+16+segx2:s+16+2*segx2])
            deltas = struct.unpack(f'>{seg}h', d[s+16+2*segx2:s+16+3*segx2])
            ro_at = s+16+3*segx2
            ros = struct.unpack(f'>{seg}H', d[ro_at:ro_at+segx2])
            for k in range(seg):
                for c in range(starts[k], ends[k]+1):
                    if c == 0xFFFF: continue
                    if ros[k] == 0: g = (c + deltas[k]) & 0xFFFF
                    else:
                        ga = ro_at + 2*k + ros[k] + 2*(c - starts[k]); g = struct.unpack('>H', d[ga:ga+2])[0]
                        if g: g = (g + deltas[k]) & 0xFFFF
                    if g: cps.add(c)
        elif fmt == 12:
            ng = struct.unpack('>I', d[s+12:s+16])[0]
            for k in range(ng):
                a, b, g = struct.unpack('>III', d[s+16+12*k:s+28+12*k])
                cps.update(range(a, b+1))
    return cps
cps = cmap(sys.argv[1])
chars = sys.argv[2]
print(len(cps), 'code points;', 'present:', ''.join(c for c in chars if ord(c) in cps) or '-', '| absent:', ''.join(c for c in chars if ord(c) not in cps) or '-')
