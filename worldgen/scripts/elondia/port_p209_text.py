# 合併 project-thread-p209r0：把分支直接改的任務與角色文字，換進產生腳本裡的原文
import json, subprocess, glob, re
SP = 'worldgen/scripts/elondia/'
R = ''
def show(rev, p): return json.loads(subprocess.run(['git', 'show', f'{rev}:{p}'], cwd=R, capture_output=True, text=True, check=True).stdout)
src = open(R + 'src/engine/state.ts').read()
m = re.search(r'const UNIQUE_GEAR_RENAMES: Record<string, string> = \{(.*?)\n\}', src, re.S).group(1)
REN = dict(re.findall(r'(\S+?): \'([^\']+)\'', m))
pairs = []
def walk(a, b):
    if isinstance(a, str) and isinstance(b, str):
        if a != b: pairs.append((a, b))
    elif isinstance(a, dict) and isinstance(b, dict):
        for k in a:
            if k in b: walk(a[k], b[k])
    elif isinstance(a, list) and isinstance(b, list):
        for x, y in zip(a, b): walk(x, y)
for p, key in [('data/rules/stories.json', 'stories'), ('data/world/npcs.json', 'npcs')]:
    o = {x['id']: x for x in show('43ece6c', p)[key]}
    n = {x['id']: x for x in json.load(open(R + p))[key]}
    for k in n:
        if k in o: walk(o[k], n[k])
def renamed(s):
    for a, b in REN.items(): s = s.replace(a, b)
    return s
files = {f: open(f).read() for f in glob.glob(SP + '*.py')}
miss = []
for a, b in dict(pairs).items():
    if renamed(a) == b: continue   # 只是改名：uniq23 的名字換掉就會跟著變
    hits = [f for f, s in files.items() if json.dumps(a, ensure_ascii=False)[1:-1] in s or a in s]
    if len(hits) == 1:
        f = hits[0]
        files[f] = files[f].replace(a, b) if a in files[f] else files[f].replace(json.dumps(a, ensure_ascii=False)[1:-1], json.dumps(b, ensure_ascii=False)[1:-1])
        print('ok', f.split('/')[-1], a[:30])
    else:
        miss.append((a, b, [h.split('/')[-1] for h in hits]))
for f, s in files.items():
    if s != open(f).read(): open(f, 'w').write(s)
for a, b, h in miss: print('MISS', h, '\n   ', a[:120], '\n   ', b[:120])
