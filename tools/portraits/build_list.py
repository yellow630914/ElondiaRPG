# 角色印象圖工具的名單：任務線走向（worldgen/tools/flowdoc/flowdoc.py）裡「角色線」「角色線（成人向）」的主角。
# 用法（在 repo 根目錄）：python3 tools/portraits/build_list.py
# 讀 data/rules/stories.json、data/world/npcs.json，寫 tools/portraits/npcs.json。
# 英文提示詞是手寫的，放在 tools/portraits/prompts.json（以 NPC id 為 key），重跑時合併進來，不會被蓋掉。
# 只用標準函式庫。
import ast, collections, json, pathlib, re

HERE = pathlib.Path(__file__).resolve().parent
R = HERE.parents[1]
ld = lambda p: json.load(open(R / p, encoding='utf-8'))
S = ld('data/rules/stories.json')['stories']
NPCS = {n['id']: n for n in ld('data/world/npcs.json')['npcs']}
NPC = {k: n['name'] for k, n in NPCS.items()}
geo = ld('data/world/geography.json')
LOC = {l['id']: l['name'] for l in geo['locations']}
GEAR = ld('data/rules/gear.json')
TRAITS = ld('data/world/npc_traits.json')

# 打工線的名單直接從 flowdoc.py 讀，兩邊不會對不上
src = (R / 'worldgen/tools/flowdoc/flowdoc.py').read_text(encoding='utf-8')
WORK_LINES = ast.literal_eval(re.search(r'^WORK_LINES = (\{.*?\})', src, re.S | re.M).group(1))

# 主角從線名看不出來、要兩個人一起畫的線
PAIRS = {'雙子女僕': ['npc_rona', 'npc_lana']}

RACE = {'human': '人類', 'elf': '精靈', 'dwarf': '矮人', 'demon': '魔族', 'catfolk': '貓人', 'yulin': '玉璘族'}
GENDER = {'female': '女性', 'male': '男性', 'femboy': '偽娘', 'futa': '扶他', 'ts': '跨性別女性', 'unknown': '不明'}

# ---- 和 flowdoc.py 相同的分線與分類 ----
lines = collections.OrderedDict()
for st in S:
    m = re.search(r'（([^（）]*)）\s*$', st['summary'])
    name = re.sub(r'・[一二三四五六七八九十終序].*$', '', m.group(1)) if m else '入門委託'
    if name.startswith('巨龍史詩'): name = '巨龍史詩'
    if name.startswith('史詩：'): name = '政治史詩'
    lines.setdefault(name, []).append(st)

SHORT = {k: v.split('・')[0].split('「')[-1].split('」')[-1] for k, v in NPC.items()}


def category(name, sts):
    if name in ('政治史詩', '巨龍史詩', '多人特殊任務', '入門委託', '沿海洞窟') or name in WORK_LINES: return None
    nn = [n for s in sts for n in s['nodes']]
    if name in LOC.values() or sum(n['at'].get('where') == 'dungeon' for n in nn) * 2 >= len(nn): return None
    adult = sum('adult' in s.get('tags', []) for s in sts) * 2 > len(sts)
    if any(len(x) >= 2 and x in name for x in SHORT.values()): return '角色線（成人向）' if adult else '角色線'
    if adult: return '角色線（成人向）'
    top = collections.Counter(s['start'].get('npc') for s in sts).most_common(1)[0]
    if top[0] and top[1] / len(sts) >= 0.75 and sts[0]['start']['kind'] == 'npc': return '角色線'
    return None


def flags(st):
    for n in st['nodes']:
        outs = [n.get('success'), n.get('fail')] + [o.get(k) for o in n.get('options', []) for k in ('success', 'fail')]
        for o in outs:
            if o: yield from o.get('set_flags', [])


