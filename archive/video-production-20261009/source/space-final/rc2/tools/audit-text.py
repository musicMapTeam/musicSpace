"""Copy audit over every dumped state (route + room walk + map walk reports) and over the built pages.
   python3 audit-text.py <report.json> ... > audit.txt
Each state's text is document.body.innerText; attribute texts (aria-label, title, placeholder, alt) are checked separately."""
import json, re, sys, collections

WORDS = ['示例', '虚构', '模拟', '演示', '不是真人', '自动回复', '本页', '没有服务器', '只存在这个浏览器', '不代表', '不会自动', '无法远程',
         '仍归', '不订阅', '不扩大', '不是 AI', '不是AI', '规则判断', '核对', '分身', '樱下', '夜场', '情景']
MUSIC_MAP = re.compile(r'music\s*map', re.I)
DISCLOSURE = '在线版里的场地、观众和照片是演示内容，观众会自动回复。'
MAP_PROVENANCE = '唱片店、寻声和合唱目录来自 Music Map。'

def ctx(text, i, n, w=26):
    return text[max(0, i - w):i + n + w].replace('\n', ' ⏎ ')

def is_room_about(text):
    return '关于 Music Space\n' in text and '在线版\n' in text and '这是什么' in text

def is_map_about(text):
    return '关于音乐探索' in text and '数据来源' in text and '来历' in text

def scan(label, text, out, where='text'):
    hits = []
    about = is_room_about(text)
    n_disc = text.count(DISCLOSURE)
    if where == 'text':
        if about and n_disc != 1:
            hits.append(f'DISCLOSURE x{n_disc} in About (must be exactly 1)')
        if not about and n_disc:
            hits.append(f'DISCLOSURE x{n_disc} OUTSIDE About')
    clean = text.replace(DISCLOSURE, '⟦DISCLOSURE⟧')
    for word in WORDS:
        for m in re.finditer(re.escape(word), clean):
            hits.append(f'{word}: …{ctx(clean, m.start(), len(word))}…')
    for m in MUSIC_MAP.finditer(clean):
        sentence_ok = clean.find(MAP_PROVENANCE, max(0, m.start() - len(MAP_PROVENANCE)), m.end() + 2) >= 0
        if not (where == 'text' and is_map_about(text) and sentence_ok):
            hits.append(f'{m.group(0)}: …{ctx(clean, m.start(), len(m.group(0)))}…')
    out.extend(f'{label} [{where}] {h}' for h in hits)
    return about, n_disc

def main(paths):
    out, states, about_states, disc_total = [], 0, [], collections.Counter()
    fonts_sys, no_doodle = {}, collections.Counter()
    for path in paths:
        report = json.load(open(path))
        run = path.split('/rc2/')[-1].rsplit('/report.json', 1)[0]
        for key, st in report.get('states', {}).items():
            states += 1
            label = f'{run}:{key}'
            about, n = scan(label, st.get('body', ''), out)
            scan(label, '\n'.join(st.get('attrs', [])), out, 'attr')
            if about: about_states.append(label)
            disc_total[label] += n
            for k, v in (st.get('sysFallback') or {}).items():
                fonts_sys.setdefault(k, set()).update(v)
            for t in st.get('noDoodle') or []:
                no_doodle[t.split(':')[0]] += 1
    print(f'states scanned: {states}')
    print(f'About states (room 关于 Music Space open): {len(about_states)}; disclosure occurrences per About state: {sorted(set(disc_total[s] for s in about_states))}')
    print(f'disclosure occurrences outside About states: {sum(v for k, v in disc_total.items() if k not in about_states)}')
    print(f'hits: {len(out)}')
    for line in out:
        print('  ' + line)
    print('characters outside every Doodle face of their stack (system fallback):', {k: ''.join(sorted(v)) for k, v in fonts_sys.items()} or 'none')
    print('text nodes without a Doodle family in their font stack (by first family):', dict(no_doodle) or 'none')

if __name__ == '__main__':
    main(sys.argv[1:])
