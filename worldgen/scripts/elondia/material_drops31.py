# 材料的取得量（2026-10-31，使用者要求：材料委託 1～2 趟、做一件東西 3～5 趟；卡住玩家的是難度，不是機率）
#
# - 怪物掉落的材料（items.json 的 category: material）機率至少 MIN_CHANCE（緋夢樂園的怪物不動，由 lust_park_s7.py 管）
# - 高階打造材料照怪物的強度分：第 4 級只有 Lv.8 以上的層主（較弱的層主換成同類型的第 3 級），
#   第 5 級只有 Lv.13 以上的層主（底層）
# - 底層層主補齊每種材料類型的第 5 級：布料（月影根穴、荊棘迴廊、潮隕洞窟）、珠寶（低語墓穴、流沙聖殿）
# - 藥草在雜貨店與神殿賣、光泉水在魔法物品店賣（城鎮以上）、熒光苔蘚加進地下城的採集點
# - 材料委託要交的份數減少（town_quests.json）
#
# 可以重跑（設定的是結果，不會重複套用）。在 repo 根目錄執行：python3 worldgen/scripts/elondia/material_drops31.py
import json
import re

MIN_CHANCE = 0.8
T4_MIN_LEVEL = 8
T5_MIN_LEVEL = 13

# 底層層主改掉的高階材料：[換掉的第 4 級、第 5 級] → [新的第 4 級、第 5 級]
ABYSS_SWAP = {
    'moon_fragment_core': ['魔織布匹', '星輝絲'],
    'nature_goddess_shadow': ['魔織布匹', '星輝絲'],
    'sea_god_remnant': ['魔織布匹', '星輝絲'],
}
# 底層層主另外加的第 5 級珠寶材料
ABYSS_ADD = {
    'emperor_of_whispers': ['星辰石原石'],
    'sun_god_avatar': ['星辰石原石'],
}
QUEST_QTY = {'gather_wild': [2, 3], 'gather_dungeon': [1, 3], 'drop_wild': [1, 3], 'drop_dungeon': [1, 3]}
SELL = {'藥草': ['general', 'temple'], '光泉水': ['magic']}
SELL_MIN_LOCATION = {'光泉水': 'town'}
DUNGEON_GATHER = ['鐵礦石', '夜光蘑菇', '熒光苔蘚', '古錢']

items = json.load(open('data/rules/items.json'))['items']
I = {i['name']: i for i in items}
gear = json.load(open('data/rules/gear.json'))
MATS = gear['materials']


def tier_kind(name):
    f = (I.get(name) or {}).get('forge')
    if not f:
        return None
    opts = [(MATS[m]['tier'], MATS[m]['kind']) for m in f['materials'] if m in MATS]
    return min(opts) if opts else None


def lower_of(kind, tier):
    """同類型低一級、最便宜的打造材料"""
    mk = [k for k, m in MATS.items() if m['kind'] == kind and m['tier'] == tier]
    c = sorted([i for i in items if mk and mk[0] in (i.get('forge') or {}).get('materials', [])], key=lambda i: i['price_cc'])
    return c[0]['name'] if c else None


def write_line(text, value):
    """把 enemies.json 裡這隻怪物那一行換掉（一隻怪物一行）"""
    m = re.search(r'^    (\{"id": "' + re.escape(value['id']) + r'".*?\})(,?)$', text, re.M)
    assert m, value['id']
    return text[:m.start(1)] + json.dumps(value, ensure_ascii=False) + text[m.end(1):]


def enemies():
    p = 'data/rules/enemies.json'
    text = open(p).read()
    data = json.loads(text)
    enc = data['encounters']
    park = {i for loc, t in enc.items() if loc.startswith('park_') for layer in t.values() if isinstance(layer, list)
            for g in layer for i, _ in (g if isinstance(g[0], list) else [g])}
    for loc, t in enc.items():
        if loc.startswith('park_') and isinstance(t, dict):
            for g in (t.get('bosses') or {}).values():
                park.update(i for i, _ in g)
    bosses = set()
    for loc, t in enc.items():
        if loc.startswith('$') or not isinstance(t, dict):
            continue
        for g in list((t.get('bosses') or {}).values()) + ([t['boss']] if t.get('boss') else []):
            bosses.add(g[0][0])
    changed = 0
    for e in data['enemies']:
        if e['id'] in park or not e.get('loot'):
            continue
        before = json.dumps(e, ensure_ascii=False)
        loot = e['loot']
        if e['id'] in ABYSS_SWAP:
            new4, new5 = ABYSS_SWAP[e['id']]
            for l in loot:
                tk = tier_kind(l['item'])
                if tk and tk[0] == 4:
                    l['item'] = new4
                if tk and tk[0] == 5:
                    l['item'] = new5
        for name in ABYSS_ADD.get(e['id'], []):
            if not any(l['item'] == name for l in loot):
                loot.append({'item': name, 'chance': MIN_CHANCE})
        out = []
        for l in loot:
            tk = tier_kind(l['item'])
            if tk and e['id'] in bosses:
                tier, kind = tk
                if tier >= 5 and e['level'] < T5_MIN_LEVEL:
                    continue
                if tier == 4 and e['level'] < T4_MIN_LEVEL:
                    low = lower_of(kind, 3)
                    if any(tier_kind(x['item']) == (3, kind) for x in loot):
                        continue
                    l = {**l, 'item': low}
            if (I.get(l['item']) or {}).get('category') == 'material' and l.get('chance', 1) < MIN_CHANCE:
                l = {**l, 'chance': MIN_CHANCE}
            out.append(l)
        e['loot'] = out
        if json.dumps(e, ensure_ascii=False) != before:
            text = write_line(text, e)
            changed += 1
    open(p, 'w').write(text)
    print('enemies changed', changed)


def items_json():
    p = 'data/rules/items.json'
    text = open(p).read()
    for name, tags in SELL.items():
        m = re.search(r'^(\s*\{ ?"name": "' + re.escape(name) + r'".*?)$', text, re.M)
        assert m, name
        line = m.group(1)
        obj_m = re.match(r'^(\s*)(\{.*\})(,?)$', line)
        indent, body, comma = obj_m.groups()
        spaced = body.startswith('{ ')
        obj = json.loads(body)
        obj['tags'] = sorted(set(obj.get('tags', [])) | set(tags), key=lambda t: (t not in tags, t))
        if name in SELL_MIN_LOCATION:
            obj['min_location'] = SELL_MIN_LOCATION[name]
        s = json.dumps(obj, ensure_ascii=False)
        if spaced:
            s = '{ ' + s[1:-1] + ' }'
        text = text[:m.start(1)] + indent + s + comma + text[m.end(1):]
    open(p, 'w').write(text)


def maps_json():
    p = 'data/world/maps.json'
    text = open(p).read()
    text, n = re.subn(r'("resource_items": )\["鐵礦石"[^\]]*\]', lambda m: m.group(1) + json.dumps(DUNGEON_GATHER, ensure_ascii=False), text)
    assert n == 1, n
    open(p, 'w').write(text)


def quests():
    p = 'data/rules/town_quests.json'
    text = open(p).read()
    for kind, qty in QUEST_QTY.items():
        text, n = re.subn(r'("' + kind + r'": \{[^{}]*?"qty": )\[\d+, \d+\]', lambda m: m.group(1) + json.dumps(qty), text)
        assert n == 1, kind
    open(p, 'w').write(text)


enemies()
items_json()
maps_json()
quests()
