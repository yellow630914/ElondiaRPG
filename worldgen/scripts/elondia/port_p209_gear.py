# 合併 project-thread-p209r0：任務獨特裝備改名、新增的 25 件、選裝備任務的接取條件與選項，寫回 uniq23.py 與 story_batch24.py
import json, re, sys
SP = 'worldgen/scripts/elondia/'
R = ''
sys.path.insert(0, SP)
import uniq23 as U
src = open(R + 'src/engine/state.ts').read()
m = re.search(r'const UNIQUE_GEAR_RENAMES: Record<string, string> = \{(.*?)\n\}', src, re.S).group(1)
REN = dict(re.findall(r'(\S+?): \'([^\']+)\'', m))
INV = {v: k for k, v in REN.items()}
items = {i['name']: i for i in json.load(open(R + 'data/rules/items.json'))['items']}
N = {s['id']: s for s in json.load(open(R + 'data/rules/stories.json'))['stories']}
LISTS = {'gear_new_design': 'P3_NEW_DESIGN', 'gear_broken_legend': 'P3_BROKEN', 'gear_forge_mech_armor': 'P3_MACH_ARMOR', 'gear_giant_armory': 'P3_GIANT_ARMOR',
         'gear_another_treasure': 'P3_TREASURE', 'gear_last_sea_chart': 'P3_CHART', 'gear_star_heart_forge': 'P4_ORE', 'gear_church_supply': 'P4_CHURCH',
         'gear_redwing_supply': 'P4_REDWING'}
known = {i[1] for i in U.ITEMS}


def code_of(c):
    if 'attrs' in c: return c['attrs'][0]
    if 'vs_tags' in c: return 'vs:' + ','.join(c['vs_tags'])
    if 'kinds' in c: return 'k:' + ','.join(c['kinds'])
    return ','.join(c['contexts'])


def cls_of(band, it):
    g = it['gear']
    for cls in U.WEAPON:
        s = U.spec(band, g['base'], cls)
        if s['enchants'] == g.get('enchants') and s['material'] == g['material']:
            pr = U.CLS[cls]['priority']
            if g.get('attrs') == {pr[0]: {3: 1, 4: 2, 5: 3}[band]}: return cls
    raise SystemExit(f'no class for {it["name"]}')


u = open(SP + 'uniq23.py').read()
# 新增的裝備：接在同一個清單的最後一件後面（依任務選項的順序）
for sid, lst in LISTS.items():
    band = 3 if lst.startswith('P3') else 4
    pick = next(n for n in N[sid]['nodes'] if n['id'] == 'pick')
    for o in pick['options']:
        nm = next(e['name'] for e in o['success']['effects'] if e['type'] == 'item')
        old = INV.get(nm, nm)
        if old in known: continue
        it = items[nm]
        line = f"    add({band}, {old!r}, {it['gear']['base']!r}, {cls_of(band, it)!r}, {code_of(it['gear']['unique']['check'])!r}, {it['desc']!r}),\n"
        a = u.index(f'{lst} = [')
        b = u.index('\n]\n', a)
        u = u[:b + 1] + line + u[b + 1:]
        known.add(old)
        print('add', lst, old)
# 改名：所有用引號包起來的舊名稱
for a, b in sorted(REN.items(), key=lambda x: -len(x[0])):
    u = u.replace(f"'{a}'", f"'{b}'")
open(SP + 'uniq23.py', 'w').write(u)

# story_batch24：接取條件與選項的標籤
s = open(SP + 'story_batch24.py').read()
for sid, lst in LISTS.items():
    req = N[sid]['start'].get('requires')
    pick = next(n for n in N[sid]['nodes'] if n['id'] == 'pick')
    labels = [o['label'] for o in pick['options']]
    a = s.index(f'pick({lst}, [')
    b = s.index('],', a)
    s = s[:a] + f'pick({lst}, {json.dumps(labels, ensure_ascii=False)[:-1]}' + s[b:]
    # 接取條件：quest(..., npc, lv, req, ...) 的 req 是任務 id 之後第 7 個參數；用 id 找到那一段換掉 None
    if req:
        q = s.index(f"'{sid}',")
        seg_end = s.index('\n    [', q)
        seg = s[q:seg_end]
        new = re.sub(r", None,\n", f", {json.dumps(req, ensure_ascii=False)},\n", seg, count=1)
        s = s[:q] + new + s[seg_end:]
open(SP + 'story_batch24.py', 'w').write(s)
print('ok')
