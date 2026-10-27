import json, re, sys
sys.path.insert(0, 'worldgen/scripts/elondia')
exec(open('worldgen/scripts/elondia/abyss.py').read())
exec(open('worldgen/scripts/elondia/abyss_items.py').read())
HP = json.load(open(sys.argv[1])) if len(sys.argv) > 1 else {}
PER_HIT = {11: 23.4, 12: 22.9, 13: 24.6}
LEVEL = {'a': 11, 'b': 12, 'boss': 13}
XP = {'a': 900, 'b': 1020, 'boss': 1850}
orig = json.load(open('data/rules/enemies.json'))
E = {e['id']: e for e in orig['enemies']}
enc = orig['encounters']
region = {dg: E[v['bosses']['deep'][0][0]].get('habitats', ['central'])[0] for dg, v in enc.items()}
region.update({'snake_creek': 'central', 'whisper_crypt': 'central', 'mist_abbey': 'central'})
enemies, items, by_dg = [], [], {}
for dg, role, k in M:
    lv = LEVEL[role]
    attrs = dict(T[k['t']])
    top = max(attrs, key=attrs.get)
    if lv == 11: attrs[top] = 21
    if role == 'boss': attrs['dex'] = max(attrs['dex'], 17)
    guess = round(k['hits'] * max(8, PER_HIT[lv] - k['dr'] * 0.6))
    e = {'id': k['id'], 'name': k['name'], 'level': lv, 'attrs': attrs, 'hp': HP.get(k['id'], guess), 'ap': 7 if role == 'boss' else 6,
         'weapon': {'dice': k['w'][0], 'type': k['w'][1], 'attr': k['w'][2]}, 'evade': k['evade'], 'dr': k['dr'], 'resist': k['resist'],
         'abilities': k['ab'], 'xp': XP[role], 'habitats': [region[dg]]}
    if k.get('money'): e['money_cc'] = list(k['money'])
    e['loot'] = [({'item': n, 'chance': c} if len(t) == 2 else {'item': n, 'chance': c, 'qty': t[2]}) for t in k['loot'] for n, c in [t[:2]]]
    if k.get('rut'): e['rut'] = True
    e['desc'] = k['desc']
    e['kind'] = k['kind']
    if k.get('armed'): e['armed'] = True
    enemies.append(e)
    by_dg.setdefault(dg, {})[role] = k['id']
    first = k['loot'][0][0]
    if first in ITEM_DESC:
        items.append({'name': first, 'category': 'material', 'price_cc': 1000 if role == 'boss' else (220 if lv == 11 else 250), 'tags': [], 'desc': ITEM_DESC[first]})
# 寫入 enemies.json：怪物接在 enemies 陣列最後，各地下城加上 abyss 與 bosses.abyss
text = open('data/rules/enemies.json').read()
text = re.sub(r'\n    \{"id": "(' + '|'.join(e['id'] for e in enemies) + r')".*', '', text)  # 重跑時先拿掉舊的
i = text.index('\n  ],\n  "encounters"')
line = lambda e: '    ' + json.dumps(e, ensure_ascii=False) 
existing_last = text[:i].rstrip()
if not existing_last.endswith(','): existing_last += ','
text = existing_last + '\n' + ',\n'.join(line(e) for e in enemies) + text[i:]
for dg, r in by_dg.items():
    a, b, boss = r['a'], r['b'], r['boss']
    deep_top = max((m for g in enc[dg]['deep'] for m, _ in g), key=lambda m: E[m]['level'])
    abyss = [[[a, 2]], [[b, 1], [a, 1]], [[b, 2]], [[a, 1], [deep_top, 1]]]
    # 這座地下城的區塊：補上 abyss 一行、bosses 加上 abyss
    m = re.search(r'(\n    "' + dg + r'": \{\n(?:.*\n)*?      "deep": .*?,\n)', text)
    block_start = m.end()
    if '"abyss":' not in text[block_start:block_start + 200].split('"bosses"')[0]:
        text = text[:block_start] + '      "abyss": ' + json.dumps(abyss, ensure_ascii=False).replace('],[', '], [').replace(',"', ', "') + ',\n' + text[block_start:]
    bm = re.search(r'(\n    "' + dg + r'": \{\n(?:.*\n)*?      "bosses": \{.*?)(\}\n)', text)
    if '"abyss"' not in bm.group(1).split('"bosses"')[-1]:
        text = text[:bm.end(1)] + ', "abyss": ' + json.dumps([[boss, 1], [a, 1]], ensure_ascii=False).replace(',"', ', "') + text[bm.end(1):]
open('data/rules/enemies.json', 'w').write(text)
json.loads(text)
# items.json：新的掉落物接在原初魔焰之核後面
it = open('data/rules/items.json').read()
names = {x['name'] for x in json.loads(it)['items']}
new = [x for x in items if x['name'] not in names]
if new:
    anchor = it.index('"name": "原初魔焰之核"')
    eol = it.index('\n', anchor)
    it = it[:eol] + '\n' + '\n'.join('    ' + json.dumps(x, ensure_ascii=False).replace('{"', '{ "').replace('"}', '" }').replace('", "', '", "').replace(', "', ', "') + ',' for x in new) + it[eol:]
    open('data/rules/items.json', 'w').write(it)
    json.loads(it)
print(len(enemies), 'monsters', len(new), 'items')
