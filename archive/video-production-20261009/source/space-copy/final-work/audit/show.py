import sys,re
for line in open(sys.argv[1], encoding='utf-8'):
    line=line.rstrip('\n')
    if (line.startswith('  attrs: ') or line.startswith('  hidden: ')) and len(line)>1200:
        print(line[:600]+' …(cut)'); continue
    print(line)
