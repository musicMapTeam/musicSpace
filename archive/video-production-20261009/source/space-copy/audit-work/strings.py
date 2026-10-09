import re,sys,glob
files=[f for pat in sys.argv[1:] for f in glob.glob(pat)]
pat=re.compile(r"(?:'([^'\n]*[一-鿿][^'\n]*)'|`([^`]*[一-鿿][^`]*)`|\"([^\"\n]*[一-鿿][^\"\n]*)\")")
words=['不会','无法','明确','仍','核','不能','只能','不代表','不是','示例','虚构','演示','模拟','服务','浏览器','本机','原','真实','联系','主办方','活动','空间','长期','不自动','授权','权限','保留','承诺','不展示','不保存','不上传','不读取']
seen=set()
for f in files:
    src=open(f,encoding='utf-8').read()
    # drop line comments
    lines=[l for l in src.split('\n') if not re.match(r'\s*(//|\*|/\*)', l)]
    src='\n'.join(lines)
    for m in pat.finditer(src):
        t=next(g for g in m.groups() if g)
        for piece in re.split(r'\$\{[^}]*\}|<[^>]+>', t):
            piece=piece.strip()
            if not re.search(r'[一-鿿]', piece): continue
            hit=[w for w in words if w in piece]
            if hit and (f,piece) not in seen:
                seen.add((f,piece)); print(f"{f.split('/')[-1]}: [{','.join(hit)}] {piece[:160]}")