def subjects(name, sts):
    """這條線的主角：線名裡的名字（「蕾娜」在「瑟蕾娜」裡時只算瑟蕾娜）＋親密場景（night）的對象；都沒有時用最常開頭的人"""
    if name in PAIRS: return PAIRS[name]
    named = [k for k, x in SHORT.items() if len(x) >= 2 and x in name]
    named = [k for k in named if not any(k != j and SHORT[k] in SHORT[j] for j in named)]
    night = [n['at']['npc'] for s in sts for n in s['nodes'] if n['id'] == 'night' and n['at'].get('npc') in NPCS]
    out = list(dict.fromkeys(named + night))
    if out: return out
    top = collections.Counter(s['start'].get('npc') for s in sts if s['start'].get('npc')).most_common(1)
    return [top[0][0]] if top else []


def outfit(n):
    """NPC 依身分穿的衣服（gear.json 的 npc_outfits，第一條符合的非成人向規則；和 src/engine/outfits.ts 相同）"""
    body = TRAITS['races'].get(n['race'], {}).get('body') or TRAITS['body_by_gender'].get(n.get('gender'), 'andro')
    tags = n.get('tags', [])
    for r in GEAR['npc_outfits']['rules']:
        if r.get('adult'): continue
        if r.get('body') and body not in r['body']: continue
        if r.get('tags') and not any(t in tags for t in r['tags']): continue
        if r.get('occupations') and not any(o in (n.get('occupation') or '') for o in r['occupations']): continue
        return body, [GEAR['bases'][b]['name'] for lst in r['slots'].values() for b in lst if b in GEAR['bases']]
    return body, []


# ---- 挑出角色線的主角 ----
picked = collections.OrderedDict()
for name, sts in lines.items():
    sts = sorted(sts, key=lambda s: (s['start'].get('min_level') or 0))
    cat = category(name, sts)
    if not cat: continue
    romance = any(f.endswith('_lover') for s in sts for f in flags(s)) or any(n['id'] == 'night' for s in sts for n in s['nodes'])
    for nid in subjects(name, sts):
        e = picked.setdefault(nid, {'lines': [], 'romance': False, 'adult_line': False})
        e['lines'].append(name)
        e['romance'] = e['romance'] or romance
        e['adult_line'] = e['adult_line'] or cat == '角色線（成人向）'

prompts_path = HERE / 'prompts.json'
prompts = json.load(open(prompts_path, encoding='utf-8')) if prompts_path.exists() else {}

out = []
for nid, e in picked.items():
    n = NPCS[nid]
    body, wear = outfit(n)
    age = re.search(r'([0-9０-９]+|[一二三四五六七八九十百]+)歲', n.get('appearance', ''))
    p = prompts.get(nid, {})
    adult = bool(n.get('adult')) or e['adult_line']
    out.append({
        'id': nid, 'name': n['name'], 'race': n['race'], 'race_name': RACE.get(n['race'], n['race']),
        'gender': n.get('gender'), 'gender_name': GENDER.get(n.get('gender'), n.get('gender')), 'body': body,
        **({'lineage': n['lineage']} if n.get('lineage') else {}),
        **({'age': age.group(0)} if age else {}),
        **({'occupation': n['occupation']} if n.get('occupation') else {}),
        'class': n.get('class'), 'tags': n.get('tags', []),
        'appearance': n.get('appearance', ''),
        **({'adult_appearance': n['adult_appearance']} if n.get('adult_appearance') else {}),
        'outfit': wear, 'adult': adult, 'romance': e['romance'],
        'line': e['lines'][0], 'lines': e['lines'],
        'prompt': p.get('prompt', ''),
        **({'negative': p['negative']} if p.get('negative') else {}),
        **({'adult_prompt': p['adult_prompt']} if adult and p.get('adult_prompt') else {}),
    })

json.dump({'npcs': out}, open(HERE / 'npcs.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
missing = [x['id'] for x in out if not x['prompt']]
print(f"{len(out)} 位 NPC，{len({l for x in out for l in x['lines']})} 條線 → tools/portraits/npcs.json")
if missing: print('還沒有英文提示詞：', ' '.join(missing))
